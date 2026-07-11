"""
RetroPlay media backend — turns a video link (YouTube, etc.) into an MP4 or MP3.

This is the piece that GitHub Pages cannot run. It wraps yt-dlp (extraction) and
ffmpeg (mux / audio conversion) behind a tiny HTTP API that the hub's media.html
page calls. It sets permissive CORS headers so the browser can fetch the result
directly, then media.html uploads the blob to the user's Google Drive.

Endpoints
  GET  /            -> health check / banner
  GET  /api/info    -> { title, duration, thumbnail, uploader } for a URL
  POST /api/download-> body { url, format: "mp3"|"mp4", cookies?: "<netscape txt>" }
                       streams back the media file with a Content-Disposition name

Environment
  ACCESS_KEY   optional shared secret. If set, every request must send it as the
               "X-Access-Key" header (or ?key= query param). Lock the service
               down so randoms can't burn your free tier.
  YT_COOKIES   optional default cookies (Netscape format) used when a request
               doesn't supply its own. Helps with age/bot-gated videos.
"""

import os
import re
import shutil
import tempfile
import contextlib
import urllib.request
import urllib.error

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
from pydantic import BaseModel
import yt_dlp

ACCESS_KEY = os.environ.get("ACCESS_KEY", "").strip()
DEFAULT_COOKIES = os.environ.get("YT_COOKIES", "")
# Cookies pushed at runtime via POST /api/set-cookies are persisted here so all
# devices share them (survives until the free instance restarts/redeploys, at
# which point just push again). Falls back to the YT_COOKIES env var.
STORED_COOKIES_PATH = os.environ.get("STORED_COOKIES_PATH", "/tmp/yt_cookies.txt")


def _load_stored_cookies() -> str:
    with contextlib.suppress(OSError):
        with open(STORED_COOKIES_PATH) as f:
            return f.read()
    return ""
# YouTube blocks datacenter IPs with "confirm you're not a bot". Requesting via
# certain internal player clients often slips past that without any login.
# Override the order with YT_PLAYER_CLIENTS (comma-separated) if YouTube shifts.
PLAYER_CLIENTS = [
    c.strip() for c in
    os.environ.get("YT_PLAYER_CLIENTS", "android,ios,tv,web_safari,default").split(",")
    if c.strip()
]

app = FastAPI(title="RetroPlay media backend")

# Permissive CORS: the hub is a static site on github.io, so we can't predict the
# exact origin and there's no credentialed state to protect. The ACCESS_KEY is the
# real gate.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_key(request: Request):
    if not ACCESS_KEY:
        return
    supplied = request.headers.get("x-access-key") or request.query_params.get("key")
    if supplied != ACCESS_KEY:
        raise HTTPException(status_code=401, detail="Bad or missing access key")


def _safe_name(s: str, fallback: str = "media") -> str:
    s = re.sub(r"[^\w\-. ]", "_", (s or "").strip())
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120] or fallback


def _base_opts():
    """Shared yt-dlp options, incl. the player-client bypass for YouTube."""
    return {
        "quiet": True,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": PLAYER_CLIENTS}},
    }


def _cookiefile(cookies: str):
    """Write cookies (Netscape format) to a temp file; return its path or None.

    Priority: per-request cookies > server-stored cookies > YT_COOKIES env var.
    """
    cookies = (cookies or _load_stored_cookies() or DEFAULT_COOKIES or "").strip()
    if not cookies:
        return None
    fd, path = tempfile.mkstemp(suffix=".txt", prefix="cookies_")
    with os.fdopen(fd, "w") as f:
        if not cookies.startswith("# Netscape"):
            f.write("# Netscape HTTP Cookie File\n")
        f.write(cookies + "\n")
    return path


@app.get("/")
def root():
    return PlainTextResponse(
        "RetroPlay media backend is running.\n"
        "POST /api/download  body {url, format:'mp3'|'mp4', cookies?}\n"
        "GET  /api/info?url=...\n"
        "GET  /api/playlist?url=...  (flat list of playlist entries)\n"
        "GET  /api/stream?url=...&kind=audio|video  (proxied on-demand playback)\n"
        + ("Access key REQUIRED (X-Access-Key).\n" if ACCESS_KEY else "No access key set (open).\n")
    )


class CookiesBody(BaseModel):
    cookies: str


