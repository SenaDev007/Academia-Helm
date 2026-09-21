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

    // ⭐ V4.0 — PONT SW → PAGE (spec « interception réseau » §4-§5) :
    //    - OUTBOX_CHANGED / OUTBOX_SYNCED : le SW a mis une mutation en file
    //      (ou terminé un replay) → on dispatch l'événement DOM
    //      'outbox-changed' (les hooks useEntitySyncStatus écoutent → badge
    //      « en attente de synchronisation » IMMÉDIAT — la file vit dans le
    //      SW, il faut bien un pont pour prévenir la page) ;
    //    - OUTBOX_SYNCED déclenche aussi 'sync-end' (invalidation des
    //      queries React — données rafraîchies après reconnexion).
    const handleSwMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === 'OUTBOX_CHANGED' || type === 'OUTBOX_SYNCED') {
        try { window.dispatchEvent(new CustomEvent('outbox-changed')); } catch { /* non-bloquant */ }
      }
      if (type === 'OUTBOX_SYNCED') {
        // ⭐ FIX « toast échec en boucle » : le payload du SW
        //    ({ type, replayed, failed, stillPending, source }) n'a PAS de champ
        //    « success » — le SyncToast l'interprétait comme `success ?? false`
        //    → toast « Erreur de synchronisation » à CHAQUE retry du SW alors
        //    que RIEN n'avait définitivement échoué (événements simplement
        //    restés en file : serveur injoignable / 5xx transitoire).
        //    On traduit désormais en SyncResult complet :
        //    - success = aucun échec définitif ET file vide ;
        //    - pending = événements restés en file (transitoire — le toast
        //      NE doit PAS s'afficher pour ça, la pastille de sync informe déjà).
        const d = event.data || {};
        const replayed = Number(d.replayed) || 0;
        const failed = Number(d.failed) || 0;
        const stillPending = Number(d.stillPending) || 0;
        try {
          window.dispatchEvent(
            new CustomEvent('sync-end', {
              detail: {
                success: failed === 0 && stillPending === 0,
                successful: replayed,
                failed,
                conflicted: 0,
                pending: stillPending,
                total: replayed + failed + stillPending,
                source: 'sw',
              },
            }),
          );
        } catch { /* non-bloquant */ }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    // ⭐ V4.0 — PAGE → SW : au retour du réseau, demander au SW de rejouer SA
    //    file (Background Sync peut retarder/être absent — iOS Safari) :
    //    postMessage TRIGGER_SYNC → swReplayPendingMutations.
    const handleOnline = () => {
      try {
        navigator.serviceWorker.controller?.postMessage({ type: 'TRIGGER_SYNC' });
      } catch { /* non-bloquant */ }
    };
    window.addEventListener('online', handleOnline);

    // ⭐ Ne pas enregistrer en dev sauf si ?sw=1 dans l'URL (pour tester offline)
    if (process.env.NODE_ENV === 'development') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sw') !== '1') {
        // ⛔ En dev sans ?sw=1, le SW n'est pas actif — les listeners ci-dessus
        //    sont inutiles : on les retire avant de sortir.
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
        window.removeEventListener('online', handleOnline);
        return;
      }
      console.log('[SW] Dev mode: unified SW enabled via ?sw=1');
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Basculer immédiatement si une mise à jour du SW attend
        registration.addEventListener('waiting', (event) => {
          (event.target as any)?.postMessage?.({ type: 'SKIP_WAITING' });
        });

        // ⭐ v3.5.0 — Communiquer l'origine réelle de l'API au SW (pour
        //    l'interception cross-origin des GET axios — le SW est isolé du
        //    DOM et ne peut pas lire getApiBaseUrl() lui-même ; un
        //    redémarrage du SW perd la valeur → renvoyée à chaque register).
        navigator.serviceWorker.ready
          .then(async (reg) => {
            const sw = reg.active;
            if (!sw) return;
            try {
              const { getApiBaseUrl } = await import('@/lib/utils/urls');
              const apiBase = getApiBaseUrl();
              if (apiBase) {
                sw.postMessage({ type: 'SET_API_ORIGIN', origin: apiBase });
              }
            } catch {
              /* non-bloquant — le SW dérive api.<domaine> par défaut */
            }
          })
          .catch(() => { /* non-bloquant */ });
      })
      .catch((err) => {
        console.warn('[SW] Failed to register unified service worker:', err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}
