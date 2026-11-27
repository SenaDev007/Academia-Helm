/**
 * ============================================================================
 * COLOR CONTRAST — Utilitaires de lisibilité (module PARTAGÉ, zéro dépendance)
 * ============================================================================
 *
 * ⭐ 2026-11-27 — Fix « textes invisibles sur les pages de login » :
 *    la palette dynamique (logo de l'école) peut être CLAIRE (logo jaune,
 *    orange, pastel…). Les composants du portail qui posaient du `text-white`
 *    ou `text-blue-100/200` sur des fonds construits avec les couleurs brutes
 *    de l'école produisaient des textes illisibles.
 *
 * Ce module expose les mêmes primitives que `app-brand-theme.ts` (mirroir
 * testé sur /app depuis la 1.0.54) mais SANS aucun import serveur :
 * utilisable dans les composants 'use client' (LoginPage, portail…) comme
 * dans le code serveur.
 *
 * Règles appliquées (identiques à buildAppBrandCss) :
 *   - Les FONDS porteurs de texte blanc sont assombris jusqu'à luminance
 *     simple ≤ 0,40 (≈ WCAG 4,5:1 sur blanc — calibré sur le navy Helm
 *     #0A2A5E = 0,17).
 *   - La couleur de TEXTE bascule blanc/encre selon la luminance réelle du
 *     fond (pickForeground).
 *   - La teinte de l'école est TOUJOURS conservée (on ne remplace jamais la
 *     couleur par du gris : on assombrit/éclaircit en gardant la chrominance).
 * ============================================================================
 */

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexOf(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => clamp255(x).toString(16).padStart(2, '0')).join('');
}

export function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}

function parseHex(hex: string): [number, number, number] {
  const n = normalizeHex(hex) || '#000000';
  return [
    parseInt(n.substring(1, 3), 16) || 0,
    parseInt(n.substring(3, 5), 16) || 0,
    parseInt(n.substring(5, 7), 16) || 0,
  ];
}

/** Luminance simple perçue (0=noir, 1=blanc) — même formule que l'API. */
export function hexLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Assombrit jusqu'à luminance simple ≤ maxLum (garde la teinte). */
export function darkenUntil(hex: string, maxLum: number): string {
  let [r, g, b] = parseHex(hex);
  let guard = 0;
  while ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > maxLum && guard < 24) {
    r *= 0.92; g *= 0.92; b *= 0.92;
    guard++;
  }
  return hexOf(r, g, b);
}

/** Éclaircit jusqu'à luminance simple ≥ minLum (garde la teinte). */
export function lightenUntil(hex: string, minLum: number): string {
  let [r, g, b] = parseHex(hex);
  let guard = 0;
  while ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < minLum && guard < 24) {
    r = r * 0.92 + 255 * 0.08;
    g = g * 0.92 + 255 * 0.08;
    b = b * 0.92 + 255 * 0.08;
    guard++;
  }
  return hexOf(r, g, b);
}

/** Mélange une couleur avec une autre (ratio = part du DEUXIÈME, 0..1). */
export function mix(hex: string, other: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(other);
  return hexOf(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  );
}

/** Blanc si le fond est assez sombre, sinon encre très sombre teintée. */
export function pickForeground(bg: string): string {
  const [r, g, b] = parseHex(bg);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 <= 0.55 ? '#ffffff' : '#10131c';
}

/**
 * Rend une couleur de TEXTE lisible sur un fond donné : si l'écart de
 * luminance est insuffisant (Δ < 0,25), on éclaircit (fond sombre) ou on
 * assombrit (fond clair) jusqu'à contraste suffisant, en gardant la teinte.
 */
export function readableOn(fg: string, bg: string): string {
  const bgLum = hexLuminance(bg);
  const fgLum = hexLuminance(fg);
  if (bgLum <= 0.45) {
    // Fond sombre → le texte doit être clair
    return fgLum >= bgLum + 0.25 ? fg : lightenUntil(fg, Math.min(bgLum + 0.3, 0.92));
  }
  // Fond clair → le texte doit être sombre
  return fgLum <= bgLum - 0.25 ? fg : darkenUntil(fg, Math.max(bgLum - 0.3, 0.08));
}

/**
 * Palette de CONTRASTE dérivée pour un composant à branding école.
 * Toutes les valeurs sont calculées une fois puis réutilisées :
 *   deep      → versions assombries pour les fonds porteurs de texte blanc
 *   text      → versions garanties lisibles sur fond clair (cartes blanches)
 *   onBrand   → couleur de texte sur le fond de marque (blanc ou encre)
 *   onBrandSoft / onBrandSofter → textes secondaires/tertiaires sur marque
 */
export interface BrandContrastPalette {
  /** Primaire assombrie (luminance ≤ 0,40) — fonds porteurs de texte blanc. */
  primaryDeep: string;
  /** Secondaire assombrie (luminance ≤ 0,40). */
  secondaryDeep: string;
  /** Primaire lisible sur fond clair (luminance ≤ 0,45). */
  primaryText: string;
  /** Secondaire lisible sur fond clair (luminance ≤ 0,45). */
  secondaryText: string;
  /** Accent lisible sur fond clair. */
  accentText: string;
  /** Accent lisible sur le fond de marque (gradient assombri). */
  accentOnBrand: string;
  /** Texte sur fond de marque : blanc ou encre selon la luminance. */
  onBrand: string;
  /** Texte secondaire sur marque (≈ ancien text-blue-100). */
  onBrandSoft: string;
  /** Texte tertiaire sur marque (≈ ancien text-blue-200/70). */
  onBrandSofter: string;
}

export function buildBrandContrast(
  primary: string,
  secondary: string,
  accent: string,
): BrandContrastPalette {
  const primaryDeep = darkenUntil(primary, 0.40);
  const secondaryDeep = darkenUntil(secondary, 0.40);
  const onBrand = pickForeground(primaryDeep);
  return {
    primaryDeep,
    secondaryDeep,
    primaryText: darkenUntil(primary, 0.45),
    secondaryText: darkenUntil(secondary, 0.45),
    accentText: darkenUntil(accent, 0.45),
    accentOnBrand: readableOn(accent, primaryDeep),
    onBrand,
    onBrandSoft: mix(onBrand, primaryDeep, 0.22),
    onBrandSofter: mix(onBrand, primaryDeep, 0.42),
  };
}
