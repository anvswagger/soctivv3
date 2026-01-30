const CACHE_NAME = 'soctiv-crm-v2';
const STATIC_ASSETS = [
    '/manifest.webmanifest',
    '/pwa-icon.jpg'
];

// Install: cache only essential static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new version...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => {
                console.log('[SW] Skip waiting - activating immediately');
                return self.skipWaiting();
            })
    );
});

// Activate: claim clients and clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating and claiming clients...');
    event.waitUntil(
        Promise.all([
            // Delete old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            }),
            // Take control of all clients immediately
            self.clients.claim()
        ]).then(() => {
            // Notify all clients that a new version is active
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SW_UPDATED' });
                });
            });
        })
    );
});

// Fetch: Network First strategy for HTML, Cache First for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests
    if (url.origin !== location.origin) return;

    // For navigation requests (HTML pages): always try network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache the fresh response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline: serve from cache
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('/');
                    });
                })
        );
        return;
    }

    // For static assets: cache first, then network
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')))) {
        event.respondWith(
            caches.match(request).then((cached) => {
                return cached || fetch(request).then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            })
        );
        return;
    }

    // For all other requests: network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Don't cache API responses or non-successful responses
                if (!response.ok || url.pathname.startsWith('/api')) {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                });
                return response;
            })
            .catch(() => caches.match(request))
    );
});
