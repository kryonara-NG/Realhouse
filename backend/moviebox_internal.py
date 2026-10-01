"""MovieBox internal playback adapter for Realhouse.

The implementation follows the public integration structure documented by:
https://github.com/solo12345689/moviebox-internal-api
and the native Media3 client in:
https://github.com/solo12345689/Genga-World

Important: this adapter only consumes the stream URLs returned by the
play-info API. It does not implement anti-piracy dummy-video bypasses,
geo-lock bypasses, CAPTCHA/Turnstile bypasses, or DRM circumvention.
"""

import base64
import hashlib
import hmac
import json
import os
import random
import time
from urllib.parse import parse_qsl, urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from fastapi import HTTPException, Query
from fastapi.responses import JSONResponse

MOVIEBOX_BASE_URL = os.getenv("MOVIEBOX_INTERNAL_BASE_URL", "https://apig.inmoviebox.com").rstrip("/")
MOVIEBOX_GATEWAY_SECRET = os.getenv(
    "MOVIEBOX_GATEWAY_SECRET",
    "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O",
)
MOVIEBOX_APP_ID = os.getenv("MOVIEBOX_APP_ID", "4U01pxRu278GqCZKY9")
MOVIEBOX_REGION = os.getenv("MOVIEBOX_REGION", "NG")
MOVIEBOX_LANG = os.getenv("MOVIEBOX_LANG", "en")

_moviebox_token = os.getenv("MOVIEBOX_GUEST_TOKEN", "")


def _md5(value: str) -> str:
    return hashlib.md5(value.encode("utf-8")).hexdigest()


def _client_token() -> str:
    ts = str(int(time.time() * 1000))
    return f"{ts},{_md5(ts[::-1])}"


def _client_info() -> dict:
    return {
        "package_name": "com.community.oneroom",
        "version_name": "4.0.02",
        "version_code": 50020126,
        "os": "android",
        "os_version": "14",
        "install_ch": "ps",
        "device_id": "86820305" + "".join(random.choices("0123456789", k=7)),
        "install_store": "ps",
        "gaid": "",
        "brand": "Google",
        "model": "Pixel 6",
        "system_language": "en",
        "net": "wifi",
        "region": MOVIEBOX_REGION,
        "timezone": os.getenv("TZ", "Africa/Lagos"),
        "sp_code": "404",
    }


def _signature(method: str, url: str, body: str, timestamp: int) -> str:
    parsed = urlparse(url)
    pairs = sorted(parse_qsl(parsed.query, keep_blank_values=True), key=lambda x: x[0])
    query = "&".join(f"{k}={v}" for k, v in pairs)
    resource = f"{parsed.path}?{query}" if query else parsed.path
    body_md5 = _md5(body[:102400]) if body else ""
    canonical = "\n".join(
        [
            method.upper(),
            "application/json",
            "application/json;charset=UTF-8",
            str(len(body)) if body else "",
            str(timestamp),
            body_md5,
            resource,
        ]
    )
    try:
        key = base64.b64decode(MOVIEBOX_GATEWAY_SECRET)
    except Exception:
        key = MOVIEBOX_GATEWAY_SECRET.encode("utf-8")
    digest = hmac.new(key, canonical.encode("utf-8"), hashlib.md5).digest()
    return f"{timestamp}|2|{base64.b64encode(digest).decode('ascii')}"


def _request(method: str, path: str, params: dict | None = None, body: dict | None = None):
    global _moviebox_token
    params = dict(params or {})
    params.setdefault("host", urlparse(MOVIEBOX_BASE_URL).netloc)
    body_text = json.dumps(body, separators=(",", ":")) if body is not None else ""
    query = urlencode(params)
    url = f"{MOVIEBOX_BASE_URL}{path}?{query}" if query else f"{MOVIEBOX_BASE_URL}{path}"
    timestamp = int(time.time() * 1000)

    headers = {
        "User-Agent": "MovieBox/4.0.02 (Android 14; Pixel 6)",
        "Accept": "application/json",
        "Content-Type": "application/json;charset=UTF-8",
        "X-M-Version": "4.0.02",
        "X-Sign-Version": "2.0",
        "X-Client-Token": _client_token(),
        "X-Client-Info": json.dumps(_client_info(), separators=(",", ":")),
        "X-Client-Status": "0",
        "X-Play-Mode": "2",
        "appid": MOVIEBOX_APP_ID,
        "region": MOVIEBOX_REGION,
        "lang": MOVIEBOX_LANG,
        "os": "android",
        "X-Timestamp": str(timestamp),
        "x-tr-signature": _signature(method, url, body_text, timestamp),
        "Referer": f"{MOVIEBOX_BASE_URL}/",
    }
    if _moviebox_token:
        headers["Authorization"] = f"Bearer {_moviebox_token}"

    request = Request(
        url,
        headers=headers,
        data=body_text.encode("utf-8") if body_text else None,
        method=method.upper(),
    )
    try:
        with urlopen(request, timeout=18) as response:
            x_user = response.headers.get("x-user") or response.headers.get("X-User")
            if x_user:
                try:
                    _moviebox_token = json.loads(x_user).get("token") or _moviebox_token
                except Exception:
                    pass
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:500]
        raise RuntimeError(f"MovieBox upstream HTTP {exc.code}: {detail}") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"MovieBox upstream unavailable: {exc}") from exc


