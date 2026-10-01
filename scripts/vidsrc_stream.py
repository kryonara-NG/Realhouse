#!/usr/bin/env python3
"""Playwright media-source inspector for Reelhouse.

Loads an authorized embed page, watches browser network traffic, traverses
same-origin/dynamically created iframes, and inspects video/source elements and
inline scripts for direct media URLs.

The output is a small JSON manifest consumed by Reelhouse's playback resolver.
This utility does not decrypt DRM, extract license keys, bypass authentication,
or defeat access controls.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Frame, Page, sync_playwright


VIDEO_EXTENSIONS = (".mp4", ".webm", ".m4v", ".ogv")
MEDIA_RE = re.compile(
    r"""https?://[^\s"'<>\\]+?(?:\.m3u8(?:\?[^\s"'<>\\]*)?|\.mpd(?:\?[^\s"'<>\\]*)?|\.(?:mp4|webm|m4v|ogv)(?:\?[^\s"'<>\\]*)?)""",
    re.IGNORECASE,
)


def media_type(url: str, content_type: str = "") -> Optional[str]:
    path = urlparse(url).path.lower()
    ct = content_type.lower()
    if ".m3u8" in path or "mpegurl" in ct:
        return "hls"
    if ".mpd" in path or "dash+xml" in ct:
        return "dash"
    if any(path.endswith(ext) for ext in VIDEO_EXTENSIONS) or ct.startswith("video/"):
        return "mp4" if path.endswith(".mp4") or "mp4" in ct else "video"
    return None


def allowed_url(url: str, allowed_hosts: set[str]) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
        return bool(host) and any(host == h or host.endswith("." + h) for h in allowed_hosts)
    except Exception:
        return False


def build_player_url(base_url: str, media_key: str) -> str:
    base = base_url.rstrip("/")
    parts = media_key.split(":")
    if len(parts) == 2 and parts[0] == "movie":
        return f"{base}/embed/movie/{parts[1]}"
    if len(parts) == 4 and parts[0] == "tv":
        _, show_id, season, episode = parts
        return f"{base}/embed/tv/{show_id}/{season}/{episode}"
    raise ValueError("Invalid media key. Use movie:ID or tv:ID:SEASON:EPISODE.")


def normalise_source(url: str, source: str, referer: str, user_agent: str, content_type: str = "") -> Optional[dict]:
    kind = media_type(url, content_type)
    if not kind:
        return None
    return {
        "url": url,
        "type": kind,
        "source": "playwright-extracted",
        "referer": referer,
        "userAgent": user_agent,
        "contentType": content_type or None,
        "discoveredBy": source,
    }


def extract_stream(
    player_url: str,
    allowed_hosts: set[str],
    timeout_ms: int = 12_000,
    headed: bool = False,
    iframe_depth: int = 2,
) -> Optional[dict]:
    captured: list[dict] = []
    seen: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not headed,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/140.0.0.0 Safari/537.36"
        )
        context = browser.new_context(
            service_workers="block",
            user_agent=user_agent,
            viewport={"width": 1280, "height": 720},
        )

        def add(url: str, discovered_by: str, referer: str = "", content_type: str = "") -> None:
            if not allowed_url(url, allowed_hosts) or url in seen:
                return
            item = normalise_source(
                url,
                "network",
                referer or player_url,
                user_agent,
                content_type,
            )
            if item:
                seen.add(url)
                item["discoveredBy"] = discovered_by
                captured.append(item)
                print(f"[+] {item['type'].upper()} via {discovered_by}: {url}")

        def on_request(request) -> None:
            add(request.url, "request", request.headers.get("referer", ""))

        def on_response(response) -> None:
            try:
                add(
                    response.url,
                    "response",
                    response.request.headers.get("referer", ""),
                    response.headers.get("content-type", ""),
                )
            except Exception:
                pass

        context.on("request", on_request)
        context.on("response", on_response)

        page = context.new_page()
        page.goto(player_url, wait_until="domcontentloaded", timeout=30_000)

        deadline = time.monotonic() + timeout_ms / 1000

        # Give dynamic players a chance to initialise, then inspect every frame.
        while time.monotonic() < deadline and not captured:
            pages = list(context.pages)
            for current in pages:
                for frame in list(current.frames):
                    inspect_frame(frame, player_url, allowed_hosts, add)
            try:
                page.locator("video").first.click(timeout=500)
            except Exception:
                pass
            try:
                page.locator("button").first.click(timeout=500)
            except Exception:
                pass
            page.wait_for_timeout(750)

        # One final DOM/script pass even if network capture already found a source.
        for current in list(context.pages):
            for frame in list(current.frames):
                inspect_frame(frame, player_url, allowed_hosts, add)

        browser.close()

    return captured[0] if captured else None


