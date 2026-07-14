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
import binascii
import hashlib
import json
import mimetypes
import os
import re
import socket
import sys
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from collections import OrderedDict
from html import escape
from urllib.parse import urljoin, quote, unquote, urlsplit

import requests
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup
from flask import Flask, request, Response, redirect, send_file
from werkzeug.utils import safe_join

TOR_PROXY = "socks5h://127.0.0.1:9050"   # socks5h = resolve hostnames (.onion) via Tor
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8888

EXTRACT_ROOT = "/tmp/onion-extract"       # where archives are unpacked
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB download cap
EXTRACT_TTL = 3600                          # delete extractions older than 1 h

GATEWAY_VERSION = "v9"  # bump on every gateway change so a fresh deploy is visible

# In-memory cache for small static assets (images/fonts) so revisits and shared
# assets don't re-fetch through Tor. Tightly capped so it can never OOM the box.
CACHE_MAX_ITEM = 3 * 1024 * 1024       # don't cache anything bigger than 3 MB
CACHE_MAX_TOTAL = 32 * 1024 * 1024     # 32 MB total ceiling (hard)
CACHE_TTL = 900                        # 15 min

# Tor control port — used by the "New IP" button to request a fresh circuit
# (SIGNAL NEWNYM). Enabled by setup-onion-gateway.sh (ControlPort 9051 +
# CookieAuthentication). The gateway runs as root so it can read the cookie.
TOR_CONTROL_PORT = 9051
TOR_COOKIE_PATHS = ("/run/tor/control.authcookie", "/var/run/tor/control.authcookie")


def new_tor_circuit():
    """Ask Tor for a brand-new circuit (new exit relay -> new IP).

    Returns (ok, message). Authenticates on the control port with the safe-cookie
    file if present, else tries null auth. This is the 'reset the connection when
    it gets slow' button — NEWNYM tears down existing circuits and builds fresh
    ones, so the next request very likely exits from a different IP.
    """
    cookie = None
    for p in TOR_COOKIE_PATHS:
        try:
            with open(p, "rb") as cf:
                cookie = cf.read()
            break
        except OSError:
            continue
    try:
        s = socket.create_connection(("127.0.0.1", TOR_CONTROL_PORT), timeout=10)
    except Exception as e:
        return (False, "Couldn't reach Tor's control port 9051 (" + str(e) +
                "). Re-run setup-onion-gateway.sh v7+ to enable it.")
    try:
        s.settimeout(10)
        auth = ("AUTHENTICATE " + binascii.hexlify(cookie).decode()
                if cookie else 'AUTHENTICATE ""') + "\r\n"
        s.sendall(auth.encode("latin-1"))
        if not s.recv(256).startswith(b"250"):
            return (False, "Tor rejected control authentication — check "
                    "CookieAuthentication in /etc/tor/torrc.")
        s.sendall(b"SIGNAL NEWNYM\r\n")
        ok = s.recv(256).startswith(b"250")
        try:
            s.sendall(b"QUIT\r\n")
        except Exception:
            pass
        return (ok, "New Tor circuit requested." if ok
                else "Tor did not accept the NEWNYM signal.")
    except Exception as e:
        return (False, "Tor control error: " + str(e))
    finally:
        s.close()

# User-added file hosts persist here (survives restarts). The service runs as
# root from /opt/onion-gateway, so this is writable; override with ONION_HOSTS_FILE.
USER_HOSTS_FILE = os.environ.get(
    "ONION_HOSTS_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_hosts.json"))
BOOKMARKS_FILE = os.environ.get(
    "ONION_BOOKMARKS_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "bookmarks.json"))
HISTORY_FILE = os.environ.get(
    "ONION_HISTORY_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "history.json"))

app = Flask(__name__)
session = requests.Session()
session.proxies = {"http": TOR_PROXY, "https": TOR_PROXY}
session.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0",
    "Accept-Language": "en-US,en;q=0.9",
})
# Bigger connection pool so many sub-resources (images/CSS/JS on one page) fetch
# in parallel through Tor instead of queueing on a tiny default pool.
_adapter = HTTPAdapter(pool_connections=32, pool_maxsize=32, max_retries=1)
session.mount("http://", _adapter)
session.mount("https://", _adapter)


def _proxies_for(url):
    """Give each destination host its OWN Tor circuit (via SOCKS auth isolation).

    Tor's default SocksPort has IsolateSOCKSAuth on, so a distinct user:pass ->
    a distinct circuit. Keying it on the hostname means: one slow site can't jam
    every other site, while a single site's own images/scripts reuse one warm
    circuit (no per-asset circuit-build latency).
    """
    try:
        host = urlsplit(url).netloc.lower() or "default"
    except Exception:
        host = "default"
    tag = hashlib.sha1(host.encode("utf-8", "ignore")).hexdigest()[:12]
    p = "socks5h://%s:x@127.0.0.1:9050" % tag
    return {"http": p, "https": p}


# ---- tiny bounded in-memory asset cache (images/fonts) -----------------------
_CACHE = OrderedDict()
_CACHE_BYTES = 0
_CACHE_LOCK = threading.Lock()


def _cache_drop(url):  # caller must hold _CACHE_LOCK
    global _CACHE_BYTES
    v = _CACHE.pop(url, None)
    if v:
        _CACHE_BYTES -= len(v[1])


