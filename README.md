# Reelhouse

Faithful React/Vite conversion of the supplied Reelhouse single-file HTML app.

## Web
- `npm install`
- `npm run dev`
- `npm run build`
- Deploy the Vite output to Vercel/Netlify.
- TMDB uses the configured application Read Access Token automatically; there is no first-launch API-key setup screen.
- Browsing is public, but trailers/full playback require a Reelhouse account login.

## Android
1. `npm install`
2. `npm run cap:add:android` (first time only)
3. `npm run cap:sync`
4. `npm run cap:open:android` and build the APK in Android Studio, or run `npm run cap:build:android`.

Capacitor is configured with `server.androidScheme = "https"`.

## Sources
Movie metadata and trailers use TMDB and YouTube as in the original HTML. Free-film discovery/playback/downloads use Internet Archive as in the original HTML.

## Downloads
- Internet Archive movie files use the browser's native download flow; the download URL is also saved under Me → Downloads for retrying.
- The Android app link points to the stable GitHub `releases/latest/download/Reelhouse.apk` address so a published latest release replaces the file without changing the app UI.

## PWA
The same web build includes a manifest, service worker and installable app shell.


### Search UI update
- Compact search filters, live suggestions, mixed movie/series discovery, anime browsing, and series season/episode navigation are enabled.


<!-- Vercel deployment includes the custom HLS playback wiring. -->
