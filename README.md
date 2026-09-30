# Real House — Video Player

Fast React + Vite video workspace with responsive playback, local files, direct video URLs, YouTube embeds, local history, and an optional Python FastAPI trailer-search service.

## Run

```bash
npm install
npm run dev
```

For online trailer search, run the Python API:

```bash
cd backend
python -m venv .venv
# activate the environment, then:
pip install -r requirements.txt
export YOUTUBE_API_KEY="your_youtube_data_api_key"
python main.py
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

## Vercel

Deploy the frontend as a Vite project with build command `npm run build` and output directory `dist`. The Python API is a separate service; set `VITE_SEARCH_API_URL` to its public origin.

## Mobile

Real House is mobile-first and includes a Progressive Web App shell. **Me → Download app** uses the browser install prompt when available, otherwise it gives Android Add to Home screen instructions. The build target is Chrome 49 for improved older-browser compatibility.

Android 5 support here means the web/PWA experience when the installed browser supports the required web-app APIs. This repository does not contain a signed native APK/AAB.

## Playback

Direct URLs must be actual browser-playable media resources. YouTube results use YouTube's embedded player. The app does not bypass DRM, paywalls, access controls, or download restrictions.
