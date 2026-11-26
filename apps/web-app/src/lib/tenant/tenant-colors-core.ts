/**
 * ============================================================================
 * TENANT COLORS CORE — Résolution de la palette (module PARTAGÉ serveur/client)
 * ============================================================================
 *
 * ⭐ 2026-11-26 — Fix build Vercel (échec « Collecting page data » depuis la
 *    1.0.51) : `resolveTenantColors` vivait dans use-tenant-colors.ts
 *    ('use client') mais est appelée par app-brand-theme.ts qui s'évalue
 *    côté SERVEUR (layout /app). Next.js 16 interdit d'invoquer une fonction
 *    client depuis le serveur.
 *
 *    → Les fonctions pures (aucune API browser, aucun state React) sont
 *      déplacées dans CE module sans directive, importable partout :
 *        - serveur : app-brand-theme.ts (palette de l'application /app/*)
 *        - client  : use-tenant-colors.ts (re-export, site institutionnel…)
 *
 * Stratégies de résolution (par priorité) :
 *   1. Thème officiel (themeId + mode) → themeToColors()
 *   2. customColors (CMS) → resolveTenantColors()
 *   3. Palette Helm par défaut (fallback) :
 *      NAVY #0b2f73 / BLUE #1d4fa5 / GOLD #f5b335 / DARK #091f4a
 *
 * Noms sémantiques :
 *   primary   → couleur principale (fond header, hero, footer)
 *   secondary → couleur secondaire (gradient, accents)
 *   accent    → couleur d'accent (boutons, highlights, badges)
 *   dark      → couleur sombre (fond footer, textes)
 * ============================================================================
 */

import {
  type Theme,
  type ThemeMode,
  resolveThemeVariant,
  hslToHex,
} from '@/lib/themes/themes.config';

export interface TenantColors {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
}

export const HELM_DEFAULT: TenantColors = {
  primary: '#0b2f73',
  secondary: '#1d4fa5',
  accent: '#f5b335',
  dark: '#091f4a',
};

/**
 * Résout les couleurs depuis customColors (JSON du CMS).
 *
 * @param customColors Tableau de { name, value } ou null/undefined
 * @returns TenantColors avec primary, secondary, accent, dark
 */
export function resolveTenantColors(customColors: any): TenantColors {
  if (!customColors) return HELM_DEFAULT;

  let colors: Array<{ name?: string; value?: string }> = [];

  if (Array.isArray(customColors)) {
    colors = customColors.filter(c => c && c.value && typeof c.value === 'string');
  } else if (typeof customColors === 'string') {
    try {
      colors = JSON.parse(customColors).filter((c: any) => c && c.value);
    } catch {
      return HELM_DEFAULT;
    }
  }

  if (colors.length === 0) return HELM_DEFAULT;

  // Mapper les couleurs configurées vers les rôles sémantiques
  // Si l'école configure 2 couleurs : primary + accent
  // Si l'école configure 3 couleurs : primary + secondary + accent
  // Si l'école configure 4 couleurs : primary + secondary + accent + dark
  const result: TenantColors = { ...HELM_DEFAULT };

  if (colors.length >= 1) result.primary = colors[0].value!;
  if (colors.length >= 2) result.accent = colors[1].value!;
  if (colors.length >= 3) result.secondary = colors[2].value!;
  if (colors.length >= 4) result.dark = colors[3].value!;

  // Si seulement 2 couleurs, dériver secondary et dark du primary
  if (colors.length === 2) {
    result.secondary = adjustColor(result.primary, 20); // éclaircir de 20
    result.dark = adjustColor(result.primary, -20); // assombrir de 20
  }

  // Si 3 couleurs, dériver dark du primary
  if (colors.length === 3) {
    result.dark = adjustColor(result.primary, -25);
  }

  return result;
}

/**
 * Éclaircit ou assombrit une couleur hex.
 * amount > 0 = éclaircir, amount < 0 = assombrir
 */
function adjustColor(hex: string, amount: number): string {
  try {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');

    const r = Math.max(0, Math.min(255, parseInt(h.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(h.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(h.substring(4, 6), 16) + amount));

    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return hex;
  }
}

/**
 * ============================================================================
 * THEME TO COLORS — Conversion d'un thème officiel vers TenantColors
 * ============================================================================
 *
 * Convertit un thème officiel (40+ thèmes du system shadcn/ui, chacun exposant
 * ~32 variables CSS HSL) en un objet TenantColors (4 couleurs hex) utilisable
 * dans les styles inline du site institutionnel.
 *
 * Stratégie de mapping (alignée sur la palette Helm sémantique) :
 *   primary   ← theme.colors.primary       (couleur principale d'action/fond)
 *   secondary ← theme.colors.secondary     (couleur secondaire de gradient)
 *   accent    ← theme.colors.accent        (couleur d'accent : boutons, badges)
 *   dark      ← theme.colors.sidebar       (zone la plus sombre du thème)
 *
 *   Le `sidebar` est utilisé pour `dark` car c'est la couleur la plus foncée
 *   disponible dans le thème (plus foncée que `background`), ce qui correspond
 *   au rôle sémantique de `dark` (fond footer, texte sombre).
 *
 * En mode 'auto', suit l'OS du visiteur (light ou dark) via resolveThemeVariant.
 *
 * @example
 *   import { getThemeById } from '@/lib/themes/themes.config';
 *   import { themeToColors } from '@/lib/tenant/tenant-colors-core';
 *
 *   const theme = getThemeById('ocean-breeze');
 *   const colors = theme ? themeToColors(theme, 'light') : HELM_DEFAULT;
 *   // → { primary: '#0ea5e9', secondary: '#0284c7', accent: '#06b6d4', dark: '#0c4a6e' }
 * ============================================================================
 */
export function themeToColors(theme: Theme, mode: ThemeMode = 'light'): TenantColors {
  const variant = resolveThemeVariant(theme, mode);
  const c = variant.colors;
  return {
    primary: hslToHex(c.primary),
    secondary: hslToHex(c.secondary),
    accent: hslToHex(c.accent),
    dark: hslToHex(c.sidebar),
  };
}
