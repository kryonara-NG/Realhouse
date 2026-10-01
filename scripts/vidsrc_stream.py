#!/usr/bin/env python3
"""Local VidSrc HLS stream inspector/downloader for Realhouse.

This utility runs outside the Vite frontend. It opens the supplied player URL
with Playwright, captures the first HLS playlist request, and can pass that
playlist to FFmpeg.

Use only with media you are authorized to access/download.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path
from typing import Optional
import json

from playwright.sync_api import sync_playwright


def extract_stream(player_url: str, timeout_ms: int = 10_000) -> Optional[str]:
    """Open a player URL and return the first observed HLS playlist URL."""
    m3u8_url: Optional[str] = None

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
            nonlocal m3u8_url
            url = request.url
            if m3u8_url is None and ".m3u8" in url.lower():
                print(f"[+] Captured HLS playlist: {url}")
                m3u8_url = url

        page.on("request", capture)
        print(f"[*] Loading player: {player_url}")
        page.goto(player_url, wait_until="domcontentloaded", timeout=30_000)

        try:
            page.wait_for_timeout(3_000)
            page.locator("body").click(position={"x": 10, "y": 10}, timeout=2_000)
        except Exception:
            pass

        page.wait_for_timeout(timeout_ms)
        browser.close()

    return m3u8_url


def save_stream_map(media_key: str, stream_url: str, streams_file: str) -> None:
    """Persist the captured URL for the Reelhouse frontend player."""
    path = Path(streams_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if not isinstance(payload, dict):
            payload = {}
    except (OSError, json.JSONDecodeError):
        payload = {}
    payload[media_key] = {"url": stream_url, "type": "hls", "source": "vidsrc-extracted"}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[+] Wired HLS stream to Reelhouse key: {media_key}")

def download_hls(
    m3u8_url: str,
    output_path: str,
    referer_url: str,
) -> None:
    """Download an authorized HLS stream using FFmpeg."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "ffmpeg",
        "-y",
        "-headers",
        f"Referer: {referer_url}\r\n",
        "-i",
        m3u8_url,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        str(output),
    ]

    print("[*] Passing captured HLS playlist to FFmpeg...")
    subprocess.run(command, check=True)
    print(f"[==>] Saved: {output}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Realhouse HLS stream utility")
    parser.add_argument("player_url", help="Player/embed URL to inspect")
    parser.add_argument(
        "-o",
        "--output",
        default="vidsrc_movie.mp4",
        help="Output MP4 path. If omitted, only the captured playlist is printed.",
    )
    parser.add_argument(
        "--media-key",
        help="Reelhouse source key, e.g. movie:550 or tv:1399:1:1",
    )
    parser.add_argument(
        "--streams-file",
        default="public/vidsrc-streams.json",
        help="Frontend stream map written after extraction.",
    )
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Only wire the captured stream into Reelhouse; do not run FFmpeg.",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=10_000,
        help="Additional wait time after page interaction.",
    )
    args = parser.parse_args()

    stream_url = extract_stream(args.player_url, args.timeout_ms)
    if not stream_url:
        print("[-] No HLS playlist was observed.")
        return 1

    print(f"[+] Stream URL: {stream_url}")
    if args.media_key:
        save_stream_map(args.media_key, stream_url, args.streams_file)
    if args.no_download:
        return 0
    if args.output:
        try:
            download_hls(stream_url, args.output, args.player_url)
        except FileNotFoundError:
            print("[-] FFmpeg is not installed or is not on PATH.")
            return 2
        except subprocess.CalledProcessError as exc:
            print(f"[-] FFmpeg failed with exit code {exc.returncode}.")
            return exc.returncode or 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
