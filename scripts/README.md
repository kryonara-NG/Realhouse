# Realhouse scripts

## Catalog import

`import_scrapper.py` imports catalog/page-link output from the Scrapper project. It does not extract or download video streams.

## Playwright media extractor

`vidsrc_stream.py` loads an authorized player/embed URL with Chromium and watches normal browser network traffic for playable media. It also inspects dynamically available iframes, `<video>`/`<source>` elements, and inline script configuration for media URLs.

It detects:

- HLS `.m3u8`
- DASH `.mpd`
- MP4/WebM/M4V/OGV

The extractor writes the first discovered playable source to:

```
public/vidsrc-streams.json
```

The Reelhouse resolver already reads that file and hands the returned URL to the native Reelhouse player/HLS.js.

### Install

```bash
python -m pip install -r backend/requirements.txt
npm run vidsrc:setup
```

### Movie

```bash
python scripts/vidsrc_stream.py \
  --media-key movie:12345 \
  --base-url https://vidsrcme.ru \
  --allowed-host vidsrcme.ru
```

### TV episode

```bash
python scripts/vidsrc_stream.py \
  --media-key tv:12345:1:3 \
  --base-url https://vidsrcme.ru \
  --allowed-host vidsrcme.ru
```

### Direct authorized player URL

```bash
python scripts/vidsrc_stream.py \
  "https://your-authorized-player.example/embed/movie/12345" \
  --allowed-host your-authorized-player.example
```

The manifest records the source URL plus the browser Referer/User-Agent metadata observed during discovery. Those values are metadata for server-side use; browser JavaScript cannot freely set forbidden request headers such as `Referer`.

### Debugging

Use `--headed` locally when you need to see what the player is doing:

```bash
python scripts/vidsrc_stream.py \
  --media-key movie:12345 \
  --base-url https://vidsrcme.ru \
  --allowed-host vidsrcme.ru \
  --headed
```

The extractor does not decrypt DRM, extract license keys, bypass authentication, or defeat access controls.
