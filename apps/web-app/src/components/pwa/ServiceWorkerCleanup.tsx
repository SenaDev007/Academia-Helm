'use client';

import { useEffect } from 'react';

/**
 * Service Worker Cleanup Component
 *
 * On Vercel, PWA/Workbox is disabled. This component:
 * 1. Listens for the SW_UNREGISTER message from the self-unregistering sw.js
 * 2. Forces a page reload after the old SW is cleaned up
 * 3. Proactively unregisters any stale Workbox service workers
 *
 * This fixes ERR_FAILED / no-response errors caused by stale Workbox
 * service workers after deployments.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Listen for the self-unregister message from sw.js
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UNREGISTER') {
        console.log('[SW-Cleanup] Received unregister message, reloading...');
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Proactively check and unregister any stale service workers
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const swUrl = registration.active?.scriptURL || '';
          // Unregister Workbox-based SWs (old PWA) and stale sw.js registrations
          // — mais PAS notre nouveau /sw.js de Web Push (qui gère push + notificationclick)
          // On vérifie que ce n'est pas le sw.js à la racine du domaine (notre SW push)
          const isOurPushSW = /\/sw\.js(\?.*)?$/.test(swUrl) && !swUrl.includes('/workbox');
          if (isOurPushSW) {
            // Notre SW push — ne pas supprimer
            continue;
          }
          if (swUrl.includes('workbox') || swUrl.includes('sw.js')) {
            console.log('[SW-Cleanup] Unregistering stale SW:', swUrl);
            await registration.unregister();
          }
        }

        // Also clean up any leftover caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          const staleCaches = cacheNames.filter(
            (name) =>
              name.startsWith('local-') ||
              name.startsWith('workbox-precache') ||
              name.includes('workbox')
          );
          if (staleCaches.length > 0) {
            console.log('[SW-Cleanup] Clearing stale caches:', staleCaches);
            await Promise.all(staleCaches.map((name) => caches.delete(name)));
          }
        }
      } catch (err) {
        console.warn('[SW-Cleanup] Error during cleanup:', err);
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return null;
}
