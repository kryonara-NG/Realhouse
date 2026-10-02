"""Optional Python search API for YouTube trailers.

Set YOUTUBE_API_KEY in the environment. This uses YouTube Data API v3 and returns
embeddable video links; it does not download or re-host copyrighted media.
"""
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json

from fastapi import FastAPI, Query, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Real House Search API", version="1.0.0")
# Vercel deployment marker: keep the backend deployment aligned with main.
from backend.moviebox_internal import register_routes as register_moviebox_internal_routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True, "searchConfigured": bool(os.getenv("YOUTUBE_API_KEY"))}


TMDB_API_BASE = "https://api.themoviedb.org/3"


def _tmdb_token():
    # Keep the TMDB credential server-side. VITE_* is accepted only as a
    # backwards-compatible deployment variable; new deployments should use
    # TMDB_READ_TOKEN instead.
    return os.getenv("TMDB_READ_TOKEN") or os.getenv("VITE_TMDB_READ_TOKEN") or ""


@app.get("/api/tmdb/{path:path}")
def tmdb_proxy(path: str, request: FastAPIRequest):
    request_query = request.url.query
    """Proxy public TMDB v3 GET requests so the browser never needs the token."""
    token = _tmdb_token()
    if not token:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "TMDB is not configured on the server. Set TMDB_READ_TOKEN.",
            },
        )

    clean_path = "/" + path.lstrip("/")
    if not clean_path or clean_path == "/":
        return JSONResponse(status_code=400, content={"status": "error", "message": "TMDB path is required."})

    # The upstream host is fixed; callers can only select a TMDB v3 path.
    url = f"{TMDB_API_BASE}{clean_path}"
    if request_query:
        url += "?" + request_query

    req = Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "Reelhouse/1.0",
        },
    )
    try:
        with urlopen(req, timeout=8) as response:
            payload = response.read().decode("utf-8")
            return JSONResponse(
                status_code=response.status,
                content=json.loads(payload),
                headers={"Cache-Control": "public, max-age=60, s-maxage=300"},
            )
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = {"status": "error", "message": "TMDB returned an upstream error."}
        return JSONResponse(status_code=exc.code, content=payload)
    except (URLError, TimeoutError, json.JSONDecodeError):
        return JSONResponse(
            status_code=502,
            content={"status": "error", "message": "Could not reach TMDB. Try again."},
        )