def cache_get(url):
    with _CACHE_LOCK:
        v = _CACHE.get(url)
        if not v:
            return None
        ctype, data, ts = v
        if time.time() - ts > CACHE_TTL:
            _cache_drop(url)
            return None
        _CACHE.move_to_end(url)
        return ctype, data


def cache_put(url, ctype, data):
    global _CACHE_BYTES
    if len(data) > CACHE_MAX_ITEM:
        return
    with _CACHE_LOCK:
        if url in _CACHE:
            _cache_drop(url)
        _CACHE[url] = (ctype, data, time.time())
        _CACHE_BYTES += len(data)
        while _CACHE_BYTES > CACHE_MAX_TOTAL and _CACHE:
            k, val = _CACHE.popitem(last=False)
            _CACHE_BYTES -= len(val[1])

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
  <p class="hint"><a href="/new-identity">&#128260; Get a new Tor IP</a>
    — tap this if browsing gets slow; it builds a fresh circuit. &nbsp;
    <a href="/bookmarks">&#9733; Bookmarks</a> &nbsp;
    <a href="/history">&#128340; History</a></p>
  <hr style="border:0;border-top:1px solid #2a2a3a;margin:22px 0">
  <form action="/add-host" method="post">
    <input name="url" autocomplete="off" autocapitalize="off" spellcheck="false"
           placeholder="Paste a download-page link to add its host">
    <button type="submit">Add host &amp; open</button>
  </form>
  <p class="hint">Registers the site's domain, then tries to grab the file.
    Simple hosts work automatically; JS/token hosts (GoFile, Mega) need a custom
    resolver. &nbsp;<a href="/hosts">manage hosts</a></p>
</div></body></html>"""

# Single-URL attributes we rewrite on EVERY element (not just a fixed tag list),
# so backgrounds, lazy-load data-*, media posters, form actions, etc. all route
# through Tor — not just <a>/<img>/<script>.
URL_ATTRS = ("href", "src", "action", "formaction", "poster",
             "data-src", "data-original", "data-lazy-src", "data-url", "data-href")
SRCSET_ATTRS = ("srcset", "data-srcset", "imagesrcset")
STRIP_ATTRS = ("integrity", "crossorigin", "nonce")  # SRI/CORS block edited/proxied assets

CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)", re.I)
CSS_IMPORT_RE = re.compile(r"@import\s+(['\"])([^'\"]+)\1", re.I)


def proxify(url):
    return "/browse?url=" + quote(url, safe="")


def _js_str(s):
    """Safely embed a Python string as a JS string literal."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("<", "\\x3c") + '"'


def _abs_or_none(base, v):
    """Resolve a possibly-relative URL to an http(s) absolute, or None to skip."""
    if not v:
        return None
    v = v.strip()
    if v.startswith(("data:", "javascript:", "mailto:", "tel:", "#", "blob:", "about:")):
        return None
    if v.startswith("/browse?url="):
        return None
    absu = urljoin(base, v)
    return absu if absu.startswith(("http://", "https://")) else None


def rewrite_css(text, base):
    """Rewrite url(...) and @import in a CSS string so their targets go via Tor."""
    def _url(m):
        raw = m.group(2).strip()
        if raw.startswith(("data:", "#")) or raw.startswith("/browse?url="):
            return m.group(0)
        absu = urljoin(base, raw)
        if absu.startswith(("http://", "https://")):
            return 'url("' + proxify(absu) + '")'
        return m.group(0)

    def _imp(m):
        raw = m.group(2).strip()
        if raw.startswith("/browse?url="):
            return m.group(0)
        absu = urljoin(base, raw)
        if absu.startswith(("http://", "https://")):
            return '@import "' + proxify(absu) + '"'
        return m.group(0)

    return CSS_URL_RE.sub(_url, CSS_IMPORT_RE.sub(_imp, text or ""))


def proxify_srcset(value, base):
    """Rewrite each candidate URL in a srcset while keeping its 1x/2x/320w descriptor."""
    out = []
    for part in (value or "").split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split()
        absu = _abs_or_none(base, bits[0])
        if absu:
            bits[0] = proxify(absu)
        out.append(" ".join(bits))
    return ", ".join(out)


