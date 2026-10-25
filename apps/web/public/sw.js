/* DressApp Service Worker for Web Push notifications (Phase Scheduler) and Web Share Target */

/* Store shared image in IndexedDB for client retrieval */
function storeSharedMedia(file) {
  return new Promise(function(resolve, reject) {
    if (!self.indexedDB) {
      resolve(false);
      return;
    }
    var req = self.indexedDB.open('dressapp_share_store', 1);
    req.onupgradeneeded = function() {
      if (!req.result.objectStoreNames.contains('shares')) {
        req.result.createObjectStore('shares');
      }
    };
    req.onsuccess = function() {
      var db = req.result;
      var tx = db.transaction('shares', 'readwrite');
      tx.objectStore('shares').put(file, 'latest_shared_image');
      tx.oncomplete = function() {
        db.close();
        resolve(true);
      };
      tx.onerror = function() {
        db.close();
        reject(tx.error);
      };
    };
    req.onerror = function() {
      reject(req.error);
    };
  });
}

/* Intercept POST /share-target from Web Share Target API */
self.addEventListener('fetch', function(event) {
  var reqUrl;
  try {
    reqUrl = new URL(event.request.url);
  } catch (e) {
    return;
  }

  if (reqUrl.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async function() {
        try {
          var formData = await event.request.formData();
          var file = null;
          var mediaFiles = formData.getAll('media');
          if (!mediaFiles || mediaFiles.length === 0) {
            mediaFiles = formData.getAll('files');
          }
          if (mediaFiles && mediaFiles.length > 0 && mediaFiles[0].size > 0) {
            file = mediaFiles[0];
          }
          if (!file) {
            for (var pair of formData.entries()) {
              var val = pair[1];
              if (val && typeof val === 'object' && val.size > 0) {
                file = val;
                break;
              }
            }
          }
          var sharedUrl = formData.get('url') || '';
          var sharedText = formData.get('text') || '';
          var sharedTitle = formData.get('title') || '';

          if (file && file.size > 0) {
            await storeSharedMedia(file);
            var target = new URL('/share-target?shared_media=1', self.location.origin);
            if (sharedUrl) target.searchParams.set('url', sharedUrl);
            if (sharedText) target.searchParams.set('text', sharedText);
            if (sharedTitle) target.searchParams.set('title', sharedTitle);
            return Response.redirect(target.href, 303);
          }

          var target = new URL('/share-target', self.location.origin);
          if (sharedUrl) target.searchParams.set('url', sharedUrl);
          if (sharedText) target.searchParams.set('text', sharedText);
          if (sharedTitle) target.searchParams.set('title', sharedTitle);
          return Response.redirect(target.href, 303);
        } catch (err) {
          console.error('[sw] Failed to process share target POST:', err);
          return Response.redirect('/share-target', 303);
        }
      })()
    );
  }
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/favicon-48x48.png',
        badge: '/favicon-16x16.png',
        vibrate: [100, 50, 100],
        tag: data.tag || 'dressapp-notification',
        renotify: true,
        data: { url: data.url || '/stylist?tab=match' }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'DressApp', options)
      );
    } catch (e) {
      console.error("Failed to parse push event data:", e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/stylist?tab=match';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(function(c) {
              return c ? c.focus() : null;
            }).catch(function() {
              return clients.openWindow(targetUrl);
            });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
