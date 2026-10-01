# Cloudflare deployment

Realhouse is a Vite app with a Cloudflare Pages Function for native MovieBox stream resolution.

## Cloudflare Pages

Use these project settings:

- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Add these environment variables in **Settings → Environment variables**:

- `MOVIEBOX_INTERNAL_BASE_URL` (optional; defaults to `https://apig.inmoviebox.com`)
- `MOVIEBOX_GATEWAY_SECRET` (required for the signed native MovieBox API)
- `MOVIEBOX_APP_ID` (optional)
- `MOVIEBOX_REGION` (optional; defaults to `NG`)
- `MOVIEBOX_LANG` (optional; defaults to `en`)
- `MOVIEBOX_GUEST_TOKEN` (optional)

The API is exposed at:

`/api/moviebox-internal/stream?title=...&year=...&media_type=movie`

The existing frontend already calls that path, so no Vite-side API URL change is required.

## Local Cloudflare test

`npm run build`

Then install Wrangler and use:

`npx wrangler pages dev dist`

This keeps the playback credential server-side and does not expose the gateway secret as a VITE_* variable.

## Important

The Python FastAPI backend remains available for Vercel/other server deployments. Cloudflare Pages uses the JavaScript Pages Function above because Cloudflare Pages Functions run on the Workers runtime, not CPython.
