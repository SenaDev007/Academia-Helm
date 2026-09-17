/**
 * Offline Navigation — navigation hors ligne SANS rechargement brutal
 * ============================================================================
 *
 * ⭐ PROBLÈME (retour promoteur, sept. 2026) : « lorsqu'on passe en mode
 *    offline et qu'on passe d'un onglet à un autre, le rechargement est trop
 *    brutal et ça se répète un certain moment avant de se stabiliser ».
 *
 *    CAUSE : la version précédente convertissait TOUT clic de lien interne
 *    en navigation COMPLÈTE (location.assign) dès que navigator.onLine ===
 *    false → chaque changement de module rechargeait toute l'app (flash
 *    blanc, re-bootstrap complet, requêtes tuées en vol).
 *
 * ⭐ NOUVELLE STRATÉGIE (v2) — demander au Service Worker ce qui est
 *    disponible en cache, PUIS décider :
 *
 *    1. Payload RSC en cache (route déjà visitée / pré-cachée)
 *       → laisser la navigation SPA de next/link se faire NORMALEMENT.
 *         Le SW sert le payload RSC (handleRsc → cache) : transition
 *         instantanée, AUCUN rechargement. C'est le cas des modules déjà
 *         visités — exactement le scenario « modules passés » du promoteur.
 *
 *    2. Pas de RSC mais HTML de la route en cache (pré-cache module)
 *       → navigation complète : le SW sert le HTML depuis PAGE_CACHE
 *         (~1-2 s) et le module fonctionne hors ligne avec ses données
 *         IndexedDB. C'est le seul cas où le rechargement reste utile.
 *
 *    3. Ni l'un ni l'autre → laisser la navigation SPA : le SW renvoie un
 *       503 RAPIDE → le routeur déclenche l'error boundary → UI gracieuse
 *       « Module en attente du réseau » avec auto-réaffichage au retour du
 *       réseau (app/error.tsx). JAMAIS de spinner infini, JAMAIS de boucle.
 *
 *    Le round-trip message vers le SW est LOCAL (quelques ms). Si le SW ne
 *    répond pas sous 250 ms (pas de contrôleur, SW ancien), on laisse la
 *    navigation SPA se faire (comportement 3 — le plus sûr).
 *
 * ⚙️ Détails techniques :
 *    - Listener en CAPTURE sur document (avant le handler de React) ;
 *      preventDefault + stopPropagation court-circuitent le temps du
 *      round-trip, puis un clic synthétique re-dispatché (flag skipNext)
 *      relance la navigation SPA si la décision est « RSC » ou « aucun ».
 *    - Respecte les clics modifiés (ctrl/cmd/shift/alt), target=_blank,
 *      attribut download, ancres pures (#), protocoles externes et liens
 *      d'une autre origine.
 */

'use client';

import { useEffect } from 'react';

/** Protocoles non navigables en interne. */
const SKIP_PROTOCOLS = /^(mailto|tel|sms|javascript|blob|data):/i;

/** Délai max d'attente de la réponse du SW (ms). */
const SW_REPLY_TIMEOUT_MS = 250;

type CacheDecision = 'rsc' | 'html' | 'none';

/** Demande au SW si la route a un payload RSC / un HTML en cache. */
function askServiceWorker(href: string): Promise<CacheDecision> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
      resolve('none');
      return;
    }
    let settled = false;
    const done = (d: CacheDecision) => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(d);
    };
    const onMsg = (event: MessageEvent) => {
      if (event.data?.type === 'AH_HAS_ROUTE_CACHE_RESULT' && event.data?.href === href) {
        done(event.data.hasRsc ? 'rsc' : event.data.hasHtml ? 'html' : 'none');
      }
    };
    const timer = setTimeout(() => done('none'), SW_REPLY_TIMEOUT_MS);
    navigator.serviceWorker.addEventListener('message', onMsg);
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'AH_HAS_ROUTE_CACHE', href });
    } catch {
      done('none');
    }
  });
}

export function OfflineNavigation() {
  useEffect(() => {
    // Flag : le prochain clic (synthétique, re-dispatché par nous) ne doit
    // PAS être intercepté — c'est la navigation SPA voulue.
    let skipNext = false;

    const onClick = async (e: MouseEvent) => {
      // Clic re-dispatché par nous → laisser passer la navigation SPA
      if (skipNext) {
        skipNext = false;
        return;
      }
      // En ligne : le routeur SPA fonctionne — ne rien intercepter
      if (typeof navigator !== 'undefined' && navigator.onLine) return;

      // Clics modifiés (nouvel onglet/fenêtre) et clics déjà traités
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || SKIP_PROTOCOLS.test(href)) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Lien vers la page courante (ancre/requête identique) → rien à faire
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      // ⭐ Temporiser le temps du round-trip SW (local, ~ms)
      e.preventDefault();
      e.stopPropagation();

      const decision = await askServiceWorker(url.href);

      if (decision === 'html') {
        // HTML en cache mais pas de RSC → navigation complète servie par le
        // SW (PAGE_CACHE) : le module fonctionne hors ligne avec ses données.
        window.location.assign(url.href);
        return;
      }

      // 'rsc' (payload en cache → SPA instantanée) ou 'none' (error boundary
      // gracieux) : re-dispatcher le clic pour que next/link navigue
      // normalement en SPA.
      skipNext = true;
      anchor.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          view: window,
        }),
      );
    };

    // CAPTURE : avant le handler de React (next/link)
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
