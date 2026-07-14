# Deploying / updating the Onion Reader gateway

**Read this before trying to "just push" a gateway change.** Editing the code in
this repo does **not** update the reader — the gateway runs on a separate server.

## The two pieces (why a repo push isn't enough)

The Onion Reader is **two independent things**:

1. **The card / button** — the `🧅 Onion Reader` card in `index.html`, served from
   **GitHub Pages**. This is just a link that opens the gateway URL. Pushing to
   `main` updates *this* automatically (Pages redeploys).
2. **The gateway program** — `onion-gateway/gateway.py`, a Flask app that actually
   reaches into Tor and fetches `.onion` pages. It runs as a **systemd service on
   the VPS** at **`144.126.132.69`**, installed at **`/opt/onion-gateway/gateway.py`**.
   GitHub Pages / your repo have **nothing to do with this running process.** The
   VPS keeps running whatever `gateway.py` was last copied onto it.

So: a fix to `gateway.py` sits in the repo until you **manually copy it onto the
VPS and restart the service.** That manual step is what this doc is for.

## How to know a deploy actually landed — `GATEWAY_VERSION`

`gateway.py` has `GATEWAY_VERSION = "vN"` (top of the file). It's rendered next to
the 🧅 in the reader's top bar and on the home page. **Bump it on every gateway
change.** After deploying, reload the reader — if you see the new `vN`, the fresh
code is live. If you don't, the VPS is still running the old copy.

## The 🔄 "New IP" / reset-connection button (v7+)

The reader now has a **🔄 New IP** button (top bar of every browsed page, and a
link on the home page). It hits `/new-identity`, which sends Tor a **NEWNYM**
signal — Tor drops the current circuits and builds fresh ones, so your next
request very likely exits from a **different IP**. Use it when a site gets slow.

This needs Tor's **control port**, which older boxes don't have. `setup-onion-gateway.sh`
(v7+) now appends this to `/etc/tor/torrc` and restarts Tor:

```
ControlPort 9051
CookieAuthentication 1
CookieAuthFileGroupReadable 1
```

If you only did the one-file `gateway.py` curl update (below) and the button says
*"Couldn't reach Tor's control port 9051"*, add those three lines to
`/etc/tor/torrc` and `systemctl restart tor` — or just re-run the full setup
script, which does it for you.

## Current features (v10)

