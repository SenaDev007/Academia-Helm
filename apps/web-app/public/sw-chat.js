/**
 * ============================================================================
 * Service Worker for Academia Helm — Push Notifications
 * ============================================================================
 *
 * Handles push notifications for new chat messages.
 * Registered by the frontend via navigator.serviceWorker.register('/sw-chat.js').
 *
 * Events:
 *   - 'push': receives push notification from server (Web Push API)
 *   - 'notificationclick': opens the chat URL when user clicks the notification
 * ============================================================================
 */

const CHAT_URL = '/app/communication/messages';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ⭐ Receive push notification from server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Nouveau message', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Academia Helm — Nouveau message';
  const options = {
    body: data.body || data.preview || 'Vous avez reçu un nouveau message',
    icon: '/logos/logo.png',
    badge: '/logos/badge.png',
    tag: data.conversationId || 'chat-notification',
    data: {
      url: data.url || CHAT_URL,
      conversationId: data.conversationId,
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ⭐ Handle notification click — open the app and focus
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || CHAT_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('academiahelm') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
