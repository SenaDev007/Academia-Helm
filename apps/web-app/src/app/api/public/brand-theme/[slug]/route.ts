/**
 * ============================================================================
 * PUBLIC BRAND THEME API PROXY — PALETTE DE L'ÉCOLE POUR LES PAGES PUBLIQUES
 * ============================================================================
 *
 * GET /api/public/brand-theme/:slug
 * → proxy vers NestJS /tenant-website/public/:slug/brand-theme puis RÉSOUT
 *   la palette côté serveur BFF (même chaîne de priorité que l'application
 *   /app et le site institutionnel) :
 *     1. Thème officiel (themeId + themeMode) → themeToColors()
 *     2. customColors (CMS) → resolveTenantColors()
 *     3. logoPalette (palette AUTO du logo) → resolveTenantColors()
 *
 * Réponse : { colors: TenantColors | null, source: 'theme'|'customColors'|'logoPalette'|null }
 *   - colors = null → l'école n'a AUCUNE palette configurée : le client garde
 *     le rendu Helm par défaut (fail-open, rendu inchangé).
 *
 * ⭐ 2026-11-27 — Demande promoteur : la page de sélection du portail, la page
 *   de connexion /login et l'écran de chargement doivent suivre la palette du
 *   logo de l'école (comme le site institutionnel et l'application /app).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { bffFetch, buildCacheHeaders } from '@/lib/api/bff-fetch';
import { getThemeById, resolveThemeVariant, hslToHex, type ThemeMode } from '@/lib/themes/themes.config';
import { resolveTenantColors, HELM_DEFAULT, type TenantColors } from '@/lib/tenant/tenant-colors-core';

/** Force dynamic — ne pas pré-render au build. */
export const dynamic = 'force-dynamic';

/** Cache mémoire court (60 s) — cette route est frappée par les écrans de
 *  chargement et la page de login ; la palette d'une école change rarement. */
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expires: number; body: BrandThemeResponse }>();

interface BrandThemeApiResponse {
  found: boolean;
  themeId: string | null;
  themeMode: string;
  customColors: unknown;
  logoPalette: unknown;
}

interface BrandThemeResponse {
  colors: TenantColors | null;
  source: 'theme' | 'customColors' | 'logoPalette' | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { colors: null, source: null, error: 'Slug invalide' },
        { status: 400 },
      );
    }

    const cached = cache.get(slug);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.body, { headers: buildCacheHeaders(cached.body) });
    }

    const body: BrandThemeResponse = { colors: null, source: null };

    try {
      const response = await bffFetch(
        `/tenant-website/public/${encodeURIComponent(slug)}/brand-theme`,
        { timeoutMs: 5000 },
      );
      if (response.ok) {
        const data = (await response.json()) as BrandThemeApiResponse;
        if (data?.found) {
          // 1. Thème officiel
          if (data.themeId) {
            const theme = getThemeById(data.themeId);
            if (theme) {
              const variant = resolveThemeVariant(theme, (data.themeMode as ThemeMode) || 'auto');
              body.colors = {
                primary: hslToHex(variant.colors.primary),
                secondary: hslToHex(variant.colors.secondary),
                accent: hslToHex(variant.colors.accent),
                dark: hslToHex(variant.colors.sidebar),
              };
              body.source = 'theme';
            }
          }
          // 2/3. customColors (CMS) > logoPalette (auto logo)
          if (!body.colors) {
            const paletteSource = data.customColors || data.logoPalette;
            if (paletteSource) {
              const colors = resolveTenantColors(paletteSource);
              const hasReal = JSON.stringify(colors) !== JSON.stringify(HELM_DEFAULT);
              if (hasReal) {
                body.colors = colors;
                body.source = data.customColors ? 'customColors' : 'logoPalette';
              }
            }
          }
        }
      }
    } catch {
      /* fail-open : colors reste null → rendu Helm par défaut côté client */
    }

    cache.set(slug, { expires: Date.now() + CACHE_TTL_MS, body });
    return NextResponse.json(body, { headers: buildCacheHeaders(body) });
  } catch (error: any) {
    console.error('[Public Brand Theme API] Error:', error);
    return NextResponse.json(
      { colors: null, source: null, error: 'Brand theme indisponible' },
      { status: 500 },
    );
  }
}
