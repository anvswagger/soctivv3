const CACHE_NAME = 'soctiv-crm-v8';
const STATIC_ASSETS = [
    '/manifest.webmanifest',
    '/pwa-icon-192.webp',
    '/pwa-icon-512.webp',
    '/offline.html'
];

const OFFLINE_ROUTE_CONFIG = {
    '/api/leads': { cacheKey: '/pending-leads', syncTag: 'sync-leads' },
    '/api/appointments': { cacheKey: '/pending-appointments', syncTag: 'sync-appointments' },
    '/api/analytics/events': { cacheKey: '/pending-analytics', syncTag: 'sync-analytics' },
};
const OFFLINE_CAPABLE_ROUTES = Object.keys(OFFLINE_ROUTE_CONFIG);

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
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((name) => name !== CACHE_NAME)
                .map((name) => {
                    console.log('[SW] Deleting old cache:', name);
                    return caches.delete(name);
                })
        );

        await self.clients.claim();

        console.log('[SW] New version activated, notifying clients...');
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => {
            client.postMessage({
                type: 'SW_UPDATE',
                message: 'New version available!'
            });
            client.postMessage({ type: 'SW_UPDATED' });
        });
    })());
});

async function queueOfflineRequest(pathname, request) {
    const routeConfig = OFFLINE_ROUTE_CONFIG[pathname];
    if (!routeConfig) return false;

    let payload;
    try {
        payload = await request.clone().json();
    } catch {
        payload = await request.clone().text();
    }

    const cache = await caches.open(CACHE_NAME);
    const pendingResponse = await cache.match(routeConfig.cacheKey);
    const pendingItems = pendingResponse ? await pendingResponse.json() : [];
    const normalizedPendingItems = Array.isArray(pendingItems) ? pendingItems : [];
    normalizedPendingItems.push(payload);

    await cache.put(
        routeConfig.cacheKey,
        new Response(JSON.stringify(normalizedPendingItems), {
            headers: { 'Content-Type': 'application/json' },
        }),
    );

    try {
        if ('sync' in self.registration) {
            await self.registration.sync.register(routeConfig.syncTag);
        }
    } catch (error) {
        console.warn('[SW] Background sync registration failed:', error);
    }

    return true;
}

// Fetch strategy:
// - Navigation: network first, offline.html fallback
// - Essential static assets: cache first
// - Everything else: network only (avoid stale JS chunk cache mismatches)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

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

    // Queue selected POST payloads for background sync when offline.
    if (request.method === 'POST' && OFFLINE_CAPABLE_ROUTES.includes(url.pathname)) {
        event.respondWith(
            fetch(request.clone()).catch(async () => {
                await queueOfflineRequest(url.pathname, request);
                return new Response(
                    JSON.stringify({ queued: true, offline: true }),
                    {
                        status: 202,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }),
        );
        return;
    }

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // For navigation requests (HTML pages): always try network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(async () => (await caches.match('/offline.html')) || Response.error())
        );
        return;
    }

    // For static assets: cache first, then network
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(url.pathname).then((cached) => {
                return cached || fetch(request).then((response) => {
                    if (response && response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(url.pathname, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // For runtime assets and API calls, avoid cache writes to prevent stale deploy artifacts.
    event.respondWith(fetch(request));
});

// Push notification event handler
const NOTIFICATION_VALUE_LABELS = {
    scheduled: 'مجدول',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    no_show: 'لم يحضر',
    appointment_booked: 'موعد محجوز',
    contacting: 'تواصل',
    interviewed: 'تمت المقابلة',
    sold: 'تم البيع',
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
};

function normalizeDigitsToLatin(value) {
    return value
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function normalizePushBodyText(value) {
    if (!value) return '';

    let text = String(value).replace(/[\u200E\u200F\u061C]/g, '').trim();
    text = normalizeDigitsToLatin(text);
    text = text.replace(/\bno[\s_-]?show\b/gi, 'لم يحضر');
    text = text.replace(/\b(?:scheduled|completed|cancelled|no_show|appointment_booked|contacting|interviewed|sold|pending|approved|rejected)\b/gi, (token) => {
        const key = token.toLowerCase().replace(/[\s-]+/g, '_');
        return NOTIFICATION_VALUE_LABELS[key] || token;
    });

    return text.replace(/\s{2,}/g, ' ');
}

// Push event ring buffer (last 10 events) stored in localStorage so the
// main app can inspect them from DevTools without opening the SW console.
// Useful for debugging "no notification appears" reports.
const PUSH_EVENT_LOG_KEY = 'soctiv_sw_push_events';
const PUSH_EVENT_LOG_MAX = 10;

async function recordPushEvent(entry) {
    try {
        // BroadcastChannel is the only cross-context storage in a SW that's
        // not blocked by some browsers (e.g. private mode in Safari). The
        // main app subscribes to 'soctiv_sw_events' and persists into
        // localStorage on receipt.
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('soctiv_sw_events');
            channel.postMessage({ type: 'PUSH_EVENT', payload: entry });
            channel.close();
        }
    } catch (error) {
        // Non-fatal: ring buffer is best-effort.
        console.warn('[SW] recordPushEvent failed:', error);
    }
}

self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);

    let notificationData = {
        title: 'Soctiv CRM',
        body: 'لديك إشعار جديد',
        icon: '/pwa-icon-192.webp',
        badge: '/pwa-icon-192.webp',
        data: {}
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || notificationData.title,
                body: normalizePushBodyText(data.body || notificationData.body),
                icon: data.icon || notificationData.icon,
                badge: data.badge || notificationData.badge,
                data: data.data || {},
                tag: data.tag,
                requireInteraction: data.requireInteraction || false
            };
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
            notificationData.body = normalizePushBodyText(event.data.text());
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
        }).then(() => {
            recordPushEvent({
                at: new Date().toISOString(),
                title: notificationData.title,
                body: notificationData.body,
                tag: notificationData.tag,
                url: notificationData.data && notificationData.data.url ? notificationData.data.url : null,
            });
        }).catch((err) => {
            recordPushEvent({
                at: new Date().toISOString(),
                error: 'showNotification failed: ' + (err && err.message ? err.message : String(err)),
            });
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

async function postMessageToAllClients(message) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
        if (client.postMessage) {
            client.postMessage(message);
        }
    });
}