# Client-side shim. Runs before site scripts. Routes fetch/XHR through the
# gateway AND rewrites URLs the browser sets at runtime — dynamically inserted
# nodes (MutationObserver), setAttribute, and the .src property setter (this
# last one is what makes canvas/slider "rotate" captchas load: they do
# `img = new Image(); img.src = '/captcha/...'` on a detached element that
# never hits the DOM, so only a property-setter hook can catch it). All URLs
# resolve against the real onion base B, not the gateway origin.
_SHIM_BODY = r"""
function wrap(u){try{if(u==null)return u;u=String(u);
if(u.indexOf('/browse?url=')===0)return u;
if(/^(data:|blob:|javascript:|mailto:|tel:|#|about:)/i.test(u))return u;
var a=new URL(u,B).href;
if(a.slice(0,4)==='http')return '/browse?url='+encodeURIComponent(a);}catch(e){}return u;}
function wss(v){try{return String(v).split(',').map(function(p){p=p.trim();if(!p)return p;var b=p.split(/\s+/);b[0]=wrap(b[0]);return b.join(' ');}).join(', ');}catch(e){return v;}}
function wcss(t){try{return String(t).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,function(m,q,u){if(/^(data:|#)/i.test(u))return m;return 'url("'+wrap(u)+'")';});}catch(e){return t;}}
var of=window.fetch;if(of){window.fetch=function(i,o){try{if(typeof i==='string')i=wrap(i);else if(i&&i.url)i=new Request(wrap(i.url),i);}catch(e){}return of.call(this,i,o);};}
var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=wrap(u);}catch(e){}return oo.apply(this,arguments);};
var URLA=['src','href','action','formaction','poster','data-src','data-original','data-lazy-src','data-url','data-href'];
var osa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{var ln=(''+n).toLowerCase();if(URLA.indexOf(ln)>=0)v=wrap(v);else if(ln==='srcset'||ln==='data-srcset')v=wss(v);else if(ln==='style')v=wcss(v);}catch(e){}return osa.call(this,n,v);};
function ps(proto){try{var d=Object.getOwnPropertyDescriptor(proto,'src');if(d&&d.set&&d.configurable){Object.defineProperty(proto,'src',{enumerable:d.enumerable,configurable:true,get:function(){return d.get.call(this);},set:function(v){try{v=wrap(v);}catch(e){}return d.set.call(this,v);}});}}catch(e){}}
if(window.HTMLImageElement)ps(HTMLImageElement.prototype);
if(window.HTMLScriptElement)ps(HTMLScriptElement.prototype);
if(window.HTMLMediaElement)ps(HTMLMediaElement.prototype);
function fix(el){try{if(!el||el.nodeType!==1||!el.hasAttribute)return;for(var i=0;i<URLA.length;i++){var a=URLA[i];if(el.hasAttribute(a)){var v=el.getAttribute(a);var w=wrap(v);if(w!==v)osa.call(el,a,w);}}['srcset','data-srcset'].forEach(function(a){if(el.hasAttribute(a)){var v=el.getAttribute(a);var w=wss(v);if(w!==v)osa.call(el,a,w);}});if(el.hasAttribute('style')){var s=el.getAttribute('style');var w=wcss(s);if(w!==s)osa.call(el,'style',w);}if(el.tagName==='STYLE'&&el.textContent){var t=wcss(el.textContent);if(t!==el.textContent)el.textContent=t;}}catch(e){}}
function walk(r){try{fix(r);if(r.querySelectorAll){var n=r.querySelectorAll('*');for(var i=0;i<n.length;i++)fix(n[i]);}}catch(e){}}
try{var mo=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==='attributes')fix(m.target);if(m.addedNodes)for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j]);}});
function st(){try{mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href','action','srcset','poster','style','data-src','data-original','data-lazy-src','data-srcset','data-url','data-href']});walk(document.documentElement);}catch(e){}}
if(document.documentElement)st();else document.addEventListener('DOMContentLoaded',st);}catch(e){}
"""


def serve_stream(r, cache_key=None):
    """Stream a non-HTML response through; auto-extract if it's a zip/rar/7z.

    Shared by the direct-download path and the resolved-file-host path so any
    archive (onion dump OR clearnet host) flows through the same extractor.
    Propagates the upstream status + range headers (so video seeking / partial
    content works) and caches small images/fonts when cache_key is given.
    """
    ctype = r.headers.get("Content-Type", "")
    it = r.iter_content(chunk_size=262144)
    try:
        first = next(it)
    except StopIteration:
        first = b""

    if archive_kind(first[:8]):
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

    # Not an archive: stream it through with download/range headers intact.
    guessed = ctype or mimetypes.guess_type(r.url)[0] or "application/octet-stream"
    headers = {}
    for hk in ("Content-Disposition", "Content-Length", "Accept-Ranges",
               "Last-Modified", "Content-Range"):
        if hk in r.headers:
            headers[hk] = r.headers[hk]
    # 206 Partial Content must be preserved so <video>/<audio> seeking works.
    status = r.status_code if r.status_code in (200, 206) else 200

    # Cache small images/fonts in memory so revisits skip Tor entirely.
    low = guessed.lower()
    clen = r.headers.get("Content-Length", "")
    small = (not clen) or (clen.isdigit() and int(clen) <= CACHE_MAX_ITEM)
    if (cache_key and status == 200 and small
            and ("image/" in low or "font" in low or "/font" in low)):
        buf = bytearray(first)
        over = False
        for c in it:
            buf += c
            if len(buf) > CACHE_MAX_ITEM:
                over = True
                break
        if not over:
            data = bytes(buf)
            cache_put(cache_key, guessed, data)
            return Response(data, status=status, mimetype=guessed, headers=headers)

        def gen_buf(b, iterator):
            yield bytes(b)
            for c in iterator:
                yield c
        return Response(gen_buf(buf, it), status=status, mimetype=guessed,
                        headers=headers)

    def gen(prefix, iterator):
        yield prefix
        for c in iterator:
            yield c
    return Response(gen(first, it), status=status, mimetype=guessed, headers=headers)


def resolve_mediafire(html_bytes, page_url):
    """MediaFire serves an HTML landing page — dig out the real file URL.

    The download button is `<a id="downloadButton" href="https://download…">`;
    newer pages scramble it into `data-scrambled-url` (base64). Return the direct
    URL, or None if this doesn't look like a resolvable MediaFire page.
    """
    try:
        s = BeautifulSoup(html_bytes, "html.parser")
    except Exception:
        return None
    a = s.find(id="downloadButton") or s.find("a", class_="input")
    if a:
        href = (a.get("href") or "").strip()
        if href.startswith(("http://", "https://")):
            return href
        scr = a.get("data-scrambled-url")
        if scr:
            try:
                import base64
                dec = base64.b64decode(scr).decode("utf-8", "ignore").strip()
                if dec.startswith(("http://", "https://")):
                    return dec
            except Exception:
                pass
    for a in s.find_all("a", href=True):
        h = a["href"]
        if "download" in h and "mediafire.com" in h and h.startswith("http"):
            return h
    return None


