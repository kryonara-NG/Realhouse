#!/usr/bin/env python3
"""Authorized first-party video source extractor for Realhouse.

Opens a Realhouse-compatible embed URL with Playwright and captures the first
direct media request (.mp4/.webm/.m4v/.ogv) or HLS playlist (.m3u8).

The extractor is intentionally generic: point it at a player domain you own
or are authorized to inspect, such as https://pl.realhouse.stream.

It does not bypass DRM, authentication, paywalls, or access controls.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


VIDEO_EXTENSIONS = (".mp4", ".webm", ".m4v", ".ogv")


def build_player_url(base_url: str, media_key: str) -> str:
    """Turn movie:ID or tv:ID:season:episode into an embed URL."""
    base = base_url.rstrip("/")

    parts = media_key.split(":")
    if len(parts) == 2 and parts[0] == "movie":
        return f"{base}/embed/movie/{parts[1]}"

    if len(parts) == 4 and parts[0] == "tv":
        _, show_id, season, episode = parts
        return f"{base}/embed/tv/{show_id}/{season}/{episode}"

    raise ValueError(
        "Invalid media key. Use movie:ID or tv:ID:SEASON:EPISODE."
    )


def extract_stream(player_url: str, timeout_ms: int = 10_000) -> Optional[dict]:
    """Capture the first direct media or HLS request from an authorized player."""
    captured: Optional[dict] = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        def capture(request) -> None:
            nonlocal captured

            if captured is not None:
                return

            url = request.url
            lower = url.lower().split("?", 1)[0]

            if ".m3u8" in lower:
                captured = {
                    "url": url,
                    "type": "hls",
                    "source": "first-party-extracted",
                }
                print(f"[+] Captured HLS playlist: {url}")
                return

            if lower.endswith(VIDEO_EXTENSIONS):
                captured = {
                    "url": url,
                    "type": "mp4" if lower.endswith(".mp4") else "video",
                    "source": "first-party-extracted",
                }
                print(f"[+] Captured direct video: {url}")

        page.on("request", capture)

        print(f"[*] Loading player: {player_url}")
        page.goto(player_url, wait_until="domcontentloaded", timeout=30_000)

        # Give the player time to initialize and request its media.
        try:
            page.wait_for_timeout(2_000)

            # Trigger common custom-player implementations without assuming
            # a particular UI framework.
            for selector in (
                "video",
                "[aria-label*='play' i]",
                "button",
                "body",
            ):
                try:
                    locator = page.locator(selector).first
                    locator.click(timeout=1_000)
                    break
                except Exception:
                    continue
        except Exception:
            pass

        page.wait_for_timeout(timeout_ms)
        browser.close()

    return captured


def save_stream_map(media_key: str, stream: dict, streams_file: str) -> None:
    """Persist the captured source for the Reelhouse frontend player."""
    path = Path(streams_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    try:
        payload = (
            json.loads(path.read_text(encoding="utf-8"))
            if path.exists()
            else {}
        )
        if not isinstance(payload, dict):
            payload = {}
    except (OSError, json.JSONDecodeError):
        payload = {}

    payload[media_key] = stream
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[+] Wired source to Reelhouse key: {media_key}")


def download_hls(
    stream_url: str,
    output_path: str,
    referer_url: str,
) -> None:
    """Download an authorized HLS source with FFmpeg."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-headers",
        f"Referer: {referer_url}\r\n",
        "-i",
        stream_url,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        str(output),
    ]

    print("[*] Passing captured HLS source to FFmpeg...")
    subprocess.run(command, check=True)
    print(f"[==>] Saved: {output}")


def download_direct(stream_url: str, output_path: str, referer_url: str) -> None:
    """Use FFmpeg to save an authorized direct video file."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-headers",
        f"Referer: {referer_url}\r\n",
        "-i",
        stream_url,
        "-c",
        "copy",
        str(output),
    ]

    print("[*] Saving captured direct video with FFmpeg...")
    subprocess.run(command, check=True)
    print(f"[==>] Saved: {output}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Realhouse first-party video extractor"
    )
    parser.add_argument(
        "player_url",
        nargs="?",
        help="Full authorized player/embed URL.",
    )
    parser.add_argument(
        "--base-url",
        default="https://pl.realhouse.stream",
        help="Your player domain used with --media-key.",
    )
    parser.add_argument(
        "--media-key",
        help="movie:ID or tv:ID:SEASON:EPISODE.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Optional local output file.",
    )
    parser.add_argument(
        "--streams-file",
        default="public/vidsrc-streams.json",
        help="Frontend source map written after extraction.",
    )
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Only capture and wire the source; do not save a local copy.",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=10_000,
        help="Additional wait time after player interaction.",
    )
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

    stream = extract_stream(player_url, args.timeout_ms)
    if not stream:
        print("[-] No direct video or HLS source was observed.")
        return 1

    print(f"[+] Source type: {stream['type']}")
    print(f"[+] Source URL: {stream['url']}")

    if args.media_key:
        save_stream_map(args.media_key, stream, args.streams_file)

    if args.no_download or not args.output:
        return 0

    try:
        if stream["type"] == "hls":
            download_hls(stream["url"], args.output, player_url)
        else:
            download_direct(stream["url"], args.output, player_url)
    except FileNotFoundError:
        print("[-] FFmpeg is not installed or is not on PATH.")
        return 2
    except subprocess.CalledProcessError as exc:
        print(f"[-] FFmpeg failed with exit code {exc.returncode}.")
        return exc.returncode or 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
