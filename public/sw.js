// Auto-unregister & Cache Purge ServiceWorker to prevent stale asset locks
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Always fetch directly from Network, bypass cache
  return;
});
