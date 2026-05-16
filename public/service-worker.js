// ═══════════════════════════════════════════
//  HybridPOS Service Worker
//  Offline-first caching + background sync
// ═══════════════════════════════════════════

const CACHE_NAME    = 'hybridpos-v1.0.0';
const OFFLINE_URL   = '/public/offline.html';

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/public/',
    '/public/app.php',
    '/public/offline.html',
    '/public/assets/css/main.css',
    '/public/assets/js/app.js',
    '/public/assets/js/api.js',
    '/public/assets/js/pages/pos.js',
    '/public/assets/js/pages/products.js',
    '/public/assets/js/pages/categories.js',
    '/public/assets/js/pages/customers.js',
    '/public/assets/js/pages/dashboard.js',
    '/public/assets/js/pages/orders.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ── Install ──────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate ─────────────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch Strategy ───────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and API requests from cache strategy
    if (request.method !== 'GET') return;
    if (url.pathname.startsWith('/public/api/')) {
        event.respondWith(networkFirstWithOfflineQueue(request));
        return;
    }

    // Static assets: Cache first, fallback to network
    event.respondWith(cacheFirst(request));
});

// Cache First (for static assets)
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
    }
}

// Network First (for API — fallback to cached if offline)
async function networkFirstWithOfflineQueue(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ success: false, message: 'You are offline. Request queued.', offline: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// ── Background Sync ───────────────────────
self.addEventListener('sync', event => {
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncOfflineOrders());
    }
});

async function syncOfflineOrders() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_START' });
    });
}

// ── Push Messages ─────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});