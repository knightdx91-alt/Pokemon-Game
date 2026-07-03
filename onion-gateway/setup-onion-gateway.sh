#!/usr/bin/env bash
#
# setup-onion-gateway.sh — install the personal onion web gateway on the VPS.
#
# Serves a "paste an onion link" page on port 8888 and fetches onion sites
# through the Tor SOCKS proxy you already set up (127.0.0.1:9050). Your hub
# page's "Onion Reader" card just opens this.
#
# Run as root on the same VPS that runs Tor:
#   sudo bash setup-onion-gateway.sh
#
# SECURITY NOTE: port 8888 is a public onion proxy — anyone who knows the
# URL can browse onion sites through YOUR Tor. That's usually low-risk for a
# personal box, but if you want to lock it down, restrict port 8888 in the
# Contabo panel firewall (a static allow-list is hard on cell data since your
# phone IP changes). It does NOT expose your normal internet or the VPS itself.
#
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run as root: sudo bash $0" >&2; exit 1; fi

PORT=8888
APP_DIR=/opt/onion-gateway

echo "==> Checking Tor SOCKS (127.0.0.1:9050)..."
if ! curl -s --socks5-hostname 127.0.0.1:9050 -m 20 https://check.torproject.org/ | grep -qi congrat; then
  echo "WARNING: Tor SOCKS test didn't confirm. Make sure Tor is running before using the gateway."
fi

echo "==> Installing Python deps..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# python3-socks provides PySocks (SOCKS support for requests)
apt-get install -y python3-flask python3-requests python3-bs4 python3-socks python3-waitress curl

echo "==> Writing gateway app to ${APP_DIR}/gateway.py ..."
mkdir -p "${APP_DIR}"
cat > "${APP_DIR}/gateway.py" <<'PYEOF'
#!/usr/bin/env python3
"""
onion-gateway — a tiny personal Tor2web-style gateway.

Runs on a VPS that has Tor listening on 127.0.0.1:9050 (SOCKS). Fetches .onion
(and normal) pages through Tor and rewrites their links so you can keep browsing
from a plain browser on any device — no app, no VPN.

    /              -> a paste-a-link home page
    /browse?url=X  -> fetch X through Tor, rewrite links, return the page

Deliberately simple. Some heavy / JS-driven onion sites won't render perfectly;
simple sites work well. This is a personal tool — see the security note in
setup-onion-gateway.sh about who can reach the port.
"""
import mimetypes
from urllib.parse import urljoin, quote

import requests
from bs4 import BeautifulSoup
from flask import Flask, request, Response, redirect

TOR_PROXY = "socks5h://127.0.0.1:9050"   # socks5h = resolve hostnames (.onion) via Tor
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8888

app = Flask(__name__)
session = requests.Session()
session.proxies = {"http": TOR_PROXY, "https": TOR_PROXY}
session.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0",
    "Accept-Language": "en-US,en;q=0.9",
})

HOME_PAGE = """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Onion Reader</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0c0c14; color:#e6e6f0; display:flex; min-height:100vh;
         align-items:center; justify-content:center; padding:20px; }
  .box { width:100%; max-width:560px; }
  h1 { font-size:1.5rem; margin:0 0 4px; }
  .sub { color:#9a9ab0; margin:0 0 22px; font-size:.9rem; }
  form { display:flex; gap:8px; flex-wrap:wrap; }
  input { flex:1; min-width:0; padding:14px 16px; border-radius:12px;
          border:1px solid #2a2a3a; background:#16161f; color:#fff; font-size:1rem; }
  button { padding:14px 20px; border:0; border-radius:12px; background:#7c6af7;
           color:#fff; font-size:1rem; font-weight:600; cursor:pointer; }
  .hint { color:#6a6a80; font-size:.8rem; margin-top:16px; line-height:1.5; }
  a { color:#9a8bff; }
</style></head>
<body><div class="box">
  <h1>🧅 Onion Reader</h1>
  <p class="sub">Paste an onion link — it's fetched through Tor on your server.</p>
  <form action="/browse" method="get">
    <input name="url" autofocus autocomplete="off" autocapitalize="off"
           spellcheck="false" placeholder="http://....onion/">
    <button type="submit">Open</button>
  </form>
  <p class="hint">Try DuckDuckGo:<br>
    <a href="/browse?url=https%3A%2F%2Fduckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion">
    duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion</a></p>
</div></body></html>"""

REWRITE = [("a", "href"), ("link", "href"), ("img", "src"), ("script", "src"),
           ("form", "action"), ("iframe", "src"), ("source", "src")]


def proxify(url):
    return "/browse?url=" + quote(url, safe="")


