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

    // ⭐ v4.7.0 — Timer du retry « fantôme online » (déclaré AVANT les
    //    early-returns du mode dev pour que le nettoyage final le voie
    //    toujours — cohérent avec le pattern des autres listeners).
    let phantomOnlineRetryTimer: ReturnType<typeof setTimeout> | null = null;
    // ⭐ 17/10/2026 — handler controllerchange (hoisted pour le nettoyage —
    //    StrictMode dev remonte le composant : sans retrait, deux listeners
    //    se cumuleraient avec chacun leur garde `refreshing`)
    let onControllerChange: (() => void) | null = null;

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
      // ⭐ v4.7.0 (retour terrain mobile 22/09/2026 — « la fiche sauvegardée
      //    sur smartphone n'apparaît pas, puis revient après plusieurs
      //    rechargements ») — FANTÔME ONLINE : le SW vient de mettre une
      //    mutation en file alors que le navigateur se CROIT en ligne
      //    (réseau mobile glitch sans transition offline→online).
      //    Avant : cette file n'était rejouée que par Background Sync
      //    (absent d'iOS Safari/Firefox, retardé sur Android) ou par
      //    l'événement window 'online' — qui ne se produit JAMAIS ici.
      //    Désormais : on redemande au SW de rejouer sa file 8 s plus tard
      //    — si le réseau est réellement utilisable, la sauvegarde part
      //    vers le serveur en quelques secondes ; sinon, les événements
      //    restent PENDING (aucune perte de données, nouvelle tentative
      //    au prochain déclencheur). Debounce : UNE tentative par salve
      //    de mises en file, jamais de tempête.
      if (type === 'OUTBOX_CHANGED' && typeof navigator !== 'undefined' && navigator.onLine) {
        if (phantomOnlineRetryTimer) clearTimeout(phantomOnlineRetryTimer);
        phantomOnlineRetryTimer = setTimeout(() => {
          phantomOnlineRetryTimer = null;
          try {
            navigator.serviceWorker.controller?.postMessage({ type: 'TRIGGER_SYNC' });
          } catch { /* non-bloquant */ }
        }, 8000);
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

    // ⭐ v4.7.0 — REPLAY AU CHARGEMENT DE PAGE (correctif mobile du
    //    22/09/2026) : l'enseignant dont la sauvegarde est partie en file
    //    pendant un glitch réseau RECHARGE la page pour vérifier → il faut
    //    que ce rechargement REJOUE la file (avant : seul l'événement
    //    'online' le faisait, or il ne se déclenche pas quand le
    //    navigateur n'est jamais passé hors ligne). Le SW vérifie lui-même
    //    navigator.onLine avant de tenter (v4.7.0) → hors ligne réel = no-op.
    //    controller est null au tout premier chargement (page pas encore
    //    contrôlée) → on retente via ready/active pour couvrir les
    //    rechargements suivants, qui sont précisément le scénario visé.
    try {
      const postTriggerSync = (sw: ServiceWorker | null) => {
        try { sw?.postMessage({ type: 'TRIGGER_SYNC' }); } catch { /* non-bloquant */ }
      };
      if (navigator.serviceWorker.controller) {
        postTriggerSync(navigator.serviceWorker.controller);
      } else {
        navigator.serviceWorker.ready
          .then((reg) => postTriggerSync(reg.active ?? null))
          .catch(() => { /* non-bloquant */ });
      }
    } catch { /* non-bloquant */ }

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

        // ⭐ FIX « bouton ne répond plus » (17/10/2026) — ATTERRISSAGE
        //    AUTOMATIQUE des mises à jour SW : sw.js appelle skipWaiting() à
        //    l'install, et ce composant poste SKIP_WAITING sur 'waiting' — mais
        //    la PAGE COURANTE continuait de tourner sur l'ANCIEN code JS
        //    (chunks du build précédent) jusqu'à ce que l'utilisateur recharge
        //    LUI-MÊME. Or un enseignant qui garde son onglet ouvert (ou dont le
        //    mobile restaure la page) ne recharge parfois jamais : il restait
        //    bloqué sur une modale au protocole périmé (extraction sync→async)
        //    qui échoue silencieusement — « le bouton ne fonctionne plus ».
        //    → controllerchange = un NOUVEAU SW a pris le contrôle : on
        //    recharge UNE SEULE FOIS (garde anti-boucle standard). La page
        //    rechargeée sert alors les chunks du NOUVEAU build.
        //    Garde `navigator.serviceWorker.controller` : les visiteurs de
        //    PREMIÈRE installation (controller null → nouveau) ne rechargent pas.
        if (navigator.serviceWorker.controller) {
          let refreshing = false;
          onControllerChange = () => {
            if (refreshing) return;
            refreshing = true;
            try { window.location.reload(); } catch { /* non-bloquant */ }
          };
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        }

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
      if (onControllerChange) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
      if (phantomOnlineRetryTimer) clearTimeout(phantomOnlineRetryTimer);
    };
  }, []);

  return null;
}
