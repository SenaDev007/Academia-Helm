'use client';

/**
 * ============================================================================
 * SW VERSION GUARD — Guérisseur de Service Worker périmé (T57 — 2026-10-01)
 * ============================================================================
 *
 * INCIDENT (production, 2026-10-01) : sur le portail PATRONAT NATIONAL
 * (patronatnational.academiahelm.com), TOUS les modules affichaient
 * « Impossible de charger » après > 30 s de chargement — alors que l'API
 * répondait en 200-600 ms (vérifié en direct avec le compte du promoteur).
 * Le portail territorial (patronatborgou) fonctionnait normalement.
 *
 * CAUSE : le navigateur du promoteur gardait un Service Worker périmé
 * (ère v4.5→v4.8.1, enregistré à la création du portail le 27-09) ainsi que
 * des caches pages/RSC référençant les chunks d'ANCIENS builds : les
 * déploiements suivants ont changé les chunks sans modifier sw.js (le
 * « trou de déploiement » documenté en v4.8.0 — son mécanisme d'epoch ne
 * couvre que le shell Helm /app, PAS les portails patronat). Résultat :
 * navigation entre modules → payloads RSC périmés / ChunkLoadError /
 * tempête de pré-cache sans cession de priorité → famine des requêtes
 * visibles → « Impossible de charger » partout.
 *
 * RÔLE DE CE COMPOSANT (monté dans le layout racine — TOUS les portails) :
 *   1. Interroger le SW qui contrôle la page (message GET_SW_VERSION).
 *   2. Comparer avec la version RÉELLEMENT SERVIE par /sw.js (fetch no-store).
 *   3. Si le SW ne répond pas (antérieur à GET_SW_VERSION) ou si sa version
 *      diffère de la version servie → registration.update() ; le nouveau SW
 *      (skipWaiting + clients.claim) prend le contrôle → RELOAD UNIQUE de la
 *      page (garde-fou sessionStorage anti-boucle) pour servir le build neuf.
 *   4. Repli nucléaire si le SW refusait encore de bouger après update :
 *      unregister() + purge des caches ah-* + reload unique.
 *
 * Ce filet garantit qu'UN NAVIGATEUR QUI RESTE OUVERT des jours entiers
 * (onglet épinglé) finit quand même par être soigné — sans attendre le check
 * navigateur (max 24 h) ni une action de l'utilisateur.
 */

import { useEffect } from 'react';

/** Garde-fou anti-boucle de rechargement (une guérison max / 60 s). */
const HEAL_FLAG = 'ah_sw_heal_reload';
const HEAL_COOLDOWN_MS = 60_000;
/** Attente max d'une réponse du SW contrôleur. */
const SW_ASK_TIMEOUT_MS = 2500;

function canHealNow(): boolean {
  try {
    const ts = sessionStorage.getItem(HEAL_FLAG);
    if (ts && Date.now() - parseInt(ts, 10) < HEAL_COOLDOWN_MS) return false;
  } catch {
    /* sessionStorage indisponible (privé) — on tente quand même */
  }
  return true;
}

function markHealReload(): void {
  try {
    sessionStorage.setItem(HEAL_FLAG, Date.now().toString());
  } catch {
    /* non-bloquant */
  }
}

/** Version du SW qui contrôle CETTE page (null = pas de contrôleur ou muet). */
function askControllerVersion(timeoutMs = SW_ASK_TIMEOUT_MS): Promise<string | null> {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      resolve(null);
      return;
    }
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
    const done = (version: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(version);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_VERSION' && event.data.version) {
        done(String(event.data.version));
      }
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    navigator.serviceWorker.addEventListener('message', onMessage);
    try {
      controller.postMessage({ type: 'GET_SW_VERSION' });
    } catch {
      done(null);
    }
  });
}

