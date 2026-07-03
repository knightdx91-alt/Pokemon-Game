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
            r = session.post(target, data=request.form, timeout=90, allow_redirects=True)
        else:
            r = session.get(target, timeout=90, allow_redirects=True)
    except Exception as e:
        return Response(
            top_bar(target) + '<div style="padding:20px;font-family:sans-serif;color:#e6e6f0">'
            "<h2>Couldn't reach that site</h2><pre style='white-space:pre-wrap;color:#c88'>"
            + str(e) + "</pre><p>The onion address may be offline, or it blocks gateways.</p></div>",
            mimetype="text/html", status=502)

    ctype = r.headers.get("Content-Type", "")
    if "text/html" not in ctype.lower():
        guessed = ctype or mimetypes.guess_type(r.url)[0] or "application/octet-stream"
        return Response(r.content, mimetype=guessed)

    soup = BeautifulSoup(r.content, "html.parser")
    for tag, attr in REWRITE:
        for el in soup.find_all(tag):
            v = el.get(attr)
            if not v or v.startswith(("data:", "javascript:", "mailto:", "tel:", "#")):
                continue
            absu = urljoin(r.url, v)
            if absu.startswith(("http://", "https://")):
                el[attr] = proxify(absu)

    html = str(soup)
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