def resolve_gofile(html_bytes, page_url):
    """GoFile hides files behind an API (guest token + per-site 'wt' token).

    Flow: mint a guest account token, fetch the folder contents with the wt
    token scraped from GoFile's own JS, take the first file's CDN link, and set
    the account-token cookie the CDN requires. Best-effort — GoFile changes this
    periodically; if it breaks, the error page explains and I update the resolver.
    """
    import re as _re
    m = _re.search(r"/d/([A-Za-z0-9]+)", urlsplit(page_url).path)
    if not m:
        return None
    code = m.group(1)
    try:
        acc = session.post("https://api.gofile.io/accounts", timeout=30).json()
        token = acc["data"]["token"]
        wt = None
        try:
            gjs = session.get("https://gofile.io/dist/js/global.js", timeout=30).text
            mw = _re.search(r'wt\s*[:=]\s*["\']([A-Za-z0-9]+)["\']', gjs)
            wt = mw.group(1) if mw else None
        except Exception:
            pass
        url = "https://api.gofile.io/contents/%s" % code + (("?wt=" + wt) if wt else "")
        r = session.get(url, headers={"Authorization": "Bearer " + token}, timeout=30).json()
        children = (r.get("data") or {}).get("children") or {}
        for _, c in children.items():
            if c.get("type") == "file" and c.get("link"):
                # the CDN link needs this cookie; session carries it into the fetch
                session.cookies.set("accountToken", token, domain=".gofile.io")
                return c["link"]
    except Exception:
        return None
    return None


# host substring -> resolver(html_bytes, page_url) -> direct file URL or None.
# Add a line here to teach the gateway a new file host.
RESOLVERS = [
    ("mediafire.com", resolve_mediafire),
    ("gofile.io", resolve_gofile),
]

# ---- user-added hosts (self-service) + generic direct-link detection ---------

FILE_EXTS = (".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz",
             ".iso", ".001", ".002", ".003", ".mkv", ".mp4", ".avi", ".mov",
             ".webm", ".m4v", ".mp3", ".flac", ".wav", ".pdf", ".epub",
             ".apk", ".exe", ".bin", ".img", ".jpg", ".jpeg", ".png", ".gif")


def load_user_hosts():
    try:
        with open(USER_HOSTS_FILE) as f:
            return set(json.load(f).get("hosts", []))
    except Exception:
        return set()


def save_user_hosts(hosts):
    try:
        with open(USER_HOSTS_FILE, "w") as f:
            json.dump({"hosts": sorted(hosts)}, f)
        return True
    except Exception:
        return False


def host_from_input(s):
    """A pasted URL or bare domain -> its lowercase netloc (or None)."""
    s = (s or "").strip()
    if not s:
        return None
    if "://" not in s:
        s = "http://" + s
    return urlsplit(s).netloc.lower() or None


def _looks_file(u):
    return urlsplit(u).path.lower().endswith(FILE_EXTS)


def resolve_generic(html_bytes, page_url):
    """Best-effort: find a single direct download link in a landing page's HTML.

    Works for hosts that expose the file URL as a real anchor/form/button (the
    common case). Returns None for JS/API-gated hosts — nothing to find in HTML.
    """
    try:
        s = BeautifulSoup(html_bytes, "html.parser")
    except Exception:
        return None
    cands = []
    for f in s.find_all("form", action=True):
        u = urljoin(page_url, f["action"])
        if u.startswith(("http://", "https://")) and _looks_file(u):
            cands.append((3, u))
    for el in s.find_all("a", href=True):
        u = urljoin(page_url, el["href"])
        if not u.startswith(("http://", "https://")):
            continue
        idc = (str(el.get("id", "")) + " " + " ".join(el.get("class", []) or []) +
               " " + el.get_text(" ", strip=True)[:40]).lower()
        score = 0
        if _looks_file(u):
            score += 3
        if el.has_attr("download") or "download" in idc:
            score += 2
        if score:
            cands.append((score, u))
    for m in s.find_all("meta"):
        if m.get("http-equiv", "").lower() == "refresh" and m.get("content"):
            c = m["content"]
            k = c.lower().find("url=")
            if k != -1:
                u = urljoin(page_url, c[k + 4:].strip().strip("'\""))
                if _looks_file(u):
                    cands.append((3, u))
    if not cands:
        return None
    cands.sort(key=lambda x: x[0], reverse=True)
    return cands[0][1]


def _fetch_direct(url, referer):
    return session.get(url, timeout=180, allow_redirects=True, stream=True,
                       proxies=_proxies_for(url),
                       headers={"Referer": referer} if referer else {})


# ---- bookmarks + history (self-service, persisted like user_hosts) -----------

def _load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(path, obj):
    try:
        with open(path, "w") as f:
            json.dump(obj, f)
        return True
    except Exception:
        return False


def load_bookmarks():
    """-> list of {'url':..,'title':..} (newest first)."""
    b = _load_json(BOOKMARKS_FILE, [])
    return b if isinstance(b, list) else []


