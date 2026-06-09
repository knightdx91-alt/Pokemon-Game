// Service Worker — cache-on-demand for ROM and EmulatorJS assets
const CACHE = 'pokemon-emu-v4';
const ROM_CACHE = 'pokemon-black-rom-v1';
const ROM_URL_PATH = '/pokemon-black-rom.zip';
const ROM_ASSET_URL = 'https://api.github.com/repos/knightdx91-alt/Pokemon-Game/releases/assets/442307397';

self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE && k !== ROM_CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

// Allow the page to clear the ROM cache (e.g. from a "Clear cache" button)
self.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'CLEAR_ROM_CACHE') {
        caches.delete(ROM_CACHE).then(function() {
            if (e.source) e.source.postMessage({ type: 'ROM_CACHE_CLEARED' });
        });
    }
});

self.addEventListener('fetch', function(e) {
    var url = e.request.url;
    var urlObj = new URL(url);

    // Intercept ROM requests — serve from cache or fetch via GitHub API with token
    if (urlObj.pathname === ROM_URL_PATH || urlObj.pathname.endsWith('/pokemon-black-rom.zip')) {
        e.respondWith(
            caches.open(ROM_CACHE).then(function(cache) {
                return cache.match('rom').then(function(cached) {
                    if (cached) return cached;

                    var token = urlObj.searchParams.get('t');
                    if (!token) {
                        return new Response('No token provided', { status: 401, statusText: 'No token' });
                    }

                    return fetch(ROM_ASSET_URL, {
                        headers: {
                            'Authorization': 'token ' + token,
                            'Accept': 'application/octet-stream'
                        }
                    }).then(function(response) {
                        if (response.ok) {
                            cache.put('rom', response.clone());
                            return response;
                        }
                        // Non-200: surface the error to all clients
                        return response.text().then(function(body) {
                            var msg = 'GitHub error ' + response.status + ': ' + body.slice(0, 300);
                            self.clients.matchAll().then(function(clients) {
                                clients.forEach(function(c) {
                                    c.postMessage({ type: 'ROM_FETCH_ERROR', status: response.status, msg: msg });
                                });
                            });
                            return new Response(msg, { status: response.status, statusText: 'ROM fetch failed' });
                        });
                    }).catch(function(err) {
                        var msg = 'Network error fetching ROM: ' + err.message;
                        self.clients.matchAll().then(function(clients) {
                            clients.forEach(function(c) {
                                c.postMessage({ type: 'ROM_FETCH_ERROR', status: 0, msg: msg });
                            });
                        });
                        return new Response(msg, { status: 503, statusText: 'Network error' });
                    });
                });
            })
        );
        return;
    }

    // Cache EmulatorJS CDN assets and the GBA ROM
    var shouldCache = url.includes('pokeemerald_ee_debug.gba') ||
                      url.includes('cdn.emulatorjs.org');

    if (!shouldCache) return;

    e.respondWith(
        caches.open(CACHE).then(function(cache) {
            return cache.match(e.request).then(function(cached) {
                if (cached) return cached;
                return fetch(e.request).then(function(response) {
                    if (response.ok) cache.put(e.request, response.clone());
                    return response;
                });
            });
        })
    );
});