- **🧅 core reader** — paste an onion link, fetched through Tor, links rewritten.
- **🔄 New IP** — Tor NEWNYM (fresh circuit / new exit) when a site gets slow.
- **Speed** — 32-connection pool + gunicorn threads, **per-site circuit isolation**
  (one slow site can't jam the rest), a small in-memory image/font cache, and
  `Range`/`206` passthrough so video seeks and downloads resume.
- **★ Bookmarks + history** — `/bookmarks`, `/history` (persisted JSON on the VPS).
- **💬 WebSockets** — live chat/forums (see below).
- **🖥 Render mode** — headless Chromium for JS-heavy sites (see below).
- **Memory cap** — the systemd unit has `MemoryMax=4G` so render/Chromium can't
  OOM the box and take down Tor.

## WebSockets (chat rooms) + render mode need the FULL setup script (v10+)

The one-file `gateway.py` curl below updates the app code only. Two features need
more than that, so for them **re-run `setup-onion-gateway.sh`**, not the curl:

- **WebSockets (live chat/forums)** — needs a WS-capable server. The setup script
  installs **gunicorn** (from apt) + **flask-sock** + **websocket-client** (pip),
  writes `run.sh`, and points the systemd unit at it. `run.sh` launches
  **`gunicorn -k gthread`** (real-thread worker — deliberately NOT gevent; gevent's
  `zope.event`/`zope.interface`/`greenlet` chain kept half-installing and leaving
  the box on the waitress fallback). Without gunicorn+flask-sock the reader still
  runs under waitress, just with no live WS updates. Client `new WebSocket()` calls
  are rewritten by the shim to `/__ws`, which bridges to the real onion WS over Tor
  via `websocket-client` (socks5h). The bridge uses `threading.Thread`, which is
  correct for the gthread worker.
- **🖥 Render mode (headless Chromium)** — needs Playwright + Chromium (~300 MB),
  which the setup script installs (`pip install playwright` **and**
  `playwright install --with-deps chromium` — the library and the browser are
  separate). `/render?url=…` runs Chromium through Tor in a **subprocess**
  (isolated from the server), then feeds the JS-executed DOM through the same
  rewriter. Capped at 2 concurrent Chromiums. If it's not installed the button
  shows a friendly "not installed" page.

Both degrade gracefully, so a box that only got the one-file update just won't
have these two features until the full script runs.

## The deploy command (copy-paste runbook)

### Step 0 — get ONTO the VPS (this is the part that bit us)

The gateway lives on the VPS, **not** on whatever "cloud shell" you happen to have
open. If your shell says things like *"Failed to connect to bus … not booted with
systemd"* or `/opt/onion-gateway` is missing, **you are not on the VPS** — you're
in a generic cloud shell (e.g. Google Cloud Shell), a different throwaway machine.

From that shell, SSH into the real server first:

```
ssh root@144.126.132.69
```

Answer `yes` to the fingerprint prompt, then enter the VPS **root password**
(typing is invisible — that's normal). The prompt changes to `root@…` when you're
actually on the VPS. Quick confirm you're on the right box:

```
test -d /opt/onion-gateway && echo "ON VPS ✓" || echo "NOT the VPS"
```

### Step 1 — pull the new file and restart

```
curl -fsSL "https://cdn.jsdelivr.net/gh/knightdx91-alt/Pokemon-Game@main/onion-gateway/gateway.py" -o /opt/onion-gateway/gateway.py \
  && systemctl restart onion-gateway \
  && sleep 2 && systemctl is-active onion-gateway \
  && echo "UPDATED — reload the reader, look for the new version"
```

Expected tail: `active` then `UPDATED …`. Reload the reader and confirm the new
`GATEWAY_VERSION`. (No `sudo` needed once you're logged in as `root`.)

## Rebuild from scratch (after a Contabo OS reinstall)

When the box gets wedged (e.g. a local LLM ate all the RAM/disk and killed Tor),
the clean fix is to reinstall the OS in the Contabo panel (**Ubuntu 24.04 LTS**)
and re-run the two installers. From Google Cloud Shell (or any shell):

```
ssh-keygen -R 144.126.132.69        # only if "host key verification failed" (new box = new key)
ssh root@144.126.132.69             # accept the new key, enter root password
```

Then on the VPS:

```
apt-get update -y && apt-get upgrade -y
curl -fsSL "https://cdn.jsdelivr.net/gh/knightdx91-alt/Pokemon-Game@main/vps-onion-vpn-setup.sh" -o /tmp/tor.sh && bash /tmp/tor.sh
curl -fsSL "https://cdn.jsdelivr.net/gh/knightdx91-alt/Pokemon-Game@main/onion-gateway/setup-onion-gateway.sh" -o /tmp/gw.sh && bash /tmp/gw.sh
```

`tor.sh` installs Tor (+ the IKEv2 VPN pieces); `gw.sh` installs the v10 gateway,
the WebSocket + Playwright stacks, the control port, and the memory cap.

## Health check (paste on the VPS)

```
bash -c '
systemctl is-active --quiet tor && echo "[PASS] Tor" || echo "[FAIL] Tor"
systemctl is-active --quiet onion-gateway && echo "[PASS] gateway" || echo "[FAIL] gateway"
curl -s --socks5-hostname 127.0.0.1:9050 -m 25 https://check.torproject.org/ | grep -qi congrat && echo "[PASS] Tor SOCKS" || echo "[FAIL] Tor SOCKS"
(exec 3<>/dev/tcp/127.0.0.1/9051) 2>/dev/null && echo "[PASS] control port 9051 (New IP)" || echo "[FAIL] control port 9051"
ss -ltn 2>/dev/null | grep -q ":8888" && echo "[PASS] listening 8888" || echo "[FAIL] not on 8888"
systemctl status onion-gateway --no-pager | grep -qi gunicorn && echo "[PASS] gunicorn (WebSockets ON)" || echo "[WARN] waitress fallback (WS off)"
python3 -c "import flask_sock,websocket" 2>/dev/null && echo "[PASS] WS deps" || echo "[FAIL] WS deps"
python3 -c "import playwright" 2>/dev/null && echo "[PASS] Playwright" || echo "[WARN] no Playwright"
systemctl show onion-gateway -p MemoryMax | grep -q "4294967296" && echo "[PASS] memory cap 4G" || echo "[WARN] no memory cap"
curl -s -m5 http://127.0.0.1:8888/ | grep -o "v1[0-9]" | head -1
'
```

All `[PASS]` + version `v10` = healthy. `[WARN]` = an optional feature is off but
the reader works. `[FAIL]` on Tor or the gateway is a real problem.

## Troubleshooting WebSockets ("running under waitress fallback")

The launcher only starts gunicorn if **both** `gunicorn` is on PATH **and**
`python3 -c 'import flask_sock'` succeeds. If it falls back to waitress, check the
service is actually pointed at `run.sh` and both conditions pass:

```
systemctl cat onion-gateway | grep ExecStart     # must be run.sh, NOT "python3 gateway.py"
command -v gunicorn                                # install with: apt-get install -y gunicorn
python3 -c "import flask_sock"                     # install with: pip install --break-system-packages flask-sock websocket-client
```

Fixes for the things we actually hit:
- **`ExecStart` still says `python3 gateway.py`** (box only got the one-file
  update) → the unit was never switched to `run.sh`. Re-run the full setup script,
  or rewrite the unit to `ExecStart=/usr/bin/env bash /opt/onion-gateway/run.sh`,
  `daemon-reload`, restart.
- **`gunicorn` not found** → `apt-get install -y gunicorn` (apt lands it at
  `/usr/bin/gunicorn`, on the service's PATH; pip's copy sometimes isn't).
- **`import gevent` → `No module named zope.event`** → this is why we **dropped
  gevent** and use the **gthread** worker instead. If an old `run.sh` still says
  `-k gevent`, replace it with `-k gthread -w 2 --threads 32` (needs no gevent).
- **`Errno 98 Address already in use`** when running `run.sh` by hand → harmless:
  the service already holds port 8888. Don't run `run.sh` manually; check the
  service with `systemctl status` instead.

## Gotchas we actually hit (and why the command looks like it does)

- **Editing the repo did nothing to the reader.** The running gateway is on the
  VPS; the repo is just storage. This is the #1 confusion — see "two pieces" above.
- **`git pull` didn't work** — the repo was never `git clone`d on the VPS. The
  gateway was installed by running `setup-onion-gateway.sh` (which writes an
  embedded copy of `gateway.py`), so there's no checkout to pull. That's why we
  fetch the single file by URL instead of pulling.
- **GitHub Pages won't serve `.py`** — Jekyll skips it, so
  `…github.io/…/gateway.py` 404s. Can't grab it from the Pages site.
- **The embedded token in `cloud-saves.js` is EXPIRED** (and the repo is public
  anyway, so it's exposed) — do **not** try to auth with it; a token-authed pull
  returns **401**. The repo being public is what lets us fetch with no token.
- **`raw.githubusercontent.com` rate-limited us → HTTP 429**, especially from
  shared cloud-shell IPs. **Fix: fetch from the jsDelivr CDN mirror**
  (`cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/<path>`) — same file, no rate limit.
  That's why the deploy command above uses jsDelivr, not raw.
- **`curl … -o /opt/onion-gateway/gateway.py` → "Failure writing output"** or
  **"cannot create regular file / no such file or directory"** means the target
  dir doesn't exist *on that machine* — i.e. you're not on the VPS (see Step 0).

## Alternate: reinstall via the setup script

`setup-onion-gateway.sh` contains an **embedded copy** of `gateway.py` and, when
run on the VPS, rewrites the file + restarts the service (idempotent — safe to
re-run). Keep that embedded copy in sync with `onion-gateway/gateway.py` whenever
you change the gateway (there are two copies of the source: the standalone file and
the one inside the heredoc in the setup script). The one-file curl above is the
faster path for a code-only change; the setup script is the path when deps or the
systemd unit also changed.

## Security note (carried from the repo docs)

`cloud-saves.js` embeds a GitHub token (reversed) and the repo is **public**, so
that token is readable by anyone viewing the site. It's already expired for our
purposes here, but it should be **rotated and moved server-side** at some point.
Not required to deploy the gateway (the repo is public → no token needed).