def add_bookmark(url, title):
    url = (url or "").strip()
    if not url:
        return
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    title = (title or "").strip() or urlsplit(url).netloc or url
    marks = [m for m in load_bookmarks() if m.get("url") != url]
    marks.insert(0, {"url": url, "title": title[:120]})
    _save_json(BOOKMARKS_FILE, marks[:200])


def remove_bookmark(url):
    marks = [m for m in load_bookmarks() if m.get("url") != url]
    _save_json(BOOKMARKS_FILE, marks)


def record_history(url):
    """Log a visited page (dedup, newest first, capped)."""
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        return
    hist = _load_json(HISTORY_FILE, [])
    if not isinstance(hist, list):
        hist = []
    hist = [h for h in hist if h.get("url") != url]
    hist.insert(0, {"url": url, "t": int(time.time())})
    _save_json(HISTORY_FILE, hist[:300])


def load_history():
    h = _load_json(HISTORY_FILE, [])
    return h if isinstance(h, list) else []


# ---- yt-dlp engine: covers ~1800 community-maintained sites for free ---------

_YTDLP_OK = None


def ytdlp_available():
    global _YTDLP_OK
    if _YTDLP_OK is None:
        try:
            p = subprocess.run([sys.executable, "-m", "yt_dlp", "--version"],
                               capture_output=True, text=True, timeout=30)
            _YTDLP_OK = (p.returncode == 0)
        except Exception:
            _YTDLP_OK = False
    return _YTDLP_OK


def serve_ytdlp(url):
    """Download <url> with yt-dlp, then run it through the extractor / file list.

    Returns a Response, or None if yt-dlp can't handle the URL (so the caller
    falls back to the generic scanner). onion URLs go via Tor; clearnet goes
    direct from the VPS (many lockers block Tor exits).
    """
    if not ytdlp_available():
        return None
    purge_old()
    token = uuid.uuid4().hex
    d = os.path.join(EXTRACT_ROOT, token)
    out = os.path.join(d, "out")
    os.makedirs(out, exist_ok=True)
    host = urlsplit(url).netloc.lower()
    cmd = [sys.executable, "-m", "yt_dlp"]
    if ".onion" in host:
        cmd += ["--proxy", "socks5h://127.0.0.1:9050"]
    cmd += ["--no-playlist", "--no-part", "--no-warnings", "-q", "--no-progress",
            "--max-filesize", str(MAX_ARCHIVE_BYTES),
            "-o", os.path.join(out, "%(title).120s.%(ext)s"), url]
    try:
        subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True,
                       text=True, timeout=900)
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        return None
    files = [os.path.join(rt, n) for rt, _, ns in os.walk(out) for n in ns]
    if not files:
        shutil.rmtree(d, ignore_errors=True)
        return None
    # A single downloaded archive -> feed it to the extractor.
    if len(files) == 1:
        try:
            with open(files[0], "rb") as fh:
                magic = fh.read(8)
        except Exception:
            magic = b""
        if archive_kind(magic):
            arch = os.path.join(d, "archive.bin")
            shutil.move(files[0], arch)
            ok, needpw, _ = do_extract(arch, d, None)
            if ok:
                return _extract_result(token)
            if needpw:
                return password_form(token, None)
            shutil.move(arch, os.path.join(out, os.path.basename(files[0])))
    return _extract_result(token)


def try_resolve_filehost(r):
    """If this HTML page is a known file host, resolve the real file and stream
    it through the extractor. Returns a Response, or None to show the page."""
    host = urlsplit(r.url).netloc.lower()
    if "mega.nz" in host or "mega.co.nz" in host:
        return _msg_page(
            "Mega isn't supported",
            "Mega decrypts files inside your browser using a key in the link, "
            "which a gateway can't do. Open Mega links on a device with the app.")
    for match, fn in RESOLVERS:
        if match in host:
            try:
                direct = fn(r.content, r.url)
            except Exception:
                direct = None
            if direct:
                return serve_stream(_fetch_direct(direct, r.url))
            return _msg_page(
                "Couldn't find the download",
                "This looks like a " + match + " page but the download link "
                "couldn't be read — the host may have changed. Tell me and I'll "
                "update it.")

    # User-registered hosts: try the yt-dlp engine first (knows ~1800 sites),
    # then the generic HTML link detector.
    for uh in load_user_hosts():
        if uh and uh in host:
            resp = serve_ytdlp(r.url)
            if resp is not None:
                return resp
            try:
                direct = resolve_generic(r.content, r.url)
            except Exception:
                direct = None
            if direct:
                return serve_stream(_fetch_direct(direct, r.url))
            return _msg_page(
                "No download found on " + host,
                host + " is in your host list, but neither yt-dlp nor the page "
                "scanner could pull a file from it. Simple hosts and yt-dlp's "
                "~1800 known sites work automatically; a JS/token host it doesn't "
                "know (some lockers) needs a custom resolver — tell me the host "
                "and I'll add one.")
    return None


