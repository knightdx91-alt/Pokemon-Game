/* RetroPlay offline service worker.
   Scope: site root (/Pokemon-Game/). Controls index, emulator, game pages.

   Two caches, on purpose:
   - RUNTIME ('retroplay-offline-v2'): the EmulatorJS engine + per-system cores +
     static assets. This is what makes cached games playable offline. Its name is
     STABLE and MUST match OFFLINE_CACHE_NAME in emulator.html. NEVER rename it on
     a normal update — doing so purges every downloaded core (games stop being
     offline-ready until replayed online).
   - SHELL ('retroplay-shell-vN'): the precached HTML pages only. Safe to bump
     when you need to force a fresh page; bumping it does NOT touch the cores.

   Strategy:
   - Navigations (HTML): network-first → SHELL, fall back to cached page offline.
   - Static assets + EmulatorJS engine/cores + fflate: cache-first → RUNTIME.
   - Google Drive / auth / upload hosts and non-GET: always network, never cached.
*/

/* STABLE — holds cores/assets. Keep in sync with OFFLINE_CACHE_NAME in emulator.html. */
var RUNTIME = 'retroplay-offline-v2';
/* Versioned — holds precached HTML. Bump this (only) to force fresh pages. */
var SHELL   = 'retroplay-shell-v15';

/* Hosts we must never cache or intercept (auth, Drive picker, uploads). */
var BYPASS_HOSTS = [
    'apis.google.com',
    'accounts.google.com',
    'www.googleapis.com',
    'content.googleapis.com',
    'oauth2.googleapis.com',
    'drive.google.com',
    'www.google.com'
];

/* Minimal shell pre-cached on install so the page opens offline even on a
   fresh start. Everything else is cached on first online use. */
var PRECACHE = [
    './emulator.html',
    './index.html',
    './reader.html',
    'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'
];

self.addEventListener('install', function (e) {
    self.skipWaiting();
    e.waitUntil(
        caches.open(SHELL).then(function (c) {
            /* Don't let one failed (e.g. offline) precache abort install. */
            return Promise.all(PRECACHE.map(function (url) {
                return c.add(url).catch(function () {});
            }));
        })
    );
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(keys.map(function (k) {
                    /* Keep the runtime core cache AND the current shell; drop only
                       stale shells. The runtime cache is never purged on update. */
                    if (k !== RUNTIME && k !== SHELL) return caches.delete(k);
                }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;

    var url;
    try { url = new URL(req.url); } catch (err) { return; }

    if (BYPASS_HOSTS.indexOf(url.hostname) !== -1) return;

    var isNavigation = req.mode === 'navigate' ||
        (req.destination === 'document');

    if (isNavigation) {
        /* Network-first for pages → SHELL cache. */
        e.respondWith(
            fetch(req).then(function (resp) {
                if (resp && resp.status === 200) {
                    var clone = resp.clone();
                    caches.open(SHELL).then(function (c) { c.put(req, clone); });
                }
                return resp;
            }).catch(function () {
                return caches.match(req).then(function (hit) {
                    return hit || caches.match('./emulator.html');
                });
            })
        );
        return;
    }

    /* Cache-first for assets / engine / cores → RUNTIME cache. */
    e.respondWith(
        caches.match(req).then(function (hit) {
            if (hit) return hit;
            return fetch(req).then(function (resp) {
                /* Cache successful same-origin/CORS (200) and opaque CDN
                   responses so cross-origin engine files persist offline. */
                if (resp && (resp.status === 200 || resp.type === 'opaque')) {
                    var clone = resp.clone();
                    caches.open(RUNTIME).then(function (c) { c.put(req, clone); });
                }
                return resp;
            });
        })
    );
});
