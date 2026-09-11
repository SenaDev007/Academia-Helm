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
          // ⭐ V3 (sept. 2026) : UN SEUL SW légitime — /sw.js à la racine
          //    (web push + app-shell offline + background sync).
          //    Tout le reste est legacy (workbox PWA, sw-offline.js, sw-site.js,
          //    sw-chat.js) → unregister (stoppe le ping-pong d'enregistrements
          //    concurrents au scope '/').
          const isUnifiedSW = /\/sw\.js(\?.*)?$/.test(swUrl);
          if (isUnifiedSW) {
            // Notre SW unifié — ne pas supprimer
            continue;
          }
          if (swUrl) {
            console.log('[SW-Cleanup] Unregistering stale SW:', swUrl);
            await registration.unregister();
          }
        }

        // Also clean up any leftover caches (mais PAS nos caches offline-first)
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          const staleCaches = cacheNames.filter(
            (name) =>
              !name.startsWith('ah-') && // ⭐ Ne pas supprimer nos caches (ah-static-*, ah-pages-*, ah-auth-token)
              !name.startsWith('academia-helm') && // ⭐ Ni les caches PWA
              (name.startsWith('local-') ||
               name.startsWith('workbox-precache') ||
               name.includes('workbox'))
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
