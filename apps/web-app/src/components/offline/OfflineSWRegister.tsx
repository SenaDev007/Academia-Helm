'use client';

/**
 * ============================================================================
 * OFFLINE SW REGISTER — Enregistre le Service Worker UNIFIÉ /sw.js
 * ============================================================================
 *
 * ⭐ V3 (sept. 2026) : le SW unifié /sw.js (scope '/') gère l'app-shell
 *    offline pour /app/*, le background sync de l'outbox et le web push.
 *    Ce composant complète UniversalSWRegister (layout racine) côté /app :
 *    register() est idempotent — aucun risque de double enregistrement.
 *    Les anciens SW (sw-offline.js…) sont désinstallés par UniversalSWRegister.
 *
 * Monté dans layout-client.tsx.
 * ============================================================================
 */

import { useEffect } from 'react';

export function OfflineSWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // ⭐ Ne pas enregistrer en dev sauf si ?sw=1 dans l'URL (pour tester offline)
    if (process.env.NODE_ENV === 'development') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sw') !== '1') return;
      console.log('[SW] Dev mode: unified SW enabled via ?sw=1');
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Basculer immédiatement si une mise à jour du SW attend
        registration.addEventListener('waiting', (event) => {
          (event.target as any)?.postMessage?.({ type: 'SKIP_WAITING' });
        });
      })
      .catch((err) => {
        console.warn('[SW] Failed to register unified service worker:', err);
      });
  }, []);

  return null;
}
