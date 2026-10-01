import { onRequestGet } from "./functions/api/moviebox-internal/stream.js";

const API_PATH = "/api/moviebox-internal/stream";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === API_PATH) {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ status: "error", message: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      }

      return onRequestGet({
        request,
        env,
        params: {},
        waitUntil: ctx.waitUntil.bind(ctx)
      });
    }

    return env.ASSETS.fetch(request);
  }
};