def _js_str(s):
    """Safely embed a Python string as a JS string literal."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("<", "\\x3c") + '"'


def top_bar(current):
    return (
        '<div style="position:sticky;top:0;z-index:2147483647;display:flex;gap:6px;'
        'padding:8px;background:#0c0c14;border-bottom:1px solid #2a2a3a;'
        'font-family:sans-serif">'
        '<a href="/" style="color:#9a8bff;text-decoration:none;padding:8px 10px;'
        'background:#16161f;border-radius:8px">🧅</a>'
        '<form action="/browse" method="get" style="display:flex;flex:1;gap:6px;margin:0">'
        '<input name="url" value="' + current.replace('"', "&quot;") +
        '" style="flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid '
        '#2a2a3a;background:#16161f;color:#fff" autocapitalize="off" spellcheck="false">'
        '<button style="padding:8px 12px;border:0;border-radius:8px;background:#7c6af7;'
        'color:#fff">Go</button></form></div>'
    )


@app.route("/")
def home():
    return HOME_PAGE


@app.route("/browse", methods=["GET", "POST"])
def browse():
    target = (request.values.get("url") or "").strip()
    if not target:
        return redirect("/")
    if not target.startswith(("http://", "https://")):
        target = "http://" + target
    try:
        if request.method == "POST":
            r = session.post(target, data=request.form, timeout=180,
                             allow_redirects=True, stream=True)
        else:
            r = session.get(target, timeout=180, allow_redirects=True, stream=True)
    except Exception as e:
        return Response(
            top_bar(target) + '<div style="padding:20px;font-family:sans-serif;color:#e6e6f0">'
            "<h2>Couldn't reach that site</h2><pre style='white-space:pre-wrap;color:#c88'>"
            + str(e) + "</pre><p>The onion address may be offline, or it blocks gateways.</p></div>",
            mimetype="text/html", status=502)

    ctype = r.headers.get("Content-Type", "")
    if "text/html" not in ctype.lower():
        # A file / non-page response: stream it through and forward the headers
        # that make the browser download it (filename, size, range support).
        guessed = ctype or mimetypes.guess_type(r.url)[0] or "application/octet-stream"
        headers = {}
        for hk in ("Content-Disposition", "Content-Length", "Accept-Ranges", "Last-Modified"):
            if hk in r.headers:
                headers[hk] = r.headers[hk]
        return Response(r.iter_content(chunk_size=65536), mimetype=guessed, headers=headers)

    soup = BeautifulSoup(r.content, "html.parser")

    # Resolve relative links against <base href> if the page sets one, else r.url.
    page_base = r.url
    base_tag = soup.find("base", href=True)
    if base_tag:
        page_base = urljoin(r.url, base_tag["href"])
        base_tag.decompose()  # remove it so the browser doesn't hit the onion directly

    for tag, attr in REWRITE:
        for el in soup.find_all(tag):
            v = el.get(attr)
            if not v or v.startswith(("data:", "javascript:", "mailto:", "tel:", "#")):
                continue
            absu = urljoin(page_base, v)
            if absu.startswith(("http://", "https://")):
                el[attr] = proxify(absu)

    # Rewrite <meta http-equiv="refresh" content="N; url=..."> redirects.
    for m in soup.find_all("meta"):
        if (m.get("http-equiv", "").lower() == "refresh") and m.get("content"):
            c = m["content"]
            low = c.lower()
            k = low.find("url=")
            if k != -1:
                dest = urljoin(page_base, c[k + 4:].strip().strip("'\""))
                if dest.startswith(("http://", "https://")):
                    m["content"] = c[:k] + "url=" + proxify(dest)

    html = str(soup)

    # JS shim: route fetch/XHR through the gateway, resolving relatives against
    # the real onion base (not the gateway URL). Must run before site scripts.
    shim = (
        "<script>(function(){var B=" + _js_str(page_base) + ";"
        "function wrap(u){try{if(!u||typeof u!=='string')return u;"
        "if(u.indexOf('/browse?url=')===0)return u;"
        "var a=new URL(u,B).href;"
        "if(a.indexOf('http')===0)return '/browse?url='+encodeURIComponent(a);}catch(e){}return u;}"
        "var of=window.fetch;if(of){window.fetch=function(i,o){try{"
        "if(typeof i==='string')i=wrap(i);else if(i&&i.url)i=new Request(wrap(i.url),i);}catch(e){}"
        "return of.call(this,i,o);};}"
        "var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){"
        "try{arguments[1]=wrap(u);}catch(e){}return oo.apply(this,arguments);};})();</script>"
    )

    lower = html.lower()
    h = lower.find("<head")
    if h != -1:
        he = html.find(">", h)
        if he != -1:
            html = html[: he + 1] + shim + html[he + 1:]
    else:
        html = shim + html

    # inject the address bar right after <body>
    lower = html.lower()
    i = lower.find("<body")
    if i != -1:
        j = html.find(">", i)
        if j != -1:
            html = html[: j + 1] + top_bar(r.url) + html[j + 1:]
    else:
        html = top_bar(r.url) + html
    return Response(html, mimetype="text/html")


if __name__ == "__main__":
    try:
        from waitress import serve
        serve(app, host=LISTEN_HOST, port=LISTEN_PORT, threads=8)
    except ImportError:
        app.run(host=LISTEN_HOST, port=LISTEN_PORT)
PYEOF

echo "==> Installing systemd service..."
cat > /etc/systemd/system/onion-gateway.service <<EOF
[Unit]
Description=Onion web gateway (Tor2web-style)
After=network.target tor.service
[Service]
ExecStart=/usr/bin/python3 ${APP_DIR}/gateway.py
Restart=always
User=root
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now onion-gateway.service

echo "==> Opening firewall port ${PORT}..."
iptables -C INPUT -p tcp --dport ${PORT} -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT
command -v netfilter-persistent >/dev/null && netfilter-persistent save || true

sleep 2
PUBLIC_IP="$(curl -fsS https://ifconfig.me || echo YOUR_VPS_IP)"
echo ""
echo "============================================================"
echo " Onion Reader gateway is live:"
echo "     http://${PUBLIC_IP}:${PORT}/"
echo ""
echo " Open that in Chrome and paste an onion link, or use the"
echo " 'Onion Reader' card on your hub page."
echo ""
echo " If it doesn't load from your phone, open TCP ${PORT} in the"
echo " Contabo control-panel firewall."
echo " Status:  systemctl status onion-gateway --no-pager"
echo "============================================================"
