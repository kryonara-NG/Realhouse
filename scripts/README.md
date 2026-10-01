# Realhouse scripts

## Catalog import

`import_scrapper.py` imports catalog/page-link output from the Scrapper project. It does not extract or download video streams.

## Local HLS stream utility

`vidsrc_stream.py` is a local Playwright + FFmpeg utility for inspecting an authorized player URL and capturing an HLS playlist.

Install the Python dependencies, install Chromium once, then run:

```bash
python -m pip install -r backend/requirements.txt
npm run vidsrc:setup
python scripts/vidsrc_stream.py "https://example.com/player" -o ./tmp/movie.mp4
```

Or:

```bash
npm run vidsrc:extract -- "https://example.com/player" -o ./tmp/movie.mp4
```

Requirements:
- Python 3.10+
- Playwright Chromium
- FFmpeg available on PATH

The utility is intentionally local. The Vite/Vercel frontend does not launch a browser or FFmpeg process.
Use it only with media you are authorized to access/download.
