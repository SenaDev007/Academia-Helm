/**
 * Self-unregistering Service Worker for Vercel deployments.
 *
 * On Vercel, PWA/Workbox is disabled (Vercel handles its own edge caching).
 * This SW replaces any previously-registered Workbox SW, clears all caches,
 * and unregisters itself so the browser stops intercepting fetch requests.
 *
 * This fixes:
 * - ERR_FAILED / no-response errors from stale Workbox precache
 * - Chunk load errors after deployments (old chunks cached by SW)
 * - Cloudflare beacon / Vercel JWE interception errors
 */

const CACHE_PREFIX = 'local-';
const WORKBOX_CACHE_PREFIX = 'workbox-precache';

self.addEventListener('install', (event) => {
  // Skip waiting so this SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL caches (old Workbox caches + any app caches)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) ||
              name.startsWith(WORKBOX_CACHE_PREFIX) ||
              name.includes('workbox') ||
              name.includes('next-static') ||
              name.includes('api-cache') ||
              name.includes('offline') ||
              name.includes('html-cache') ||
              name.includes('fonts-cache') ||
              name.includes('images-cache') ||
              name.includes('static-assets')
          )
          .map((name) => {
            console.log('[SW-Cleanup] Deleting cache:', name);
            return caches.delete(name);
          })
      );

      // Take control of all clients immediately
      await self.clients.claim();

      // Unregister this service worker from all clients
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SW_UNREGISTER' });
      }

      // Self-unregister
      const registration = await self.registration.unregister();
      console.log('[SW-Cleanup] Self-unregistered:', registration);
    })()
  );
});

// Pass-through: no fetch interception at all
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SW_UNREGISTER') {
    self.registration.unregister();
  }
});