async function getVapidPublicKey() {
    const origin = self.location.origin;
    try {
        const response = await fetch(`${origin}/functions/push-config`);
        if (!response.ok) {
            throw new Error(`push-config returned ${response.status}`);
        }
        const data = await response.json();
        const key = typeof data?.web_push_public_key === 'string' ? data.web_push_public_key.trim() : '';
        if (!key) {
            throw new Error('push-config did not return a public key');
        }
        return key;
    } catch (error) {
        console.error('[SW] Failed to load VAPID public key:', error);
        throw error;
    }
}

// Push subscription change handler: re-subscribe when browser invalidates subscription.
// This keeps the backend subscription key fresh without requiring user interaction.
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Subscription changed, re-subscribing...');
    event.waitUntil(
        (async () => {
            try {
                const vapidPublicKey = await getVapidPublicKey();
                const registration = self.registration;
                const oldSubscription = event.oldSubscription;
                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                });

                if (!oldSubscription) {
                    console.log('[SW] New subscription created (no old subscription)');
                    return;
                }

                await postMessageToAllClients({
                    type: 'PUSH_SUBSCRIPTION_UPDATED',
                    subscription: {
                        endpoint: newSubscription.endpoint,
                        keys: {
                            p256dh: newSubscription.toJSON().keys?.p256dh,
                            auth: newSubscription.toJSON().keys?.auth,
                        },
                    },
                });
            } catch (error) {
                console.error('[SW] Re-subscription failed:', error);
            }
        })()
    );
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
            const pendingQueue = Array.isArray(leads) ? leads : [];
            const remainingLeads = [];

            for (const lead of pendingQueue) {
                try {
                    const response = await fetch('/api/leads', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lead)
                    });

                    if (response.ok) {
                        console.log('[SW] Synced lead:', lead?.id);
                    } else {
                        remainingLeads.push(lead);
                    }
                } catch {
                    remainingLeads.push(lead);
                }
            }

            // Update pending cache
            await cache.put('/pending-leads', new Response(JSON.stringify(remainingLeads)));
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
            const pendingQueue = Array.isArray(appointments) ? appointments : [];
            const remainingAppointments = [];

            for (const appointment of pendingQueue) {
                try {
                    const response = await fetch('/api/appointments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(appointment)
                    });

                    if (response.ok) {
                        console.log('[SW] Synced appointment:', appointment?.id);
                    } else {
                        remainingAppointments.push(appointment);
                    }
                } catch {
                    remainingAppointments.push(appointment);
                }
            }

            await cache.put('/pending-appointments', new Response(JSON.stringify(remainingAppointments)));
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
            const pendingQueue = Array.isArray(events) ? events : [];
            const remainingEvents = [];

            for (const event of pendingQueue) {
                try {
                    const response = await fetch('/api/analytics/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(event)
                    });
                    if (!response.ok) {
                        remainingEvents.push(event);
                    }
                } catch {
                    remainingEvents.push(event);
                }
            }

            await cache.put('/pending-analytics', new Response(JSON.stringify(remainingEvents)));
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