/** Version du script /sw.js réellement servi par le serveur (cache-bypassé). */
async function fetchServedSwVersion(): Promise<string | null> {
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' });
    if (!res.ok) return null;
    // SW_VERSION est définie dans les ~120 premiers Ko — on ne parse pas tout.
    const text = (await res.text()).slice(0, 200_000);
    const match = text.match(/SW_VERSION\s*=\s*'([^']+)'/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Purge des caches applicatifs (conservés : aucun — le SW neuf reconstruit). */
async function purgeAhCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith('ah-') || n.includes('academia-helm') || n.includes('workbox'))
        .map((n) => caches.delete(n)),
    );
  } catch {
    /* non-bloquant */
  }
}

export function SWVersionGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    (async () => {
      try {
        // ⭐ Hors ligne → JAMAIS de guérison : unregister/reload hors ligne
        //    casserait le mode offline (cache purgé + page introuvable).
        //    Nouvelle tentative au prochain chargement en ligne.
        if (!navigator.onLine) return;

        const controller = navigator.serviceWorker.controller;

        // ── Cas 1 : aucun contrôleur (1re visite, ou SW désenregistré) ──
        //    On s'assure juste qu'une registration existe ; la PROCHAINE
        //    navigation sera contrôlée. Pas de reload (la page actuelle est
        //    déjà servie par le réseau — aucun intérêt à la recharger).
        if (!controller) {
          try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          } catch {
            /* échec d'enregistrement — les PWARegister existants retryent */
          }
          return;
        }

        // ── Cas 2 : un contrôleur existe — est-il à jour ? ──────────────
        const [controllerVersion, servedVersion] = await Promise.all([
          askControllerVersion(),
          fetchServedSwVersion(),
        ]);

        // Contrôleur muet (SW antérieur à GET_SW_VERSION) → périmé d'office.
        // Contrôleur bavard mais d'une autre version que celle servie →
        // un déploiement a eu lieu sans que l'update du SW s'applique.
        const controllerIsStale =
          !controllerVersion ||
          (servedVersion !== null && controllerVersion !== servedVersion);

        if (!controllerIsStale) return; // tout est à jour — rien à faire
        if (!canHealNow()) return; // guérison récente — on ne boucle pas
        if (cancelled) return;

        console.warn(
          `[SWVersionGuard] SW contrôleur périmé (${controllerVersion ?? 'muet'}) ` +
            `vs servi (${servedVersion ?? '?'}) — guérison en cours`,
        );
        markHealReload();

        // ── Guérison douce : update → skipWaiting → claim → reload ──────
        let healed = false;
        const onControllerChange = () => {
          healed = true;
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, {
          once: true,
        });

        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.update();

          // La mise à jour a-t-elle trouvé un nouveau worker ?
          const hasNewWorker = () =>
            !!(registration.installing || registration.waiting);

          if (hasNewWorker()) {
            // Nouveau SW en install/waiting : il fait skipWaiting à la fin de
            // son install (pré-cache léger) puis clients.claim() → le
            // controllerchange ci-dessus recharge la page. Sur connexion
            // lente l'install peut prendre du temps → jusqu'à 20 s.
            for (let i = 0; i < 20 && !healed && !cancelled; i++) {
              await new Promise((r) => setTimeout(r, 1000));
            }
            // Still waiting ? On relance skipWaiting explicitement.
            if (!healed && !cancelled && registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              for (let i = 0; i < 5 && !healed && !cancelled; i++) {
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
            return; // guéri (reload en cours) ou abandon silencieux
          }

          // ── Repli nucléaire : registration cassée / SW orphelin qui ────
          //    refuse de bouger → désenregistrement + purge + reload.
          if (cancelled || healed) return;
          console.warn(
            '[SWVersionGuard] Aucune mise à jour trouvée — désenregistrement + purge des caches',
          );
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
          await purgeAhCaches();
          window.location.reload();
        } catch {
          // update() a échoué (offline ?) — nouvelle tentative au prochain
          // chargement ; on NE recharge pas en boucle.
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        }
      } catch {
        /* le garde ne doit JAMAIS casser la page */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