def top_bar(current):
    """Overlay chrome injected after <body>.

    position:fixed (NOT sticky) so it takes no layout space — sticky broke the
    scroll math on forums/chat sites that use a full-height internal scroll
    container. A '×' collapses it to a small floating 🧅 pill so it can never
    permanently cover content. A companion script removes the bar inside iframes
    (framed forum/chat panes were each drawing their own bar -> doubled bar).
    """
    cur = current.replace('"', "&quot;")
    ver = GATEWAY_VERSION
    bar = (
        '<div id="__onionbar" style="position:fixed!important;top:0!important;'
        'left:0!important;right:0!important;z-index:2147483647!important;display:flex;'
        'gap:6px;padding:8px;background:#0c0c14!important;border-bottom:1px solid #2a2a3a;'
        'font-family:sans-serif;box-sizing:border-box;max-width:100vw">'
        '<a href="/" title="Onion Reader ' + ver + '" style="color:#9a8bff;'
        'text-decoration:none;padding:8px 10px;background:#16161f;border-radius:8px;'
        'flex:none">🧅<sub style="font-size:.6em;color:#6a6a80">' + ver + '</sub></a>'
        '<form action="/browse" method="get" style="display:flex;flex:1;gap:6px;'
        'margin:0;min-width:0">'
        '<input name="url" value="' + cur + '" style="flex:1;min-width:0;padding:8px 10px;'
        'border-radius:8px;border:1px solid #2a2a3a;background:#16161f;color:#fff" '
        'autocapitalize="off" spellcheck="false">'
        '<button style="padding:8px 12px;border:0;border-radius:8px;background:#7c6af7;'
        'color:#fff;flex:none">Go</button></form>'
        '<a href="/add-bookmark?url=' + quote(current, safe="") + '" '
        'title="Bookmark this page" style="color:#ffd479;text-decoration:none;'
        'padding:8px 10px;background:#2a2a3a;border-radius:8px;flex:none">&#9733;</a>'
        '<a href="/new-identity?back=' + quote(current, safe="") + '" '
        'title="New Tor exit IP — use this if browsing gets slow" '
        'style="color:#fff;text-decoration:none;padding:8px 10px;background:#2a2a3a;'
        'border-radius:8px;flex:none">&#128260;</a>'
        '<button type="button" onclick="__onionHide()" title="Hide bar" '
        'style="padding:8px 11px;border:0;border-radius:8px;background:#2a2a3a;color:#fff;'
        'flex:none;cursor:pointer">&times;</button>'
        '</div>'
        '<button type="button" id="__onionpill" onclick="__onionShow()" '
        'title="Show Onion Reader controls" style="display:none;position:fixed!important;'
        'top:6px;left:6px;z-index:2147483647!important;border:0;border-radius:20px;'
        'background:#7c6af7;color:#fff;padding:6px 12px;font-family:sans-serif;'
        'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5)">🧅</button>'
    )
    script = (
        "<script>(function(){try{"
        "if(window.top!==window.self){"
        "var e=document.getElementById('__onionbar');if(e)e.remove();"
        "var p=document.getElementById('__onionpill');if(p)p.remove();return;}"
        "var bars=document.querySelectorAll('#__onionbar');"
        "for(var i=1;i<bars.length;i++)bars[i].remove();"
        "window.__onionHide=function(){"
        "var b=document.getElementById('__onionbar');if(b)b.style.display='none';"
        "var q=document.getElementById('__onionpill');if(q)q.style.display='block';};"
        "window.__onionShow=function(){"
        "var b=document.getElementById('__onionbar');if(b)b.style.display='flex';"
        "var q=document.getElementById('__onionpill');if(q)q.style.display='none';};"
        "}catch(e){}})();</script>"
    )
    return bar + script


@app.route("/")
def home():
    return HOME_PAGE.replace("🧅 Onion Reader",
                             "🧅 Onion Reader <small style='font-size:.5em;"
                             "color:#6a6a80;vertical-align:middle'>" +
                             GATEWAY_VERSION + "</small>")


@app.route("/new-identity")
def new_identity():
    """Reset the connection: request a fresh Tor circuit (new exit IP)."""
    ok, msg = new_tor_circuit()
    back = (request.args.get("back") or "").strip()
    if ok:
        body = ("<p>&#9989; " + escape(msg) + " Give it a few seconds, then reload "
                "— your exit IP should change. This is what to hit when a site "
                "gets slow.</p>")
        if back:
            body += ("<p><a class=f href='/browse?url=" + quote(back, safe="") +
                     "'><b>&#8635;</b> Reload the page you were on</a></p>")
    else:
        body = ("<p style='color:#e88'>&#9888; " + escape(msg) + "</p>"
                "<p class=sz>The New-IP button needs Tor's control port. Re-run "
                "<b>setup-onion-gateway.sh</b> (v7+) on the VPS — it enables "
                "ControlPort 9051 with cookie auth and restarts Tor.</p>")
    return _page("&#128260; New Tor circuit", body)


@app.route("/add-bookmark", methods=["GET", "POST"])
def add_bookmark_route():
    url = (request.values.get("url") or "").strip()
    title = (request.values.get("title") or "").strip()
    if not url:
        return redirect("/bookmarks")
    add_bookmark(url, title)
    # From the ⭐ button we came from a page — send them back to it.
    if request.method == "GET":
        return redirect(proxify(url if url.startswith(("http://", "https://"))
                                else "http://" + url))
    return redirect("/bookmarks")


@app.route("/remove-bookmark")
def remove_bookmark_route():
    remove_bookmark((request.args.get("url") or "").strip())
    return redirect("/bookmarks")


