/**
 * Self-Unregistering Service Worker
 *
 * This service worker immediately unregisters itself on install.
 * It exists solely to replace any stale Workbox/PWA service workers
 * that may still be cached in users' browsers from a previous deployment.
 *
 * When a user visits the site, the browser fetches this sw.js file,
 * which triggers the uninstall of the old Workbox-based service worker.
 * The ServiceWorkerCleanup component on the frontend also listens for
 * the SW_UNREGISTER message and reloads the page after cleanup.
 *
 * This fixes ERR_FAILED / no-response errors caused by stale Workbox
 * service workers after deployments.
 */

// Immediately self-unregister on install
self.addEventListener('install', () => {
  // Skip waiting so this SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients so the SW_UNREGISTER message reaches them
  event.waitUntil(
    self.clients.claim().then(() => {
      // Notify all clients that this SW is unregistering
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UNREGISTER' });
        });
        // Now unregister this service worker
        return self.registration.unregister();
      });
    })
  );
});

// Pass-through fetch handler — no caching, no interception
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
