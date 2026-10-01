# Cloudflare Worker deployment

Reelhouse is configured for the Cloudflare **Workers** deployment flow used by the current Cloudflare create screen.

## Build settings

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`
- Wrangler config: `wrangler.toml`
- Worker entrypoint: `worker.js`
- Static assets: `dist/`

The Worker serves the Vite application from `dist/` and routes `/api/moviebox-internal/stream` to the native MovieBox resolver.

## Environment variables

Configure these as Worker environment variables/secrets in Cloudflare:

- `MOVIEBOX_INTERNAL_BASE_URL` (optional; defaults to `https://apig.inmoviebox.com`)
- `MOVIEBOX_GATEWAY_SECRET` (required secret)
- `MOVIEBOX_APP_ID` (optional; default is the authorized app id used by the integration)
- `MOVIEBOX_REGION` (optional; default `NG`)
- `MOVIEBOX_LANG` (optional; default `en`)
- `MOVIEBOX_GUEST_TOKEN` (optional)

Do not expose `MOVIEBOX_GATEWAY_SECRET` through a `VITE_*` variable.

## Local verification

```bash
npm ci
npm run build
npx wrangler dev
```

The Worker deployment is intentionally separate from the Cloudflare Pages Functions directory so the same MovieBox resolver can also be used by Pages-compatible deployments.
