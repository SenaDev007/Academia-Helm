'use client';

/**
 * ============================================================================
 * USE TENANT COLORS — Résolution dynamique de la palette de couleurs
 * ============================================================================
 *
 * Résout les couleurs d'une école tenante :
 *   1. Si customColors est configuré (2-4 couleurs) → utilise ces couleurs
 *   2. Sinon → fallback sur la palette Helm par défaut
 *
 * Retourne un objet avec des noms sémantiques :
 *   primary   → couleur principale (fond header, hero, footer)
 *   secondary → couleur secondaire (gradient, accents)
 *   accent    → couleur d'accent (boutons, highlights, badges)
 *   dark      → couleur sombre (fond footer, textes)
 *
 * Palette Helm par défaut :
 *   primary   = #0b2f73 (Navy)
 *   secondary = #1d4fa5 (Blue)
 *   accent    = #f5b335 (Gold)
 *   dark      = #091f4a (Navy foncé)
 * ============================================================================
 */

export interface TenantColors {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
}

const HELM_DEFAULT: TenantColors = {
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

export { HELM_DEFAULT };
