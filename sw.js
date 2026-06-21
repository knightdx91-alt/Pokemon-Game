/* RetroPlay offline service worker.
   Scope: site root (/Pokemon-Game/). Controls index, emulator, game pages.

   Strategy:
   - Navigations (HTML pages): network-first, fall back to cached page when
     offline. This keeps pages fresh when online but lets you open them with
     no connection. The cached HTML references versioned (?v=) asset URLs, and
     those exact versions are cached alongside it, so offline references resolve.
   - Static assets + EmulatorJS engine/cores (cdn.emulatorjs.org) + fflate:
     cache-first, populated at runtime. The first time you play a given system
     ONLINE, that system's core is downloaded and cached; afterwards it loads
     with no connection.
   - Google Drive / auth / upload hosts and non-GET requests: always go to the
     network, never cached.
*/

var CACHE = 'retroplay-offline-v1';

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
    'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'
];

self.addEventListener('install', function (e) {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
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
                    if (k !== CACHE) return caches.delete(k);
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
        /* Network-first for pages. */
        e.respondWith(
            fetch(req).then(function (resp) {
                if (resp && resp.status === 200) {
                    var clone = resp.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, clone); });
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

    /* Cache-first for assets / engine / cores. */
    e.respondWith(
        caches.match(req).then(function (hit) {
            if (hit) return hit;
            return fetch(req).then(function (resp) {
                /* Cache successful same-origin/CORS (200) and opaque CDN
                   responses so cross-origin engine files persist offline. */
                if (resp && (resp.status === 200 || resp.type === 'opaque')) {
                    var clone = resp.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, clone); });
                }
                return resp;
            });
        })
    );
});