@app.route("/bookmarks")
def bookmarks_page():
    marks = load_bookmarks()
    if marks:
        rows = "".join(
            "<div class=f style='display:flex;align-items:center;gap:8px'>"
            "<a href='" + proxify(m["url"]) + "' style='flex:1;color:#e6e6f0;"
            "text-decoration:none'><b>&#9733;</b> " + escape(m.get("title", "")) +
            "<br><span class=sz>" + escape(m["url"]) + "</span></a>"
            "<a class=sz href='/remove-bookmark?url=" + quote(m["url"], safe="") +
            "'>remove</a></div>"
            for m in marks if m.get("url"))
    else:
        rows = "<p class=sz>None yet — open a page and tap &#9733; in the top bar.</p>"
    return _page(
        "&#9733; Bookmarks",
        rows +
        "<form action='/add-bookmark' method='post' style='margin-top:18px'>"
        "<p><input name='title' placeholder='name (optional)' "
        "autocapitalize='off'></p>"
        "<p><input name='url' placeholder='http://....onion/' "
        "autocapitalize='off' spellcheck='false'></p>"
        "<button type='submit'>Add bookmark</button></form>"
        "<p style='margin-top:16px'><a href='/history'>&#128340; History</a></p>")


@app.route("/clear-history")
def clear_history():
    _save_json(HISTORY_FILE, [])
    return redirect("/history")


@app.route("/history")
def history_page():
    hist = load_history()
    if hist:
        rows = "".join(
            "<a class=f href='" + proxify(h["url"]) + "'>" + escape(h["url"]) + "</a>"
            for h in hist if h.get("url"))
        rows += ("<p style='margin-top:12px'><a class=sz href='/clear-history'>"
                 "clear history</a></p>")
    else:
        rows = "<p class=sz>No history yet.</p>"
    return _page("&#128340; History",
                 rows + "<p style='margin-top:16px'><a href='/bookmarks'>"
                 "&#9733; Bookmarks</a></p>")


@app.route("/browse", methods=["GET", "POST"])
def browse():
    target = (request.values.get("url") or "").strip()
    if not target:
        return redirect("/")
    if not target.startswith(("http://", "https://")):
        target = "http://" + target

    # Forward the browser's Range header so <video>/<audio>/large downloads can
    # seek and resume instead of always restarting from byte 0.
    fwd = {}
    if request.headers.get("Range"):
        fwd["Range"] = request.headers["Range"]

    # Fast path: a cached small asset (image/font) skips Tor entirely.
    is_plain_get = request.method == "GET" and "Range" not in fwd
    if is_plain_get:
        hit = cache_get(target)
        if hit:
            return Response(hit[1], mimetype=hit[0])

    proxies = _proxies_for(target)
    try:
        if request.method == "POST":
            r = session.post(target, data=request.form, timeout=180,
                             allow_redirects=True, stream=True, proxies=proxies,
                             headers=fwd or None)
        else:
            r = session.get(target, timeout=180, allow_redirects=True, stream=True,
                            proxies=proxies, headers=fwd or None)
    except Exception as e:
        return Response(
            top_bar(target) + '<div style="padding:20px;font-family:sans-serif;color:#e6e6f0">'
            "<h2>Couldn't reach that site</h2><pre style='white-space:pre-wrap;color:#c88'>"
            + str(e) + "</pre><p>The onion address may be offline, or it blocks gateways.</p></div>",
            mimetype="text/html", status=502)

    ctype = r.headers.get("Content-Type", "")
    low_ct = ctype.lower()

    # Stylesheets: rewrite their url(...) / @import so background images, fonts,
    # sprites and CSS-based captchas load through the gateway (was passed raw).
    clean_url = r.url.split("?")[0]
    ext = clean_url.rsplit(".", 1)[-1].lower() if "." in clean_url.rsplit("/", 1)[-1] else ""
    if "text/css" in low_ct or ext == "css":
        return Response(rewrite_css(r.text, r.url), mimetype="text/css")

    # File hosts serve an HTML landing page, not the file. If this is a known
    # host, resolve the real download URL server-side and run it through the
    # same archive pipeline (works for clearnet AND onion links).
    if "text/html" in low_ct:
        resolved = try_resolve_filehost(r)
        if resolved is not None:
            return resolved

    if "text/html" not in low_ct:
        return serve_stream(r, cache_key=(target if is_plain_get else None))

    record_history(r.url)
    soup = BeautifulSoup(r.content, "html.parser")

    # Resolve relative links against <base href> if the page sets one, else r.url.
    page_base = r.url
    base_tag = soup.find("base", href=True)
    if base_tag:
        page_base = urljoin(r.url, base_tag["href"])
        base_tag.decompose()  # remove it so the browser doesn't hit the onion directly

    # Rewrite every URL-bearing attribute on every element (not just a fixed tag
    # list) so backgrounds, responsive srcset, lazy-load data-*, SVG <image>,
    # <object>/<embed>, media posters, etc. all route through Tor.
    for el in soup.find_all(True):
        for bad in STRIP_ATTRS:
            if el.has_attr(bad):
                del el[bad]
        for attr in URL_ATTRS:
            if el.has_attr(attr):
                absu = _abs_or_none(page_base, el.get(attr))
                if absu:
                    el[attr] = proxify(absu)
        if el.name == "object" and el.has_attr("data"):
            absu = _abs_or_none(page_base, el.get("data"))
            if absu:
                el["data"] = proxify(absu)
        if el.has_attr("xlink:href"):
            absu = _abs_or_none(page_base, el.get("xlink:href"))
            if absu:
                el["xlink:href"] = proxify(absu)
        for attr in SRCSET_ATTRS:
            if el.has_attr(attr):
                el[attr] = proxify_srcset(el.get(attr), page_base)
        if el.has_attr("style"):
            el["style"] = rewrite_css(el.get("style"), page_base)
        if el.name == "style" and el.get_text():
            el.string = rewrite_css(el.get_text(), page_base)

    # Drop any page-embedded Content-Security-Policy — it would block the shim
    # and the resources we now route through the (same-origin) gateway.
    for m in soup.find_all("meta"):
        if m.get("http-equiv", "").lower() in ("content-security-policy",
                                               "content-security-policy-report-only"):
            m.decompose()

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

    # JS shim (see _SHIM_BODY): routes fetch/XHR + runtime-set URLs through the
    # gateway, resolving relatives against the real onion base. Runs first.
    shim = ("<script>(function(){var B=" + _js_str(page_base) + ";"
            + _SHIM_BODY + "})();</script>")

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