@app.post("/api/set-cookies")
def set_cookies(request: Request, body: CookiesBody):
    """Store cookies server-side so every device shares them. Protected by key."""
    _check_key(request)
    data = (body.cookies or "").strip()
    if not data:
        # empty body clears stored cookies
        with contextlib.suppress(OSError):
            os.remove(STORED_COOKIES_PATH)
        return {"stored": False, "length": 0}
    if not data.startswith("# Netscape"):
        data = "# Netscape HTTP Cookie File\n" + data
    with open(STORED_COOKIES_PATH, "w") as f:
        f.write(data + "\n")
    return {"stored": True, "length": len(data)}


@app.get("/api/cookies-status")
def cookies_status(request: Request):
    _check_key(request)
    stored = _load_stored_cookies()
    return {"stored": bool(stored.strip()), "length": len(stored), "env_fallback": bool(DEFAULT_COOKIES)}


@app.get("/api/info")
def info(request: Request, url: str):
    _check_key(request)
    cf = _cookiefile("")
    opts = _base_opts()
    opts["skip_download"] = True
    if cf:
        opts["cookiefile"] = cf
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info(url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read link: {e}")
    finally:
        if cf:
            with contextlib.suppress(OSError):
                os.remove(cf)
    return JSONResponse({
        "title": d.get("title"),
        "duration": d.get("duration"),
        "thumbnail": d.get("thumbnail"),
        "uploader": d.get("uploader") or d.get("channel"),
        "extractor": d.get("extractor_key"),
    })


@app.get("/api/playlist")
def playlist(request: Request, url: str):
    """Flat-enumerate a playlist (or a channel/mix) → list of entries.

    Returns {title, count, entries:[{id, url, title, duration, uploader}]}.
    Uses extract_flat so it's fast (no per-video resolution). The frontend
    then downloads each entry.url one at a time via /api/download.
    """
    _check_key(request)
    cf = _cookiefile("")
    opts = _base_opts()
    opts["noplaylist"] = False
    opts["extract_flat"] = "in_playlist"
    opts["skip_download"] = True
    if cf:
        opts["cookiefile"] = cf
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info(url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read playlist: {e}")
    finally:
        if cf:
            with contextlib.suppress(OSError):
                os.remove(cf)

    raw = d.get("entries")
    if raw is None:
        # A single video link — treat it as a one-item playlist.
        raw = [d]
    entries = []
    for e in raw:
        if not e:
            continue
        vid = e.get("id")
        u = e.get("url") or e.get("webpage_url")
        if u and not str(u).startswith("http"):
            # extract_flat gives bare ids for YouTube entries.
            u = "https://www.youtube.com/watch?v=" + str(vid or u)
        entries.append({
            "id": vid,
            "url": u,
            "title": e.get("title"),
            "duration": e.get("duration"),
            "uploader": e.get("uploader") or e.get("channel"),
        })
    return JSONResponse({
        "title": d.get("title") or d.get("id"),
        "count": len(entries),
        "entries": entries,
    })


def _resolve_stream(url: str, kind: str):
    """Resolve a single directly-playable progressive stream (URL + headers).

    kind 'audio' -> a single-file audio track (m4a itag 140 etc.) so it plays
    in a plain <audio>/<video> and supports HTTP Range (seeking + background).
    kind 'video' -> a progressive muxed mp4 (itag 18/22) — one URL with both
    audio & video, so no server-side muxing is needed and it streams instantly.
    """
    cf = _cookiefile("")
    opts = _base_opts()
    opts["skip_download"] = True
    if kind == "audio":
        opts["format"] = "bestaudio[ext=m4a]/bestaudio[protocol^=https]/bestaudio"
    else:
        opts["format"] = ("best[ext=mp4][acodec!=none][vcodec!=none]"
                          "/best[acodec!=none][vcodec!=none]/18/22")
    if cf:
        opts["cookiefile"] = cf
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info(url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not resolve stream: {e}")
    finally:
        if cf:
            with contextlib.suppress(OSError):
                os.remove(cf)
    if d.get("entries"):          # playlist link -> first item
        d = d["entries"][0]
    # extract_info with a chosen "format" fills top-level url; fall back to
    # scanning requested_formats / formats for a progressive one.
    direct = d.get("url")
    headers = d.get("http_headers") or {}
    ext = d.get("ext") or ("m4a" if kind == "audio" else "mp4")
    if not direct and d.get("requested_formats"):
        f = d["requested_formats"][0]
        direct = f.get("url"); headers = f.get("http_headers") or headers; ext = f.get("ext") or ext
    if not direct:
        raise HTTPException(status_code=400, detail="No progressive stream available for this link.")
    mime = "audio/mp4" if ext in ("m4a", "mp4a") and kind == "audio" else \
           ("audio/webm" if kind == "audio" else "video/mp4")
    return direct, headers, mime


@app.get("/api/stream")
def stream(request: Request, url: str, kind: str = "audio"):
    """YMusic-style on-demand playback: resolve YouTube's own stream and proxy
    it (forwarding the browser's Range header) so it plays instantly in the
    native player — background + PiP + lock-screen — with no full download."""
    _check_key(request)
    kind = "video" if kind == "video" else "audio"
    direct, up_headers, mime = _resolve_stream(url, kind)

    # Forward Range so <video>/<audio> can seek; googlevideo requires the
    # original request headers (User-Agent etc.).
    fwd = dict(up_headers)
    rng = request.headers.get("range")
    if rng:
        fwd["Range"] = rng
    req = urllib.request.Request(direct, headers=fwd)
    try:
        up = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code in (206, 200):
            up = e
        else:
            raise HTTPException(status_code=502, detail=f"Upstream {e.code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e}")

    status = up.status if hasattr(up, "status") else 200
    out_headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    for h in ("Content-Range", "Content-Length"):
        v = up.headers.get(h)
        if v:
            out_headers[h] = v

    def gen():
        try:
            while True:
                chunk = up.read(262144)
                if not chunk:
                    break
                yield chunk
        finally:
            with contextlib.suppress(Exception):
                up.close()

    return StreamingResponse(gen(), status_code=status, media_type=mime, headers=out_headers)


@app.get("/api/stream-url")
def stream_url(request: Request, url: str, kind: str = "audio"):
    """Return the resolved direct stream URL (no proxy). Faster/cheaper, but the
    googlevideo URL is usually IP-locked to this server, so playback via it from
    a browser may 403 — /api/stream (proxied) is the reliable path."""
    _check_key(request)
    kind = "video" if kind == "video" else "audio"
    direct, _h, mime = _resolve_stream(url, kind)
    return JSONResponse({"url": direct, "mime": mime})


class DownloadBody(BaseModel):
    url: str
    format: str = "mp4"          # "mp4" or "mp3"
    cookies: str | None = None


@app.post("/api/download")
def download(request: Request, body: DownloadBody):
    _check_key(request)
    fmt = (body.format or "mp4").lower()
    if fmt not in ("mp3", "mp4"):
        raise HTTPException(status_code=400, detail="format must be 'mp3' or 'mp4'")

    workdir = tempfile.mkdtemp(prefix="rp_dl_")
    cf = _cookiefile(body.cookies or "")

    opts = _base_opts()
    opts["outtmpl"] = os.path.join(workdir, "%(title)s.%(ext)s")
    opts["restrictfilenames"] = False
    if cf:
        opts["cookiefile"] = cf

    if fmt == "mp3":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
    else:  # mp4
        opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        opts["merge_output_format"] = "mp4"

    def cleanup():
        shutil.rmtree(workdir, ignore_errors=True)
        if cf:
            with contextlib.suppress(OSError):
                os.remove(cf)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(body.url, download=True)
            title = data.get("title") or "media"
    except Exception as e:
        cleanup()
        raise HTTPException(status_code=400, detail=f"Download failed: {e}")

    # Find the produced file (postprocessing changes the extension).
    produced = None
    for f in os.listdir(workdir):
        if f.lower().endswith("." + fmt):
            produced = os.path.join(workdir, f)
            break
    if not produced:
        files = os.listdir(workdir)
        if not files:
            cleanup()
            raise HTTPException(status_code=500, detail="No output file produced")
        produced = os.path.join(workdir, files[0])

    out_name = _safe_name(title) + "." + fmt
    media_type = "audio/mpeg" if fmt == "mp3" else "video/mp4"
    return FileResponse(
        produced,
        media_type=media_type,
        filename=out_name,
        background=BackgroundTask(cleanup),
    )
