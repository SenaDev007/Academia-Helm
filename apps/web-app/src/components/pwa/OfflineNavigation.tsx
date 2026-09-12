/**
 * Offline Navigation — navigation complète hors ligne (via le Service Worker)
 * ============================================================================
 *
 * ⭐ PROBLÈME (sept. 2026) : hors ligne, changer de module/onglet faisait
 *    « tourner » la page indéfiniment. Cause : la navigation client du
 *    routeur Next (App Router) fetch le payload RSC de la route cible
 *    (requête `rsc: 1`) — hors ligne elle échoue → spinner infini.
 *
 * ⭐ SOLUTION : quand le navigateur est hors ligne, les clics sur des liens
 *    internes déclenchent une NAVIGATION COMPLÈTE (location.assign) au lieu
 *    de la navigation SPA. Le Service Worker sert alors :
 *      - /app/* → le HTML exact pré-caché (module) ou le shell /app ;
 *      - pages publiques → le HTML de la page si déjà visitée.
 *    L'app redémarre depuis le cache (~1-2 s) et rend la page depuis
 *    IndexedDB — la promesse « vous pouvez continuer à travailler » du
 *    toast hors ligne devient VRAIE.
 *
 * ⭐ En ligne : AUCUNE interception (le routeur SPA fonctionne normalement,
 *    navigation instantanée sans rechargement).
 *
 * ⚙️ Détails techniques :
 *    - Listener en CAPTURE sur document (se déclenche AVANT le handler de
 *      React/next/link → preventDefault + stopPropagation court-circuitent
 *      la navigation SPA).
 *    - Respecte les clics modifiés (ctrl/cmd/shift/alt = nouvel onglet),
 *      target=_blank, attribut download, ancres pures (#), protocoles
 *      externes (mailto:, tel:, javascript:, blob:, data:) et les liens
 *      d'une autre origine.
 *    - Les navigations programmatiques (router.push) ne sont PAS couvertes
 *      par ce garde → elles passent par le cache RSC du SW (payloads
 *      préchargés) ou échouent VITE (503 → error boundary hors ligne),
 *      jamais de spinner infini.
 */

'use client';

import { useEffect } from 'react';

/** Protocoles non navigables en interne. */
const SKIP_PROTOCOLS = /^(mailto|tel|sms|javascript|blob|data):/i;

export function OfflineNavigation() {
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

      // ⭐ Hors ligne → navigation complète : le SW sert la page depuis le
      //    cache (HTML pré-caché des modules / shell /app / pages visitées).
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(url.href);
    };

    // CAPTURE : avant le handler de React (next/link) — court-circuite la SPA
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
