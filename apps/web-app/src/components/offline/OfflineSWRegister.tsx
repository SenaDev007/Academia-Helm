'use client';

/**
 * ============================================================================
 * OFFLINE SW REGISTER — Enregistre le Service Worker offline-first
 * ============================================================================
 *
 * Enregistre /sw-offline.js qui met en cache les routes API et les assets
 * pour permettre le mode offline-first sur le navigateur web (Vercel).
 *
 * Monté dans layout-client.tsx.
 * ============================================================================
 */

import { useEffect } from 'react';

export function OfflineSWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // ⭐ Ne pas enregistrer en dev (sauf si explicitement demandé)
    if (process.env.NODE_ENV === 'development') return;

    // ⭐ Ne pas enregistrer si déjà enregistré
    if (navigator.serviceWorker.controller) {
      // Vérifier si c'est déjà le bon SW
      const registrations = navigator.serviceWorker.getRegistrations();
      registrations.then((regs) => {
        const hasOfflineSW = regs.some((r) =>
          r.active?.scriptURL?.includes('sw-offline.js')
        );
        if (!hasOfflineSW) {
          registerSW();
        }
      });
    } else {
      registerSW();
    }

    function registerSW() {
      navigator.serviceWorker
        .register('/sw-offline.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Offline service worker registered:', registration.scope);
        })
        .catch((err) => {
          console.warn('[SW] Failed to register offline service worker:', err);
        });
    }
  }, []);

  return null;
}
