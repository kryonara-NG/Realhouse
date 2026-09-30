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