@app.route("/add-host", methods=["POST"])
def add_host():
    raw = (request.form.get("url") or "").strip()
    host = host_from_input(raw)
    if not host:
        return redirect("/")
    hosts = load_user_hosts()
    hosts.add(host)
    if not save_user_hosts(hosts):
        return _msg_page("Couldn't save",
                         "Added " + host + " for now, but couldn't write the host "
                         "list to disk (permissions?) — it won't persist a restart.")
    # If they pasted a full URL, open it straight away so it's a one-step flow.
    if "://" in raw or "/" in raw:
        opener = raw if "://" in raw else "http://" + raw
        return redirect(proxify(opener))
    return redirect("/hosts")


@app.route("/remove-host")
def remove_host():
    host = (request.args.get("h") or "").strip().lower()
    hosts = load_user_hosts()
    if host in hosts:
        hosts.discard(host)
        save_user_hosts(hosts)
    return redirect("/hosts")


@app.route("/hosts")
def hosts_page():
    builtin = "".join("<div class=f><b>" + escape(m) + "</b> "
                      "<span class=sz>built-in</span></div>" for m, _ in RESOLVERS)
    user = load_user_hosts()
    if user:
        rows = "".join(
            "<div class=f>" + escape(h) +
            " <a class=sz href='/remove-host?h=" + quote(h) + "'>remove</a></div>"
            for h in sorted(user))
    else:
        rows = "<p class=sz>None yet — add one from the home page.</p>"
    return _page(
        "&#128193; File hosts",
        "<p>Pages from these domains are scanned for a direct download link and "
        "run through the archive extractor.</p>"
        "<h3 style='color:#9a8bff;font-size:1rem'>Your hosts</h3>" + rows +
        "<h3 style='color:#9a8bff;font-size:1rem;margin-top:18px'>Built-in "
        "(custom resolvers)</h3>" + builtin +
        "<form action='/add-host' method='post' style='margin-top:18px'>"
        "<p><input name='url' placeholder='domain or download-page link' "
        "autocapitalize='off' spellcheck='false'></p>"
        "<button type='submit'>Add host</button></form>"
        "<p class=sz style='margin-top:16px'>Registered hosts are downloaded via "
        "<b>yt-dlp</b> (knows ~1800 sites) with a page-scan fallback. "
        "<a href='/supported'>see yt-dlp's site list</a></p>")


_EXTRACTORS = None


@app.route("/supported")
def supported():
    """Browse/search the sites yt-dlp knows — the 'host list' it maintains."""
    global _EXTRACTORS
    if _EXTRACTORS is None:
        try:
            p = subprocess.run([sys.executable, "-m", "yt_dlp", "--list-extractors"],
                               capture_output=True, text=True, timeout=60)
            _EXTRACTORS = [ln.strip() for ln in p.stdout.splitlines() if ln.strip()]
        except Exception:
            _EXTRACTORS = []
    q = (request.args.get("q") or "").strip().lower()
    items = [e for e in _EXTRACTORS if q in e.lower()] if q else _EXTRACTORS
    shown = items[:800]
    rows = "".join("<div class=f>" + escape(e) + "</div>" for e in shown)
    more = ("<p class=sz>…and %d more — search to narrow.</p>" %
            (len(items) - len(shown))) if len(items) > len(shown) else ""
    return _page(
        "&#127760; Sites yt-dlp knows",
        "<form><input name=q value='" + escape(q) + "' placeholder='search sites' "
        "autocapitalize='off' spellcheck='false'><button>Search</button></form>"
        "<p class=sz>" + str(len(items)) + " match" +
        ("" if len(items) == 1 else "es") +
        (" of " + str(len(_EXTRACTORS)) if not q else "") + ". If your host is "
        "here, add it on the <a href='/hosts'>hosts page</a> and it'll use "
        "yt-dlp automatically.</p>" + rows + more)


@app.errorhandler(Exception)
def _on_error(e):
    """Never bounce silently to the home page — show what went wrong."""
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    return _msg_page("Something went wrong",
                     "The gateway hit an error on that link (it may be a heavy or "
                     "JS-driven page). Try again, or try a different link."), 500


if __name__ == "__main__":
    os.makedirs(EXTRACT_ROOT, exist_ok=True)
    try:
        from waitress import serve
        serve(app, host=LISTEN_HOST, port=LISTEN_PORT, threads=24)
    except ImportError:
        app.run(host=LISTEN_HOST, port=LISTEN_PORT)
