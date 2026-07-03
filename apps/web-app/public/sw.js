/**
 * Service Worker — Web Push notifications
 * ============================================================================
 *
 * Gère les notifications push reçues même quand l'onglet est fermé.
 * Pour activer : le frontend appelle navigator.serviceWorker.register('/sw.js')
 * puis pushManager.subscribe({ applicationServerKey: <VAPID_PUBLIC_KEY> }).
 *
 * Endpoints gérés :
 *   - push        : afficher la notification système
 *   - notificationclick : focus l'onglet existant ou ouvre l'URL
 *   - pushsubscriptionchange : re-souscription (postMessage au client)
 *
 * Note : ce SW est distinct du SW Workbox (next-pwa) qui gère le cache offline.
 * ============================================================================
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push event : afficher la notification ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Notification', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Academia Helm';
  const options = {
    body: data.body || '',
    icon: data.icon || '/images/logo-Academia Hub.png',
    badge: data.badge || '/web-app-manifest-192x192.png',
    data: {
      url: data.data?.url || '/',
      notificationId: data.data?.notificationId || null,
    },
    tag: data.tag || 'academia-helm-notification',
    requireInteraction: data.requireInteraction || false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click : focus ou ouvrir l'URL ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher un onglet existant sur la même origine
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // PostMessage pour que le frontend navigue vers l'URL
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Aucun onglet ouvert → en ouvrir un nouveau
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// ─── Push subscription change : re-souscription ───────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
      });
    }),
  );
});
