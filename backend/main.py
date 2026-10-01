"""Optional Python search API for YouTube trailers.

Set YOUTUBE_API_KEY in the environment. This uses YouTube Data API v3 and returns
embeddable video links; it does not download or re-host copyrighted media.
"""
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Real House Search API", version="1.0.0")
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
