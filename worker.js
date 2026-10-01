import { onRequestGet as onMovieboxGet } from "./functions/api/moviebox-internal/stream.js";
import { onRequestGet as onTmdbGet } from "./functions/api/tmdb.js";

const API_PATH = "/api/moviebox-internal/stream";
const TMDB_PATH = "/api/tmdb/";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === TMDB_PATH.slice(0, -1) || url.pathname.startsWith(TMDB_PATH)) {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ status: "error", message: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      }
      return onTmdbGet({ request, env, params: {}, waitUntil: ctx.waitUntil.bind(ctx) });
    }

    if (url.pathname === API_PATH) {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ status: "error", message: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      }

      return onMovieboxGet({
        request,
        env,
        params: {},
        waitUntil: ctx.waitUntil.bind(ctx)
      });
    }

    return env.ASSETS.fetch(request);
  }
};
