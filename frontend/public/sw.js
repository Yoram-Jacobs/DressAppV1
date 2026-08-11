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
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/stylist?tab=match')
  );
});
