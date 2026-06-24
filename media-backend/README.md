# RetroPlay media backend

The small server that makes the hub's **Media Downloader** work. GitHub Pages
can't run code, and a YouTube link isn't a downloadable file — extracting the
real stream (decrypting YouTube's signature cipher) needs `yt-dlp`, and MP3
conversion / MP4 muxing needs `ffmpeg`. This service wraps both behind a tiny
API that `media.html` calls.

## What it does

- `GET /api/info?url=...` — title / duration / thumbnail for a link.
- `POST /api/download` — body `{ url, format: "mp3" | "mp4", cookies? }`;
  streams back the finished file. The browser then uploads it to Google Drive.
- Sets permissive CORS so `media.html` can fetch it directly (no proxy needed).

## Deploy to Render (free tier) — recommended

YouTube blocks many datacenter IPs; **Render** tends to work where Cloudflare
Workers get blocked.

1. Push this repo to GitHub (already done).
2. Go to <https://render.com> → **New → Blueprint** → pick this repo.
   Render reads `media-backend/render.yaml` and builds the Docker image.
3. (Recommended) In the service's **Environment** tab set `ACCESS_KEY` to a long
   random string. Paste the same value into the hub page's **Backend access
   key** field so only you can use it.
4. Deploy. You'll get a URL like `https://retroplay-media.onrender.com`.
5. Open the hub → **Media Downloader** → paste that URL into **Backend URL**.

> Free Render services sleep after inactivity; the first request after idle
> takes ~30–60s to wake. That's normal.

## Run locally

```sh
cd media-backend
pip install -r requirements.txt        # needs ffmpeg installed on your system
uvicorn app:app --reload --port 8000
```

Then set the hub's Backend URL to `http://localhost:8000`.

## Cookies (age / bot-gated videos)

If YouTube returns "Sign in to confirm you're not a bot" or an age error, export
your cookies in **Netscape format** (browser extensions like "Get cookies.txt"
do this) and paste them into the **YouTube cookies** box on `media.html`. They're
sent per-request and written to a temp file the server deletes immediately after.
You can also set a default via the `YT_COOKIES` env var. Refresh them whenever
they stop working — that's the "cookie refresh" step.

## Legal note

Downloading content you don't own may violate a site's Terms of Service. Use for
personal content / where you have the right. Your call.
