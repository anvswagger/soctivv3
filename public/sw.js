const CACHE_NAME = 'soctiv-crm-v3';
const STATIC_ASSETS = [
    '/manifest.webmanifest',
    '/pwa-icon-192.png',
    '/pwa-icon-512.png',
    '/offline.html'
];

// API routes that should work offline with background sync
const OFFLINE_CAPABLE_ROUTES = [
    '/api/leads',
    '/api/clients',
    '/api/appointments'
];

const IS_LOCAL_DEV = self.location.hostname === '127.0.0.1' || self.location.hostname === 'localhost';

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
            console.log('[SW] New version activated, notifying clients...');
            // Notify all clients about the update
            return self.clients.matchAll({ type: 'window' });
        }).then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'SW_UPDATE',
                    message: 'New version available!'
                });
            });
        });
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

    // Never handle Vite/dev-module requests from service worker.
    if (
        IS_LOCAL_DEV
        || url.pathname.startsWith('/src/')
        || url.pathname.startsWith('/@vite')
        || url.pathname.startsWith('/node_modules/')
    ) {
        return;
    }

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

// Push notification event handler
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);

    let notificationData = {
        title: 'Soctiv CRM',
        body: 'You have a new notification',
        icon: '/pwa-icon.jpg',
        badge: '/pwa-icon.jpg',
        data: {}
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || notificationData.title,
                body: data.body || notificationData.body,
                icon: data.icon || notificationData.icon,
                badge: data.badge || notificationData.badge,
                data: data.data || {},
                tag: data.tag,
                requireInteraction: data.requireInteraction || false
            };
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            data: notificationData.data,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction
        })
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification);

    event.notification.close();

    const rawUrl = event.notification.data?.url || '/';
    const urlToOpen = new URL(rawUrl, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    const current = new URL(client.url);
                    const target = new URL(urlToOpen);
                    if (current.origin === target.origin && current.pathname === target.pathname && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Notification close handler (optional, for analytics)
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event.notification);
});

// Background Sync for offline data submissions
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);

    if (event.tag === 'sync-leads') {
        event.waitUntil(syncPendingLeads());
    } else if (event.tag === 'sync-appointments') {
        event.waitUntil(syncPendingAppointments());
    } else if (event.tag === 'sync-analytics') {
        event.waitUntil(syncPendingAnalytics());
    }
});

// Sync pending leads that were created while offline
async function syncPendingLeads() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const pendingLeads = await cache.match('/pending-leads');

        if (pendingLeads) {
            const leads = await pendingLeads.json();

            for (const lead of leads) {
                const response = await fetch('/api/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lead)
                });

                if (response.ok) {
                    console.log('[SW] Synced lead:', lead.id);
                    // Remove from pending list
                    leads.splice(leads.indexOf(lead), 1);
                }
            }

            // Update pending cache
            await cache.put('/pending-leads', new Response(JSON.stringify(leads)));
        }
    } catch (error) {
        console.error('[SW] Error syncing leads:', error);
    }
}

// Sync pending appointments
async function syncPendingAppointments() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const pendingAppointments = await cache.match('/pending-appointments');

        if (pendingAppointments) {
            const appointments = await pendingAppointments.json();

            for (const appointment of appointments) {
                const response = await fetch('/api/appointments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(appointment)
                });

                if (response.ok) {
                    console.log('[SW] Synced appointment:', appointment.id);
                    appointments.splice(appointments.indexOf(appointment), 1);
                }
            }

            await cache.put('/pending-appointments', new Response(JSON.stringify(appointments)));
        }
    } catch (error) {
        console.error('[SW] Error syncing appointments:', error);
    }
}

// Sync pending analytics events
async function syncPendingAnalytics() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const pendingAnalytics = await cache.match('/pending-analytics');

        if (pendingAnalytics) {
            const events = await pendingAnalytics.json();

            for (const event of events) {
                await fetch('/api/analytics/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                });
                events.splice(events.indexOf(event), 1);
            }

            await cache.put('/pending-analytics', new Response(JSON.stringify(events)));
        }
    } catch (error) {
        console.error('[SW] Error syncing analytics:', error);
    }
}

// Message handler for communication with the main app
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data.type === 'CACHE_LEAD') {
        cacheLeadData(event.data.lead);
    } else if (event.data.type === 'GET_CACHE_SIZE') {
        getCacheSize().then(size => {
            event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
        });
    } else if (event.data.type === 'CLEAR_CACHE') {
        clearCache().then(() => {
            event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
        });
    }
});

// Cache lead data for offline access
async function cacheLeadData(lead) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedLeads = await cache.match('/cached-leads');
        let leads = cachedLeads ? await cachedLeads.json() : [];

        // Update or add lead
        const existingIndex = leads.findIndex(l => l.id === lead.id);
        if (existingIndex >= 0) {
            leads[existingIndex] = lead;
        } else {
            leads.push(lead);
        }

        await cache.put('/cached-leads', new Response(JSON.stringify(leads)));
        console.log('[SW] Cached lead:', lead.id);
    } catch (error) {
        console.error('[SW] Error caching lead:', error);
    }
}

// Get total cache size
async function getCacheSize() {
    let totalSize = 0;
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }

    return totalSize;
}

// Clear all caches
async function clearCache() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] All caches cleared');
}