@app.get("/api/search")
def search(q: str = Query(min_length=1, max_length=160)):
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return JSONResponse(status_code=503, content={"results": [], "message": "Online trailer search is not configured yet. Add YOUTUBE_API_KEY to the backend environment."})
    params = urlencode({"part":"snippet","type":"video","videoEmbeddable":"true","maxResults":12,"q":f"{q} trailer","key":api_key,"safeSearch":"moderate"})
    request = Request(f"https://www.googleapis.com/youtube/v3/search?{params}", headers={"Accept":"application/json","User-Agent":"RealHouse/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 403:
            return JSONResponse(status_code=502, content={"results":[],"message":"YouTube search quota or API access is unavailable. Check your API key and quota."})
        return JSONResponse(status_code=502, content={"results":[],"message":"The video search provider returned an error."})
    except (URLError, TimeoutError, json.JSONDecodeError):
        return JSONResponse(status_code=502, content={"results":[],"message":"Could not reach the video search provider. Try again."})
    results = []
    for item in payload.get("items", []):
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId")
        if not video_id:
            continue
        results.append({"title":snippet.get("title","Untitled video"),"subtitle":snippet.get("channelTitle","YouTube"),"url":f"https://www.youtube.com/watch?v={video_id}","youtubeId":video_id,"kind":"youtube","thumbnail":snippet.get("thumbnails",{}).get("high",snippet.get("thumbnails",{}).get("medium",{})).get("url")})
    return {"results":results,"query":q}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT","8000")), reload=True)


# MovieBox-compatible provider integration.
# Based on the MIT-licensed Moviebox-API project:
# https://github.com/walterwhite-69/Moviebox-API
MOVIEBOX_API_BASE = os.getenv("MOVIEBOX_API_BASE", "https://h5-api.aoneroom.com/wefeed-h5api-bff")
MOVIEBOX_SITE = os.getenv("MOVIEBOX_SITE", "moviebox.ph")
_moviebox_token = None

MOVIEBOX_HEADERS = {
    "User-Agent": os.getenv("MOVIEBOX_USER_AGENT", "Mozilla/5.0"),
    "Accept": "application/json",
    "Referer": f"https://{MOVIEBOX_SITE}/",
    "Origin": f"https://{MOVIEBOX_SITE}",
    "X-Request-Lang": "en",
    "Content-Type": "application/json",
}

def _moviebox_request(path, method="GET", payload=None):
    global _moviebox_token
    headers = dict(MOVIEBOX_HEADERS)
    if _moviebox_token:
        headers["Authorization"] = f"Bearer {_moviebox_token}"
    url = f"{MOVIEBOX_API_BASE.rstrip('/')}/{path.lstrip('/')}"
    try:
        req = Request(url, headers=headers, method=method)
        if payload is not None:
            body = json.dumps(payload).encode()
            req = Request(url, headers=headers, data=body, method=method)
        with urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            x_user = response.headers.get("x-user")
            if x_user:
                try:
                    _moviebox_token = json.loads(x_user).get("token") or _moviebox_token
                except json.JSONDecodeError:
                    pass
            return json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"MovieBox provider unavailable: {exc}") from exc

def _moviebox_find_subject(title, year=None, media_type=None):
    data = _moviebox_request("/subject/search", "POST", {"keyword": title, "page": 1, "perPage": 20})
    items = (data.get("data") or {}).get("items") or (data.get("data") or {}).get("list") or []
    wanted_year = str(year or "")
    wanted_tv = media_type == "tv"
    candidates = []
    for item in items:
        sub = item.get("subject") or item
        name = str(sub.get("title") or "").strip()
        if not name:
            continue
        release = str(sub.get("releaseDate") or "")
        is_tv = "tv" in str(sub.get("type") or "").lower() or "series" in str(sub.get("subjectType") or "").lower()
        score = 0
        if name.casefold() == title.casefold(): score += 100
        elif title.casefold() in name.casefold() or name.casefold() in title.casefold(): score += 40
        if wanted_year and release.startswith(wanted_year): score += 20
        if media_type and is_tv == wanted_tv: score += 15
        candidates.append((score, sub))
    if not candidates:
        return None
    return max(candidates, key=lambda x: x[0])[1]

@app.get("/api/moviebox/stream")
def moviebox_stream(title: str = Query(min_length=1, max_length=200), year: str = "", media_type: str = "movie", season: int = 1, episode: int = 1):
    try:
        subject = _moviebox_find_subject(title, year, media_type)
        if not subject:
            return JSONResponse(status_code=404, content={"sources": [], "message": "MovieBox title not found."})
        subject_id = subject.get("subjectId")
        detail_path = subject.get("detailPath")
        if not subject_id or not detail_path:
            return JSONResponse(status_code=404, content={"sources": [], "message": "MovieBox title has no playable entry."})
        domain_data = _moviebox_request("/media-player/get-domain")
        domain = str(domain_data.get("data") or "https://netfilm.world").rstrip("/")
        play_url = f"{domain}/wefeed-h5api-bff/subject/play?subjectId={subject_id}&se={season}&ep={episode}&detailPath={detail_path}"
        player_referer = f"{domain}/spa/videoPlayPage/movies/{detail_path}?id={subject_id}&type=/movie/detail&detailSe={season}&detailEp={episode}&lang=en"
        headers = dict(MOVIEBOX_HEADERS)
        headers["Referer"] = player_referer
        headers["Origin"] = domain
        req = Request(play_url, headers=headers)
        with urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        data = payload.get("data") or {}
        sources = []
        for s in data.get("streams") or []:
            url = s.get("url")
            if url:
                sources.append({"url": url, "format": s.get("format"), "resolution": s.get("resolutions"), "duration": s.get("duration"), "size": s.get("size")})
        for s in data.get("hls") or []:
            url = s.get("url") if isinstance(s, dict) else s
            if url: sources.append({"url": url, "format": "HLS"})
        return {"sources": sources, "has_resource": bool(data.get("hasResource")), "subject_id": subject_id, "detail_path": detail_path, "title": subject.get("title")}
    except RuntimeError as exc:
        return JSONResponse(status_code=502, content={"sources": [], "message": str(exc)})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"sources": [], "message": "MovieBox playback request failed."})

@app.get("/api")
def api_entry(
    route: str = "",
    title: str = Query(default="", max_length=200),
    year: str = "",
    media_type: str = "movie",
    season: int = 1,
    episode: int = 1,
):
    if route != "moviebox-stream":
        return {"ok": True, "service": "Realhouse API"}
    return moviebox_stream(title=title, year=year, media_type=media_type, season=season, episode=episode)


register_moviebox_internal_routes(app)


