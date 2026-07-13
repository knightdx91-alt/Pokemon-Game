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
