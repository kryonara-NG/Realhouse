// Client-safe application configuration.
// TMDB and MovieBox credentials stay on the server.
// VITE_API_URL points the browser at the deployed backend when the frontend
// itself is hosted separately (for example, Vercel static + Vercel API).
export const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const TMDB_READ_TOKEN = "";
