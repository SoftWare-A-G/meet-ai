var CACHE_NAME = 'meet-ai-v3';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // API requests and WebSocket: pass-through, never cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  // HTML / navigation: always network, never cache
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    return;
  }

  // Static assets (images, icons, fonts): cache-first
  if (e.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        return cached || fetch(e.request).then(function (response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first, no caching
  return;
});
