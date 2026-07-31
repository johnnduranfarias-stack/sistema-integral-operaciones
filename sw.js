const CACHE_NAME = 'ferpacific-ops-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/logo.png',
  '/logo.ico',
  '/login_bg.png',
  '/sidebar_bg.png',
  '/app_bg.png'
];

// Install Event - Cache Core Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching core static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Never intercept API requests; only cache static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // DO NOT INTERCEPT API REQUESTS (Let browser handle them natively)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For Static Assets (HTML, CSS, JS, Images): Cache First with Network Fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch background update for cache
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
