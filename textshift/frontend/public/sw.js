// Service Worker for TextShift PWA (Speed Optimization #23, Mobile Optimization #46)
// Provides offline support and caching

const CACHE_NAME = 'textshift-v2';
const STATIC_CACHE = 'textshift-static-v2';
const DYNAMIC_CACHE = 'textshift-dynamic-v2';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/images/logo.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (don't cache)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        if (!response.ok) {
          return response;
        }

        // Clone response for caching
        const responseToCache = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncPendingScans());
  }
});

async function syncPendingScans() {
  // Get pending scans from IndexedDB and sync them
  // This is a placeholder for actual implementation
  console.log('Syncing pending scans...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'TextShift';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
