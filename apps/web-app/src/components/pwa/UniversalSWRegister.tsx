'use client';

/**
 * ============================================================================
 * UNIVERSAL SW REGISTER — Enregistre le SW UNIFIÉ /sw.js sur TOUTES les pages
 * ============================================================================
 *
 * Monté dans le layout root (app/layout.tsx) pour couvrir :
 *   - Site public (academiahelm.com)
 *   - Pages de login (/login, /admin-login)
 *   - Portails (teacher, parent, school)
 *   - App authentifiée (/app/*)
 *
 * ⭐ V3 (sept. 2026) — UN SEUL SERVICE WORKER : /sw.js (scope '/').
 *    Le SW unifié gère TOUT : web push, app-shell offline pour /app/*,
 *    background sync de l'outbox, pré-cache des modules.
 *    AUCUNE page « Mode hors ligne » plein écran n'existe : hors ligne,
 *    le shell /app est servi depuis le cache et un toast ≤ 10 s informe
 *    l'utilisateur (OfflineIndicator) — il continue à travailler.
 *
 * Ce composant fait AUSSI la migration des clients existants :
 *    - register('/sw.js') remplace tout SW au même scope ;
 *    - les ANCIENS SW (sw-offline.js, sw-site.js, sw-chat.js, workbox)
 *      sont explicitement désenregistrés pour stopper le ping-pong
 *      d'enregistrements concurrents.
 * ============================================================================
 */

import { useEffect } from 'react';

export function UniversalSWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    (async () => {
      try {
        // ─── 1. Enregistrer le SW unifié (idempotent : no-op si déjà actif) ──
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Un nouveau SW attend son activation → SKIP_WAITING pour basculer
        // immédiatement (le nouveau SW fait clients.claim() à l'activation)
        registration.addEventListener('waiting', (event) => {
          (event.target as any)?.postMessage?.({ type: 'SKIP_WAITING' });
        });

        // Vérifier les mises à jour au retour d'onglet (au-delà du check
        // navigateur max 24h — accélère la prise en charge des déploiements)
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', onVisible);
      } catch (err) {
        console.warn('[SW] Failed to register unified SW:', err);
      }

      // ─── 2. MIGRATION : désenregistrer les anciens service workers ────────
      //    (ping-pong d'enregistrements concurrents au même scope : le
      //    dernier enregistré remplaçait l'autre — push ↔ offline en
      //    alternance selon la page visitée. Désormais : /sw.js partout.)
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          const swUrl = reg.active?.scriptURL || '';
          const isLegacy =
            swUrl.includes('sw-offline.js') ||
            swUrl.includes('sw-site.js') ||
            swUrl.includes('sw-chat.js') ||
            swUrl.includes('workbox') ||
            // tout SW d'un chemin non-racine autre que /sw.js
            (swUrl && !/\/sw\.js(\?.*)?$/.test(swUrl));
          if (isLegacy) {
            console.log('[SW] Unregistering legacy SW:', swUrl);
            await reg.unregister();
          }
        }
      } catch (err) {
        console.warn('[SW] Legacy SW cleanup failed:', err);
      }

      // ─── 3. Écouter les messages du SW (info seulement) ──────────────────
      // (BACKGROUND_SYNC_TRIGGER et NOTIFICATION_CLICK sont gérés par
      //  auto-sync-trigger.ts et usePushSubscription.ts respectivement)
    })();
  }, []);

  return null;
}
