'use client';

/**
 * ============================================================================
 * UNIVERSAL SW REGISTER — Enregistre le SW offline sur TOUTES les pages
 * ============================================================================
 *
 * Monté dans le layout root (app/layout.tsx) pour couvrir :
 *   - Site public (academiahelm.com)
 *   - Pages de login (/login, /admin-login)
 *   - Portails (teacher, parent, school)
 *   - App authentifiée (/app/*)
 *
 * Le SW met en cache :
 *   - Toutes les pages HTML visitées → NetworkFirst (3s timeout)
 *   - Toutes les routes API → NetworkFirst (5s timeout)
 *   - Les assets statiques → StaleWhileRevalidate
 *   - Les images/fonts → CacheFirst (30 jours)
 *
 * Une fois qu'un utilisateur a visité une page en ligne, elle est cachée
 * et accessible offline. Le login API ne peut pas fonctionner offline,
 * mais si l'utilisateur a une session valide (token en localStorage),
 * il peut accéder à l'app directement.
 * ============================================================================
 */

import { useEffect } from 'react';

export function UniversalSWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    // ⭐ Ne pas enregistrer si déjà enregistré
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const hasOfflineSW = registrations.some(
        (r) => r.active?.scriptURL?.includes('sw-offline.js')
      );
      if (!hasOfflineSW) {
        navigator.serviceWorker
          .register('/sw-offline.js', { scope: '/' })
          .then((registration) => {
            console.log('[SW] Universal offline SW registered:', registration.scope);
          })
          .catch((err) => {
            console.warn('[SW] Failed to register:', err);
          });
      }
    });

    // ⭐ Écouter les messages du SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'OFFLINE_FALLBACK') {
        console.log('[SW] Serving from cache (offline fallback)');
      }
    });
  }, []);

  return null;
}
