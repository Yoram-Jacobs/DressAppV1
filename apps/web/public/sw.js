/* DressApp Service Worker for Web Push notifications (Phase Scheduler) */

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
