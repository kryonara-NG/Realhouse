# Realhouse scripts

## Catalog import

`import_scrapper.py` imports catalog/page-link output from the Scrapper project. It does not extract or download video streams.

## First-party video extractor

`vidsrc_stream.py` is now a generic local Playwright + FFmpeg utility for inspecting a player domain you own or are authorized to access.

The default player base URL is:

```
https://vidsrcme.ru
```

It supports these media keys:

```
movie:12345
tv:12345:1:3
```

Those become:

```
https://vidsrcme.ru/embed/movie/12345
https://vidsrcme.ru/embed/tv/12345/1/3
```

Install the Python dependencies and Chromium once:

```bash
python -m pip install -r backend/requirements.txt
npm run vidsrc:setup
```

### Extract and wire a movie

```bash
python scripts/vidsrc_stream.py \
  --media-key movie:12345 \
  --no-download
```

### Extract and wire a TV episode

```bash
python scripts/vidsrc_stream.py \
  --media-key tv:12345:1:3 \
  --no-download
```

The captured source is written to:

```
public/vidsrc-streams.json
```

The existing Reelhouse resolver reads that map and sends the returned direct MP4/video or HLS source to the custom player.

### Save an authorized source locally

```bash
python scripts/vidsrc_stream.py \
  --media-key movie:12345 \
  -o ./tmp/movie.mp4
```

The extractor observes normal browser network requests. It can capture direct video files such as MP4/WebM/M4V/OGV and HLS `.m3u8` playlists. It does not bypass DRM, authentication, paywalls, or other access controls.

Requirements:
- Python 3.10+
- Playwright Chromium
- FFmpeg available on PATH

Run it again when an authorized source URL expires.
