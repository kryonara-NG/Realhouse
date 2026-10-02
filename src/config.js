// Client-safe application configuration.
// TMDB and MovieBox credentials stay on the server.
// VITE_API_URL points the browser at the deployed backend when the frontend
// itself is hosted separately (for example, Vercel static + Vercel API).
//
// VITE_CATALOG_API_URL may override the public Cloudflare D1 catalog Worker.
// The default keeps movie discovery/search on the imported Kaggle catalog
// without requiring the browser to call the TMDB API for movie catalog data.
export const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const CATALOG_API_BASE = String(
  import.meta.env.VITE_CATALOG_API_URL ||
  "https://realhouse-tmdb-catalog.kryonara-product.workers.dev"
).replace(/\/$/, "");
export const TMDB_READ_TOKEN = "";