# Local TMDB dataset catalog (Kaggle import)
# The 1M+ row dataset is intentionally kept outside the frontend bundle.
# Set TMDB_CATALOG_DB to the generated SQLite database path in deployments
# that mount the catalog separately.
import sqlite3
from pathlib import Path

TMDB_CATALOG_DB = os.getenv(
    "TMDB_CATALOG_DB",
    str(Path(__file__).resolve().parent.parent / "data" / "tmdb_catalog.sqlite3"),
)

def _catalog_db():
    path = Path(TMDB_CATALOG_DB)
    if not path.exists():
        return None
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn

def _catalog_row(row):
    if not row:
        return None
    d = dict(row)
    d["release_date"] = d.get("release_date") or ""
    d["genre_names"] = [x.strip() for x in str(d.get("genres") or "").replace("|", ",").split(",") if x.strip()]
    d["media_type"] = "movie"
    return d

@app.get("/api/catalog/health")
def catalog_health():
    db = _catalog_db()
    if not db:
        return {"ok": False, "configured": False, "message": "TMDB catalog database is not mounted. Run the Kaggle import and set TMDB_CATALOG_DB."}
    try:
        count = db.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
        return {"ok": True, "configured": True, "movies": int(count), "source": "Kaggle TMDB Movies Dataset v1076"}
    finally:
        db.close()

@app.get("/api/catalog/search")
def catalog_search(q: str = Query(min_length=1, max_length=160), limit: int = Query(default=24, ge=1, le=100)):
    db = _catalog_db()
    if not db:
        return JSONResponse(status_code=503, content={"results": [], "message": "Local TMDB catalog is not configured."})
    try:
        needle = q.strip()
        rows = db.execute(
            """SELECT id,title,original_title,overview,release_date,vote_average,vote_count,
                      popularity,genres,poster_path,imdb_id,original_language
               FROM movies
               WHERE title LIKE ? COLLATE NOCASE OR original_title LIKE ? COLLATE NOCASE
               ORDER BY popularity DESC, vote_count DESC LIMIT ?""",
            (f"%{needle}%", f"%{needle}%", limit),
        ).fetchall()
        return {"results": [_catalog_row(r) for r in rows], "query": needle, "source": "kaggle-tmdb"}
    finally:
        db.close()

@app.get("/api/catalog/discover")
def catalog_discover(
    genre: str = "",
    year: int | None = Query(default=None, ge=1880, le=2100),
    min_rating: float = Query(default=0, ge=0, le=10),
    sort: str = Query(default="popularity", max_length=30),
    page: int = Query(default=1, ge=1, le=10000),
    limit: int = Query(default=24, ge=1, le=100),
):
    db = _catalog_db()
    if not db:
        return JSONResponse(status_code=503, content={"results": [], "message": "Local TMDB catalog is not configured."})
    try:
        clauses, args = ["vote_average >= ?"], [min_rating]
        if genre:
            genre_aliases = {
                "28": "Action", "12": "Adventure", "16": "Animation", "35": "Comedy",
                "80": "Crime", "99": "Documentary", "18": "Drama", "10751": "Family",
                "14": "Fantasy", "36": "History", "27": "Horror", "10402": "Music",
                "9648": "Mystery", "10749": "Romance", "878": "Science Fiction",
                "10770": "TV Movie", "53": "Thriller", "10752": "War", "37": "Western",
            }
            genre = genre_aliases.get(str(genre), genre)
            clauses.append("genres LIKE ?")
            args.append(f"%{genre}%")
        if year:
            clauses.append("release_date LIKE ?")
            args.append(f"{year}-%")
        order = {
            "rating": "vote_average DESC, vote_count DESC",
            "votes": "vote_count DESC, popularity DESC",
            "newest": "release_date DESC, popularity DESC",
            "popularity": "popularity DESC, vote_count DESC",
        }.get(sort, "popularity DESC, vote_count DESC")
        offset = (page - 1) * limit
        where = " AND ".join(clauses)
        rows = db.execute(
            f"""SELECT id,title,original_title,overview,release_date,vote_average,vote_count,
                       popularity,genres,poster_path,imdb_id,original_language
                FROM movies WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?""",
            (*args, limit, offset),
        ).fetchall()
        total = db.execute(f"SELECT COUNT(*) FROM movies WHERE {where}", args).fetchone()[0]
        return {
            "results": [_catalog_row(r) for r in rows],
            "page": page,
            "total_results": int(total),
            "total_pages": max(1, (int(total) + limit - 1) // limit),
            "source": "kaggle-tmdb",
        }
    finally:
        db.close()
