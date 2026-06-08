// Service Worker — cache-on-demand for ROM and EmulatorJS assets
const CACHE = 'pokemon-emu-v2';

self.addEventListener('install', function(e) {
    // Nothing to pre-cache — just activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(e) {
    var url = e.request.url;

    var shouldCache = url.includes('pokeemerald_ee_debug.gba') ||
                      url.includes('cdn.emulatorjs.org');

    if (!shouldCache) return;

    e.respondWith(
        caches.open(CACHE).then(function(cache) {
            return cache.match(e.request).then(function(cached) {
                if (cached) {
                    console.log('[SW] Serving from cache:', url);
                    return cached;
                }
                console.log('[SW] Fetching and caching:', url);
                return fetch(e.request).then(function(response) {
                    if (response.ok) {
                        cache.put(e.request, response.clone());
                    }
                    return response;
                });
            });
        })
    );
});
