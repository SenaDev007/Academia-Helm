/**
 * Offline Navigation — navigation hors ligne SANS rechargement brutal (v3)
 * ============================================================================
 *
 * ⭐ PROBLÈME (retour promoteur, sept. 2026) : « lorsqu'on passe en mode
 *    offline et qu'on passe d'un onglet à un autre, le rechargement est trop
 *    brutal et ça se répète un certain moment avant de se stabiliser ».
 *
 *    CAUSE : la v1 convertissait TOUT clic de lien interne en navigation
 *    COMPLÈTE (location.assign) dès que navigator.onLine === false → chaque
 *    changement de module rechargeait toute l'app (flash blanc, re-bootstrap
 *    complet, requêtes tuées en vol). La v2 (clic synthétique re-dispatché
 *    après consultation du SW) échouait : React n'applique pas son handler au
 *    clic synthétique → le navigateur suivait le href nativement → rechargement.
 *
 * ⭐ STRATÉGIE v3 — CARTE DE CACHE PRÉ-CALCULÉE (aucune interception dans le
 *    cas commun) : le Cache Storage est PARTAGÉ entre la page et le Service
 *    Worker — la page lit elle-même l'état des caches (RSC + HTML) pour tous
 *    les liens internes visibles, AVANT tout clic :
 *
 *    1. Payload RSC en cache (route visitée / pré-cachée) → AUCUNE
 *       interception : le clic original traverse normalement, next/link fait
 *       la navigation SPA (le SW sert le payload RSC depuis son cache) —
 *       transition instantanée, AUCUN rechargement. C'est le cas des
 *       « modules passés » du promoteur.
 *
 *    2. Pas de RSC mais HTML en cache (pré-cache module) → interception :
 *       navigation complète servie par le SW (PAGE_CACHE) — le module
 *       fonctionne hors ligne avec ses données IndexedDB (~1-2 s).
 *
 *    3. Ni l'un ni l'autre → AUCUNE interception : la navigation SPA échoue
 *       vite (503 RSC du SW) → error boundary gracieuse « Module en attente
 *       du réseau » avec réaffichage auto à la reconnexion.
 *
 *    La carte est rafraîchie : au passage hors-ligne, à l'apparition de
 *    nouveaux liens (MutationObserver, debounce), et périodiquement hors
 *    ligne (le cache RSC s'enrichit à chaque navigation réussie).
 *
 * ⚙️ Respecte les clics modifiés (ctrl/cmd/shift/alt), target=_blank,
 *    attribut download, ancres pures (#), protocoles externes et liens
 *    d'une autre origine — dans tous ces cas : aucune interception.
 */

'use client';

import { useEffect, useRef } from 'react';

/** Protocoles non navigables en interne. */
const SKIP_PROTOCOLS = /^(mailto|tel|sms|javascript|blob|data):/i;

/** Intervalle de rafraîchissement de la carte pendant l'hors-ligne. */
const OFFLINE_REFRESH_MS = 20_000;

/** Debounce du MutationObserver. */
const MUTATION_DEBOUNCE_MS = 1000;

/** hrefs (normalisés, sans #) avec payload RSC en cache → navigation SPA. */
const rscReadyUrls = new Set<string>();
/** hrefs avec HTML en cache mais SANS RSC → navigation complète via SW. */
const htmlOnlyUrls = new Set<string>();

/** Normalise un href interne en clé comparable (origin + pathname + search sans _rsc, sans hash). */
function normalizeHref(href: string): string | null {
  try {
    const u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin) return null;
    u.hash = '';
    u.searchParams.delete('_rsc');
    return u.toString();
  } catch {
    return null;
  }
}

/** Réplique la cascade du SW : match exact PUIS ignoreSearch. */
async function cacheHas(cache: Cache, key: string, ignoreSearch: boolean): Promise<boolean> {
  try {
    if (await cache.match(key)) return true;
    if (ignoreSearch) {
      const loose = await cache.match(key, { ignoreSearch: true });
      return !!loose;
    }
    return false;
  } catch {
    return false;
  }
}

/** Calcule l'état des caches pour tous les liens internes de la page. */
async function refreshCacheMap(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const hrefs = Array.from(
      new Set(
        anchors
          .map((a) => normalizeHref(a.getAttribute('href') || ''))
          .filter((h): h is string => !!h),
      ),
    );
    if (hrefs.length === 0) return;

    const rscCache = await caches.open('ah-rsc');
    const pageCache = await caches.open('ah-pages');

    for (const href of hrefs) {
      // Ne PAS écraser une décision RSC déjà prise (le HTML peut arriver après)
      if (rscReadyUrls.has(href)) continue;
      const hasRsc = await cacheHas(rscCache, href, true);
      if (hasRsc) {
        rscReadyUrls.add(href);
        htmlOnlyUrls.delete(href);
        continue;
      }
      if (htmlOnlyUrls.has(href)) continue;
      const hasHtml = await cacheHas(pageCache, href, true);
      if (hasHtml) htmlOnlyUrls.add(href);
    }
  } catch {
    /* Cache Storage indisponible — la carte reste vide : aucune interception */
  }
}

export function OfflineNavigation() {
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
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

      const key = normalizeHref(href);
      if (!key) return;

      // ⭐ RSC en cache → NE PAS intercepter : next/link fait la navigation
      //    SPA (fluide, aucun rechargement — cas des modules visités).
      if (rscReadyUrls.has(key)) return;

      // ⭐ Inconnu (pas encore consulté) → ne pas intercepter non plus :
      //    la navigation SPA tente ; en cas d'échec, le SW renvoie un 503
      //    RAPIDE → error boundary gracieuse (jamais de spinner infini).
      if (!htmlOnlyUrls.has(key)) return;

      // ⭐ HTML en cache mais PAS de RSC → navigation complète servie par
      //    le SW depuis PAGE_CACHE : le module fonctionne hors ligne avec
      //    ses données IndexedDB.
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(url.href);
    };

    // CAPTURE : avant le handler de React (next/link)
    document.addEventListener('click', onClick, true);

    // ─── Construction / rafraîchissement de la carte de cache ───────────
    const startOfflineRefresh = () => {
      void refreshCacheMap();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          void refreshCacheMap();
        } else if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }, OFFLINE_REFRESH_MS);
    };

    const onOffline = () => startOfflineRefresh();
    const onOnline = () => {
      // La carte est caduque en ligne (réseau direct) — vidée au prochain offline
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    // Carte initiale (au montage — couvre le cas « déjà hors ligne au load »)
    void refreshCacheMap();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (typeof navigator !== 'undefined' && !navigator.onLine) startOfflineRefresh();

    // Nouveaux liens (rendus différés, listes chargées…) → rafraîchir (debounce)
    const observer = new MutationObserver(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) return;
      if (mutationDebounceRef.current) clearTimeout(mutationDebounceRef.current);
      mutationDebounceRef.current = setTimeout(() => void refreshCacheMap(), MUTATION_DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      observer.disconnect();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (mutationDebounceRef.current) clearTimeout(mutationDebounceRef.current);
    };
  }, []);

  return null;
}
