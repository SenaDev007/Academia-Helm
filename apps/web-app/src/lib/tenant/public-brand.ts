/**
 * ============================================================================
 * PUBLIC BRAND — Résolution CLIENT de la palette de marque d'une école
 * ============================================================================
 *
 * ⭐ 2026-11-27 — Demande promoteur : « lorsque c'est à partir du site
 *    institutionnel on va vers la page portail, il faut que tout le design
 *    soit également aligné avec la palette de couleurs du logo de l'école
 *    tenante… la page de loading également… le logo de l'école récupéré. »
 *
 * Ce module centralise, pour les pages PUBLIQUES (sélection du portail,
 * /login, écran de chargement) :
 *   1. fetchPublicBrandColors(slug) → palette (themeId > customColors >
 *      logoPalette) via la route BFF /api/public/brand-theme/:slug.
 *   2. Le cache sessionStorage « academia_portal_school » — enrichi de la
 *      palette + du logo par le site institutionnel / la page portail AVANT
 *      de rediriger vers /login : la page de connexion et l'écran de
 *      chargement récupèrent logo + couleurs INSTANTANÉMENT (zéro flash,
 *      zéro fetch), même sur le domaine principal (academiahelm.com).
 *
 * Le rendu reste fail-open : aucune palette → le style Helm par défaut.
 * ============================================================================
 */

'use client';

import type { TenantColors } from '@/lib/tenant/tenant-colors-core';

/** Clé sessionStorage partagée avec useSchoolBranding (academia_portal_school). */
export const PORTAL_SCHOOL_STORAGE_KEY = 'academia_portal_school';

/** Ce que les pages publiques persistaient déjà + la palette de marque. */
export interface PortalSchoolBrand {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  slogan: string | null;
  schoolAcronym?: string | null;
  /** ⭐ 2026-11-27 — palette du logo de l'école (primary/secondary/accent/dark). */
  brandColors?: TenantColors | null;
}

/**
 * Lit le branding école persisté par le site institutionnel / la page de
 * sélection du portail (sessionStorage). Null si absent ou illisible.
 */
export function readPortalSchoolBrand(): PortalSchoolBrand | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PORTAL_SCHOOL_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.name) return data as PortalSchoolBrand;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persiste le branding école (avec palette) avant une redirection vers /login
 * ou un autre écran public — permet un rendu instantané aux couleurs de
 * l'école après la navigation.
 */
export function persistPortalSchoolBrand(brand: PortalSchoolBrand): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PORTAL_SCHOOL_STORAGE_KEY, JSON.stringify(brand));
  } catch {
    // sessionStorage peut être indisponible (mode privé) — non bloquant.
  }
}

/**
 * Résout la palette de marque d'une école (themeId > customColors >
 * logoPalette) via la route BFF publique.
 *
 * @returns TenantColors | null — null = aucune palette (rendu Helm par défaut)
 */
export async function fetchPublicBrandColors(
  slug: string,
  opts?: { signal?: AbortSignal },
): Promise<TenantColors | null> {
  const s = (slug || '').trim();
  if (!s || s.length < 2) return null;
  try {
    const res = await fetch(`/api/public/brand-theme/${encodeURIComponent(s)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...(opts?.signal ? { signal: opts.signal } : {}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.colors && typeof data.colors.primary === 'string') {
      return data.colors as TenantColors;
    }
    return null;
  } catch {
    return null; // fail-open
  }
}
