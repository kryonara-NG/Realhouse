# Reelhouse

Faithful React/Vite conversion of the supplied Reelhouse single-file HTML app.

## Web
- `npm install`
- `npm run dev`
- `npm run build`
- Deploy the Vite output to Vercel/Netlify.
- Enter a TMDB v3 API key or v4 read token on first launch.

## Android
1. `npm install`
2. `npm run cap:add:android` (first time only)
3. `npm run cap:sync`
4. `npm run cap:open:android` and build the APK in Android Studio, or run `npm run cap:build:android`.

Capacitor is configured with `server.androidScheme = "https"`.

## Sources
Movie metadata and trailers use TMDB and YouTube as in the original HTML. Free-film discovery/playback/downloads use Internet Archive as in the original HTML.

## PWA
The same web build includes a manifest, service worker and installable app shell.
