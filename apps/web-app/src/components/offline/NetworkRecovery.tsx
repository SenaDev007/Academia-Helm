/**
 * ============================================================================
 * NETWORK RECOVERY — Récupération au retour de la connexion
 * ============================================================================
 *
 * ⭐ PROBLÈME (retour promoteur, sept. 2026) : « Au retour de la connexion
 *    internet, l'application ne recharge plus. Il faut recharger avant que
 *    les données mêmes ne se chargent normalement. »
 *
 *    L'app restait figée dans son état hors ligne (données vides, error
 *    boundary « Module en attente du réseau », sidebar dégradée) après le
 *    retour du réseau : seuls les hooks React Query se réveillaient, mais
 *    pas les données chargées par fetch classique (features, contexte
 *    admin, identité école…), et aucune navigation échouée n'était retentée.
 *
 * ⭐ STRATÉGIE (v1, sept. 2026) :
 *   1. Écouter la transition hors-ligne → en-ligne ('online').
 *   2. DEBOUNCE 2,5 s (filtrer les flaps de connexion) + SONDE de
 *      connectivité réelle (GET /api/auth/me — un captive portal ou un
 *      « faux online » du navigateur ne doit pas déclencher de rechargement).
 *   3. Au succès de la sonde :
 *      a. Émettre 'ah:network-restored' → les hooks à fetch classique se
 *         re-chargent (features sidebar, contexte admin, identité…) ;
 *         React Query est déjà invalidé par QueryProvider sur 'online'.
 *      b. SI l'app est DÉGRADÉE (une navigation hors ligne a échoué — flag
 *         posé par app/error.tsx) → UN SEUL rechargement propre de la page
 *         (garde : max 1 / 3 min) : les caches SW sont chauds (NetworkFirst
 *         les rafraîchit), la session est valide, l'app repart avec ses
 *         données. C'est le comportement demandé : « l'application se
 *         recharge au retour de la connexion ».
 *         Si l'app n'est PAS dégradée (l'utilisateur consultait des données
 *         en cache), AUCUN rechargement — juste le rafraîchissement des
 *         données en place (pas de perte de contexte/brouillons).
 * ============================================================================
 */

'use client';

import { useEffect, useRef } from 'react';

/** Debounce après l'événement 'online' (filtre les flaps réseau). */
const ONLINE_DEBOUNCE_MS = 2500;

/** Garde anti-rechargement : min 3 min entre deux reloads auto. */
const RELOAD_GUARD_MS = 3 * 60 * 1000;
const RELOAD_GUARD_KEY = 'ah_net_recovery_reload';

/** Vérifie que le réseau est RÉELLEMENT utilisable (pas un faux 'online'). */
async function probeConnectivity(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    // 200 = session + réseau OK. 401 = réseau OK mais session expirée →
    // le flow d'auth s'en charge (pas de reload ici, il ne ferait que
    // reboucler vers /login).
    return res.status === 200 || res.status === 401;
  } catch {
    return false;
  }
}

export default function NetworkRecovery() {
  const wasOfflineRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const markOffline = () => {
      wasOfflineRef.current = true;
    };

    const handleOnline = () => {
      if (!wasOfflineRef.current) return; // jamais passé hors ligne → rien à faire
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        // Le réseau est-il VRAIMENT revenu ? (sonde, cf. en-tête)
        const reachable = await probeConnectivity();
        if (!reachable) {
          // Faux retour de connexion → on se ré-arme pour le prochain 'online'
          return;
        }
        wasOfflineRef.current = false;

        // 1. Notifier l'app : les hooks à fetch classique se rechargent
        //    (features, contexte admin, identité…).
        try {
          window.dispatchEvent(new CustomEvent('ah:network-restored'));
        } catch { /* non-bloquant */ }

        // 2. App dégradée (navigation hors ligne échouée → error boundary
        //    affiché, flag __ah_degraded_nav posé par app/error.tsx) →
        //    rechargement propre unique (garde 3 min).
        const degraded =
          (window as any).__ah_degraded_nav === true ||
          document.querySelector('[data-ah-offline-error="true"]') !== null;
        if (degraded) {
          let last = 0;
          try {
            last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
          } catch { /* Safari privé */ }
          if (Date.now() - last > RELOAD_GUARD_MS) {
            try {
              sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
            } catch { /* idem */ }
            window.location.reload();
          }
        }
      }, ONLINE_DEBOUNCE_MS);
    };

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
