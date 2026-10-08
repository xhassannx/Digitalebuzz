const CACHE_NAME = 'helicoptic-whatsapp-v3';
const STATIC_CACHE_NAME = 'helicoptic-static-v3';

// Install event — do not cache /manifest.json (icons come from Website Builder branding).
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network first for HTML, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache same-origin http(s) requests (skip chrome-extension:, blob:, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip caching for API routes
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Always fetch a fresh PWA manifest so install icons match Website Builder branding.
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)).then((response) => {
        if (response) return response;
        return new Response('{}', { status: 503, statusText: 'Service Unavailable' });
      })
    );
    return;
  }

  // For HTML documents, always fetch from network first (no caching)
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .then((response) => {
          // respondWith() requires a Response; caches.match() can return undefined
          if (response) return response;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, etc.), use cache first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version, but also update cache in background
          fetch(request).then((networkResponse) => {
            if (networkResponse.ok && (url.protocol === 'http:' || url.protocol === 'https:')) {
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone()).catch(() => {
                  // Ignore unsupported request schemes (e.g. extension assets)
                });
              });
            }
          }).catch(() => {
            // Network update failed, but we have cached version
          });
          return cachedResponse;
        }
        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.ok && (url.protocol === 'http:' || url.protocol === 'https:')) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseClone).catch(() => {
                  // Ignore unsupported request schemes (e.g. extension assets)
                });
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed and not in cache - must return a Response
            if (request.destination === 'document') {
              return caches.match('/');
            }
            return new Response('Not found', { status: 404, statusText: 'Not Found' });
          });
      })
  );
});

// Handle messages from the page to show notifications (works in all tabs and when app is in background)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const opts = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag || 'helicoptic-notification',
      requireInteraction: false,
      silent: false,
      ...options,
    };
    const p = self.registration.showNotification(title, opts).catch(function (err) {
      console.error('[SW] showNotification failed:', err);
    });
    event.waitUntil(p);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle notification clicks - focus app window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const origin = self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(origin + '/');
      }
    })
  );
});