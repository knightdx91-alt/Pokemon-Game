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

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
from pydantic import BaseModel
import yt_dlp

ACCESS_KEY = os.environ.get("ACCESS_KEY", "").strip()
DEFAULT_COOKIES = os.environ.get("YT_COOKIES", "")
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
    """Write cookies (Netscape format) to a temp file; return its path or None."""
    cookies = (cookies or DEFAULT_COOKIES or "").strip()
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
        + ("Access key REQUIRED (X-Access-Key).\n" if ACCESS_KEY else "No access key set (open).\n")
    )


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