def inspect_frame(
    frame: Frame,
    player_url: str,
    allowed_hosts: set[str],
    add,
) -> None:
    try:
        html = frame.content()
    except Exception:
        return

    frame_url = frame.url or player_url
    try:
        ua = frame.page.context.pages[0].evaluate("navigator.userAgent")
    except Exception:
        ua = ""

    def add_dom(url: str, method: str) -> None:
        absolute = urljoin(frame_url, url)
        item = normalise_source(absolute, method, frame_url, ua)
        if item and allowed_url(absolute, allowed_hosts):
            add(absolute, method, frame_url, "")
    
    try:
        for node in frame.locator("video, video source, source").all():
            src = node.get_attribute("src")
            if src:
                add_dom(src, "dom")
    except Exception:
        pass

    # Some players keep a media URL in inline configuration objects.
    for match in MEDIA_RE.findall(html):
        add_dom(match, "inline-script")


def save_stream_map(media_key: str, stream: dict, streams_file: str) -> None:
    path = Path(streams_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if not isinstance(payload, dict):
            payload = {}
    except (OSError, json.JSONDecodeError):
        payload = {}

    payload[media_key] = stream
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[+] Wired source to Reelhouse key: {media_key}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Reelhouse Playwright media extractor")
    parser.add_argument("player_url", nargs="?", help="Full authorized player/embed URL.")
    parser.add_argument("--base-url", default="https://vidsrcme.ru", help="Authorized player base URL.")
    parser.add_argument("--allowed-host", action="append", default=[], help="Allowed media/player host; repeatable.")
    parser.add_argument("--media-key", help="movie:ID or tv:ID:SEASON:EPISODE.")
    parser.add_argument("--streams-file", default="public/vidsrc-streams.json")
    parser.add_argument("--timeout-ms", type=int, default=12_000)
    parser.add_argument("--iframe-depth", type=int, default=2, help="Reserved for compatibility; frame traversal is automatic.")
    parser.add_argument("--headed", action="store_true", help="Show Chromium while debugging.")
    args = parser.parse_args()

    if args.media_key:
        try:
            player_url = build_player_url(args.base_url, args.media_key)
        except ValueError as exc:
            print(f"[-] {exc}")
            return 2
    elif args.player_url:
        player_url = args.player_url
    else:
        parser.error("Provide player_url or --media-key.")

    hosts = {h.lower().strip().rstrip("/") for h in args.allowed_host if h.strip()}
    base_host = (urlparse(args.base_url).hostname or "").lower()
    if base_host:
        hosts.add(base_host)
    if not hosts:
        parser.error("Provide --allowed-host or a valid --base-url.")

    stream = extract_stream(
        player_url,
        hosts,
        timeout_ms=max(1000, args.timeout_ms),
        headed=args.headed,
        iframe_depth=max(0, args.iframe_depth),
    )
    if not stream:
        print("[-] No playable direct media manifest/file was observed.")
        return 1

    print(f"[+] Source type: {stream['type']}")
    print(f"[+] Source URL: {stream['url']}")

    if args.media_key:
        save_stream_map(args.media_key, stream, args.streams_file)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
