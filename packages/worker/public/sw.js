var CACHE_NAME = 'meet-ai-v5';

self.addEventListener('install', function (_e) {
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
  }
});

// --- Background Sync: flush offline message queue ---
self.addEventListener('sync', function (e) {
  if (e.tag === 'send-messages') {
    e.waitUntil(flushOutbox());
  }
});

function openOutbox() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open('meet-ai-queue', 1);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'tempId' });
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function flushOutbox() {
  return openOutbox().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('outbox', 'readonly');
      var store = tx.objectStore('outbox');
      var req = store.getAll();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    }).then(function (messages) {
      return Promise.all(messages.map(function (msg) {
        return fetch(`/api/rooms/${msg.roomId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${msg.apiKey}`,
          },
          body: JSON.stringify({ sender: msg.sender, content: msg.content }),
        }).then(function (res) {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          // Remove from queue on success
          var delTx = db.transaction('outbox', 'readwrite');
          delTx.objectStore('outbox').delete(msg.tempId);
          // Notify client
          notifyClients({ type: 'sync-sent', tempId: msg.tempId });
        }).catch(function () {
          notifyClients({ type: 'sync-failed', tempId: msg.tempId });
        });
      }));
    });
  });
}

function notifyClients(data) {
  self.clients.matchAll().then(function (clients) {
    for (var client of clients) {
      client.postMessage(data);
    }
  });
}

// --- Notification click: focus the chat tab ---
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var client of clients) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/chat');
      }
    })
  );
});
