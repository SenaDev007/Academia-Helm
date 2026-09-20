"use client";

/**
 * ============================================================================
 * usePersistedTab — Restauration de l'onglet actif après rechargement
 * ============================================================================
 *
 * ⭐ Problème signalé par l'utilisateur :
 *   « Dans toute l'application, lorsqu'on est dans un onglet et que la page
 *    se recharge, on se retrouve sur l'onglet par défaut, au lieu d'être
 *    toujours dans la session où on était. »
 *
 * Solution double (belts and suspenders) :
 *   1. PARAMÈTRE D'URL — l'onglet actif est reflété dans l'URL
 *      (?onglet=cahier-journal) via history.replaceState : aucun
 *      rechargement, aucun scroll jump, et le F5 / partage du lien restore
 *      l'onglet. On utilise replaceState (et non pushState) pour ne pas
 *      polluer l'historique de navigation (le bouton « Précédent » reste
 *      fonctionnel comme avant).
 *   2. SESSIONSTORAGE — miroir par chemin de page (clé
 *      ah:tab:<pathname>:<key>) : si l'utilisateur revient sur la page sans
 *      le paramètre d'URL (navigation interne via liens), l'onglet qu'il
 *      avait quitté est restauré. sessionStorage (et non localStorage) pour
 *      respecter le caractère « session » décrit par l'utilisateur.
 *
 * Validation :
 *   - Si l'onglet restauré n'existe pas dans `validTabs` (ex: onglet masqué
 *     après changement de niveau scolaire), on retombe sur `defaultTab`.
 *
 * Usage :
 *   const [tab, setTab] = usePersistedTab('cahier-journal', TABS.map(t => t.id), 'classes');
 * ============================================================================
 */

import { useCallback, useState } from "react";

function readStoredTab(key: string, validTabs: readonly string[], defaultTab: string): string {
  if (typeof window === "undefined") return defaultTab;

  // 1) Paramètre d'URL (?onglet=… / ?tab=… selon le paramName fourni)
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(key) || params.get("tab") || params.get("onglet");
    if (fromUrl && validTabs.includes(fromUrl)) return fromUrl;
  } catch { /* ignore */ }

  // 2) Miroir sessionStorage (par page — plusieurs workspaces peuvent
  //    cohabiter sur des chemins différents avec la même clé logique)
  try {
    const storageKey = `ah:tab:${window.location.pathname}:${key}`;
    const fromStorage = window.sessionStorage.getItem(storageKey);
    if (fromStorage && validTabs.includes(fromStorage)) return fromStorage;
  } catch { /* sessionStorage indisponible (mode privé strict…) */ }

  return defaultTab;
}

export function usePersistedTab(
  /** Clé logique de l'onglet (réutilisée comme nom de paramètre d'URL). */
  key: string,
  /** Liste des onglets valides (ex: ids filtrés selon le niveau scolaire). */
  validTabs: readonly string[],
  /** Onglet par défaut si rien à restaurer / onglet invalide. */
  defaultTab: string,
): [string, (tab: string) => void] {
  const [tab, setTabState] = useState<string>(() =>
    readStoredTab(key, validTabs, defaultTab),
  );

  const setTab = useCallback(
    (next: string) => {
      setTabState(next);
      if (typeof window === "undefined") return;
      // Miroir sessionStorage (par page)
      try {
        window.sessionStorage.setItem(`ah:tab:${window.location.pathname}:${key}`, next);
      } catch { /* ignore */ }
      // Reflet dans l'URL SANS rechargement ni entrée d'historique
      try {
        const url = new URL(window.location.href);
        // nettoyer les alias éventuels pour éviter les doublons
        url.searchParams.delete("tab");
        url.searchParams.delete("onglet");
        url.searchParams.set(key, next);
        window.history.replaceState(null, "", url.toString());
      } catch { /* ignore */ }
    },
    [key],
  );

  return [tab, setTab];
}
