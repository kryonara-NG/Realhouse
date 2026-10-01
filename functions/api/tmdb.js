const TMDB_BASE = "https://api.themoviedb.org/3";

export async function onRequestGet({ request, env }) {
  const token = env.TMDB_READ_TOKEN || env.VITE_TMDB_READ_TOKEN || "";
  if (!token) {
    return json({ status: "error", message: "TMDB is not configured on the server. Set TMDB_READ_TOKEN." }, 503);
  }

  const incoming = new URL(request.url);
  const prefix = "/api/tmdb";
  const path = incoming.pathname.slice(prefix.length) || "/";
  if (!path.startsWith("/")) {
    return json({ status: "error", message: "Invalid TMDB path." }, 400);
  }

  const upstream = new URL(TMDB_BASE + path);
  upstream.search = incoming.search;

  try {
    const response = await fetch(upstream, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Reelhouse/1.0"
      }
    });

    const body = await response.text();
    const headers = new Headers({
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300"
    });
    return new Response(body, { status: response.status, headers });
  } catch {
    return json({ status: "error", message: "Could not reach TMDB. Try again." }, 502);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
