// Service Worker — caches ROM and EmulatorJS core files
const CACHE = 'pokemon-emu-v1';

// Files to pre-cache on install
const PRECACHE = [
    'pokeemerald_ee_debug.gba'
];

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(PRECACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    // Remove old caches
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

    // Cache the ROM and EmulatorJS CDN files
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