def _items(payload: dict) -> list:
    data = payload.get("data") or {}
    if isinstance(data, list):
        return data
    return data.get("items") or data.get("list") or data.get("subjects") or []


def _subject_name(subject: dict) -> str:
    return str(
        subject.get("title")
        or subject.get("name")
        or subject.get("subjectName")
        or ""
    ).strip()


def _is_tv(subject: dict) -> bool:
    raw = " ".join(
        str(subject.get(k) or "")
        for k in ("type", "subjectType", "mediaType", "category")
    ).lower()
    return any(x in raw for x in ("tv", "series", "show", "anime"))


def _find_subject(title: str, year: str, media_type: str) -> dict | None:
    # Genga-World documents this MovieBox search route; support both the
    # older GET form and the newer POST form without touching access controls.
    payload = None
    try:
        payload = _request(
            "GET",
            "/wefeed-mobile-bff/subject-api/search",
            {"q": title, "page": 1, "pageSize": 20},
        )
    except Exception:
        payload = _request(
            "POST",
            "/wefeed-mobile-bff/subject-api/search",
            body={"keyword": title, "type": 0, "page": 1, "pageSize": 20},
        )

    candidates = []
    wanted_year = str(year or "")
    want_tv = media_type == "tv"

    for raw in _items(payload):
        subject = raw.get("subject") if isinstance(raw.get("subject"), dict) else raw
        if not isinstance(subject, dict):
            continue
        name = _subject_name(subject)
        if not name:
            continue
        release = str(
            subject.get("releaseDate")
            or subject.get("releaseTime")
            or subject.get("year")
            or ""
        )
        score = 0
        if name.casefold() == title.casefold():
            score += 100
        elif title.casefold() in name.casefold() or name.casefold() in title.casefold():
            score += 40
        if wanted_year and release.startswith(wanted_year):
            score += 20
        if media_type and _is_tv(subject) == want_tv:
            score += 15
        candidates.append((score, subject))

    return max(candidates, key=lambda x: x[0])[1] if candidates else None


def _stream_url(stream: dict) -> str:
    return str(
        stream.get("url")
        or stream.get("streamUrl")
        or stream.get("stream_url")
        or ""
    ).strip()


def _media_type(url: str) -> str | None:
    lower = url.lower().split("?", 1)[0]
    if lower.endswith(".m3u8"):
        return "hls"
    if lower.endswith((".mp4", ".m4v", ".webm", ".ogv")):
        return "mp4"
    return None


def resolve_internal_stream(
    title: str,
    year: str = "",
    media_type: str = "movie",
    season: int = 1,
    episode: int = 1,
):
    subject = _find_subject(title, year, media_type)
    if not subject:
        return None

    subject_id = (
        subject.get("subjectId")
        or subject.get("id")
        or subject.get("subject_id")
    )
    if not subject_id:
        return None

    params = {
        "subjectId": str(subject_id),
        "se": int(season or 1),
        "ep": int(episode or 1),
    }

    play_info = _request(
        "GET",
        "/wefeed-mobile-bff/subject-api/play-info",
        params,
    )
    data = play_info.get("data") or {}
    streams = data.get("streamList") or data.get("streams") or []
    subtitles = data.get("subTitleList") or data.get("subtitles") or []

    normalized = []
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        url = _stream_url(stream)
        kind = _media_type(url)
        if not url or not kind:
            continue
        normalized.append(
            {
                "url": url,
                "type": kind,
                "quality": stream.get("quality") or stream.get("resolution") or "Auto",
                "size": stream.get("size") or "",
                # This is returned as metadata for clients that can legally
                # attach the provider's playback cookie/header.
                "cookie": stream.get("cookie") or stream.get("signCookie") or data.get("signCookie") or "",
            }
        )

    # Prefer H.264/HLS or MP4 over HEVC-looking URLs for browser compatibility.
    normalized.sort(
        key=lambda x: (
            0 if x["type"] == "hls" else 1,
            0 if not any(tag in x["url"].lower() for tag in ("h265", "x265", "hev1")) else 1,
        )
    )

    if not normalized:
        return None

    best = normalized[0]
    return {
        "status": "ready",
        "source": "moviebox-internal",
        "url": best["url"],
        "type": best["type"],
        "quality": best["quality"],
        "subject_id": str(subject_id),
        "title": _subject_name(subject) or title,
        "season": int(season or 1),
        "episode": int(episode or 1),
        "headers": {"Cookie": best["cookie"]} if best["cookie"] else {},
        "subtitles": subtitles,
    }


def register_routes(app):
    @app.get("/api/moviebox-internal/stream")
    def moviebox_internal_stream(
        title: str = Query(min_length=1, max_length=200),
        year: str = "",
        media_type: str = "movie",
        season: int = 1,
        episode: int = 1,
    ):
        try:
            source = resolve_internal_stream(
                title=title,
                year=year,
                media_type=media_type,
                season=season,
                episode=episode,
            )
            if not source:
                return JSONResponse(
                    status_code=404,
                    content={
                        "status": "not_found",
                        "sources": [],
                        "message": "No native MovieBox stream was returned for this title.",
                    },
                )
            return source
        except Exception as exc:
            return JSONResponse(
                status_code=502,
                content={
                    "status": "error",
                    "sources": [],
                    "message": "MovieBox native playback provider failed.",
                    "detail": str(exc)[:300],
                },
            )
