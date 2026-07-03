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
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from html import escape
from urllib.parse import urljoin, quote, unquote

import requests
from bs4 import BeautifulSoup
from flask import Flask, request, Response, redirect, send_file
from werkzeug.utils import safe_join

TOR_PROXY = "socks5h://127.0.0.1:9050"   # socks5h = resolve hostnames (.onion) via Tor
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8888

EXTRACT_ROOT = "/tmp/onion-extract"       # where archives are unpacked
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB download cap
EXTRACT_TTL = 3600                          # delete extractions older than 1 h

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
        # Peek the first chunk to sniff whether this is an archive.
        it = r.iter_content(chunk_size=65536)
        try:
            first = next(it)
        except StopIteration:
            first = b""

        if archive_kind(first[:8]):
            # It's a zip/rar/7z — catch it, save it, and auto-extract.
            purge_old()
            token = uuid.uuid4().hex
            d = os.path.join(EXTRACT_ROOT, token)
            os.makedirs(d, exist_ok=True)
            archive_path = os.path.join(d, "archive.bin")
            total = 0
            with open(archive_path, "wb") as f:
                f.write(first); total = len(first)
                for chunk in it:
                    f.write(chunk); total += len(chunk)
                    if total > MAX_ARCHIVE_BYTES:
                        shutil.rmtree(d, ignore_errors=True)
                        return _msg_page("Archive too large",
                                         "That file is over the %d GB limit." %
                                         (MAX_ARCHIVE_BYTES // (1024**3)))
            # remember the source name for nicer display
            with open(os.path.join(d, "name.txt"), "w") as nf:
                nf.write(os.path.basename(r.url.split("?")[0]) or "archive")
            ok, needpw, _ = do_extract(archive_path, d, None)
            if ok:
                return _extract_result(token)
            if needpw:
                return password_form(token, None)
            shutil.rmtree(d, ignore_errors=True)
            return _msg_page("Couldn't open that archive",
                             "It may be corrupt or an unsupported format.")

        # Not an archive: stream it through with download headers intact.
        guessed = ctype or mimetypes.guess_type(r.url)[0] or "application/octet-stream"
        headers = {}
        for hk in ("Content-Disposition", "Content-Length", "Accept-Ranges", "Last-Modified"):
            if hk in r.headers:
                headers[hk] = r.headers[hk]

        def gen(prefix, iterator):
            yield prefix
            for c in iterator:
                yield c
        return Response(gen(first, it), mimetype=guessed, headers=headers)

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


# --------------------------------------------------------------------------
# Archive catching / auto-extraction
# --------------------------------------------------------------------------

def archive_kind(magic):
    """Identify zip/rar/7z by magic bytes (reliable regardless of extension)."""
    if magic[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
        return "zip"
    if magic[:4] == b"Rar!":
        return "rar"
    if magic[:6] == b"7z\xbc\xaf\x27\x1c":
        return "7z"
    return None


def _out_dir(token):
    return os.path.join(EXTRACT_ROOT, token, "out")


def do_extract(archive_path, token_dir, password):
    """Extract with `unar`. Returns (ok, needs_password, message)."""
    out = os.path.join(token_dir, "out")
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out, exist_ok=True)
    cmd = ["unar", "-quiet", "-force-overwrite", "-output-directory", out]
    if password:
        cmd += ["-password", password]
    cmd += [archive_path]
    try:
        p = subprocess.run(cmd, stdin=subprocess.DEVNULL,
                           capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        return (False, False, "Extraction timed out.")
    except FileNotFoundError:
        return (False, False, "The 'unar' tool isn't installed on the server.")
    combined = (p.stdout + p.stderr).lower()
    # did anything actually come out?
    extracted = any(files for _, _, files in os.walk(out))
    if p.returncode == 0 and extracted:
        return (True, False, "")
    if ("password" in combined or "encrypted" in combined
            or "passphrase" in combined or "wrong" in combined):
        return (False, True, "Password required or incorrect.")
    return (False, False, combined.strip() or "Extraction failed.")


def purge_old():
    """Delete extractions older than EXTRACT_TTL."""
    try:
        now = time.time()
        for name in os.listdir(EXTRACT_ROOT):
            path = os.path.join(EXTRACT_ROOT, name)
            try:
                if now - os.path.getmtime(path) > EXTRACT_TTL:
                    shutil.rmtree(path, ignore_errors=True)
            except OSError:
                pass
    except FileNotFoundError:
        pass


def _page(title, body):
    return Response(
        "<!doctype html><meta charset=utf-8>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        "<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;"
        "background:#0c0c14;color:#e6e6f0;padding:20px;line-height:1.5}"
        "a{color:#9a8bff}input{padding:12px;border-radius:10px;border:1px solid #2a2a3a;"
        "background:#16161f;color:#fff;font-size:1rem}"
        "button{padding:12px 18px;border:0;border-radius:10px;background:#7c6af7;color:#fff;"
        "font-size:1rem;font-weight:600}"
        ".f{display:block;padding:10px 12px;margin:6px 0;background:#16161f;border-radius:10px;"
        "text-decoration:none;color:#e6e6f0}.f b{color:#9a8bff}"
        ".sz{color:#8a8aa0;font-size:.85rem}</style>"
        "<h2>" + title + "</h2>" + body +
        "<p style='margin-top:24px'><a href='/'>&#129441; Onion Reader home</a></p>",
        mimetype="text/html")


def _msg_page(title, msg):
    return _page(title, "<p>" + escape(msg) + "</p>")


def password_form(token, error):
    err = "<p style='color:#e88'>" + escape(error) + "</p>" if error else ""
    return _page(
        "&#128274; Password needed",
        "<p>This archive is password-protected. Enter the password to unpack it.</p>"
        + err +
        "<form action='/unpack' method='post'>"
        "<input type='hidden' name='token' value='" + escape(token) + "'>"
        "<p><input name='pw' type='password' autofocus placeholder='Password' "
        "autocapitalize='off' autocomplete='off'></p>"
        "<button type='submit'>Unpack</button></form>")


def _extract_result(token):
    """List extracted files (or jump straight to the file if there's only one)."""
    out = _out_dir(token)
    files = []
    for root, _, names in os.walk(out):
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, out)
            files.append((rel, os.path.getsize(full)))
    if not files:
        return _msg_page("Nothing inside", "The archive extracted but was empty.")
    files.sort()
    if len(files) == 1:
        return redirect("/dl/" + token + "/" + quote(files[0][0]))
    rows = []
    for rel, size in files:
        kb = size / 1024.0
        human = ("%.1f KB" % kb) if kb < 1024 else ("%.1f MB" % (kb / 1024.0))
        rows.append("<a class=f href='/dl/" + token + "/" + quote(rel) + "'>"
                    "<b>&#11015;</b> " + escape(rel) +
                    " <span class=sz>" + human + "</span></a>")
    return _page("Unpacked " + str(len(files)) + " files", "".join(rows))


@app.route("/unpack", methods=["POST"])
def unpack():
    token = request.form.get("token", "")
    pw = request.form.get("pw", "")
    token_dir = safe_join(EXTRACT_ROOT, token)
    if not token_dir or not os.path.isdir(token_dir):
        return _msg_page("Expired", "That archive is no longer available — reload it.")
    archive_path = os.path.join(token_dir, "archive.bin")
    ok, needpw, msg = do_extract(archive_path, token_dir, pw)
    if ok:
        return _extract_result(token)
    if needpw:
        return password_form(token, "Wrong password — try again.")
    return _msg_page("Couldn't open that archive", msg)


@app.route("/dl/<token>/<path:subpath>")
def download_extracted(token, subpath):
    base = safe_join(EXTRACT_ROOT, token, "out")
    full = safe_join(base, unquote(subpath)) if base else None
    if not full or not os.path.isfile(full):
        return _msg_page("Not found", "That file is no longer available.")
    return send_file(full, as_attachment=True,
                     download_name=os.path.basename(full))


if __name__ == "__main__":
    os.makedirs(EXTRACT_ROOT, exist_ok=True)
    try:
        from waitress import serve
        serve(app, host=LISTEN_HOST, port=LISTEN_PORT, threads=8)
    except ImportError:
        app.run(host=LISTEN_HOST, port=LISTEN_PORT)
