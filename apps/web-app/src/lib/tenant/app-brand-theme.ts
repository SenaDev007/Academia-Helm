/**
 * ============================================================================
 * APP BRAND THEME — Palette de l'école pour l'APPLICATION (/app/*)
 * ============================================================================
 *
 * ⭐ 2026-11-26 — Demande promoteur : « la fonctionnalité où le système
 *    récupère la palette de couleurs du logo de l'école pour designer le
 *    site institutionnel — nous allons l'appliquer à l'application
 *    proprement dite aussi : modales, boutons, tout et tout, paramétré
 *    automatiquement en fonction de la palette du site et du logo. »
 *
 * CHAÎNE DE PRIORITÉ (strictement identique au site institutionnel —
 * InstitutionalWebsite.tsx) :
 *   1. Thème officiel (themeId — module tenant-theme) → themeToColors()
 *   2. customColors (choix manuel du CMS) → resolveTenantColors()
 *   3. logoPalette (palette AUTO dérivée du logo — LogoPaletteService)
 *   4. AUCUNE injection → l'app garde son rendu Helm actuel (fallbacks
 *      hex dans tailwind.config.js — rendu strictement inchangé)
 *
 * LIVRAISON DU THÈME (zéro flash, zéro JS client) :
 *   - Le layout serveur /app (src/app/app/brand-theme.tsx) résout la
 *     palette puis rend une balise <style> INLINE dans le HTML : les
 *     variables sont présentes dès le premier paint (l'ancien
 *     TenantThemeProvider client causait un flash noir — voir le
 *     commentaire historique dans tailwind.config.js).
 *   - Les variables sont posées sur :root → les portails Radix (modales
 *     rendues dans document.body) héritent aussi du thème.
 *
 * CE QUI EST RE-THÉMÉ :
 *   - Les classes Tailwind blue-* / gold-* / helm-* (via --ah-* — gère
 *     automatiquement hover:, focus:, gradients from-/to-, bordures…)
 *   - Les primitives shadcn/ui (--primary, --ring, --secondary, --accent,
 *     --sidebar-*, --chart-*) → boutons, onglets, switches, checkboxes…
 *   - Les modales : liseré supérieur + titre colorés (règles data-slot)
 *   - .btn-primary-gold (CTA or → accent de l'école)
 *
 * CONTRASTE GARANTI :
 *   - Les fonds porteurs de texte blanc (sidebar, boutons) utilisent des
 *     dérivés assombris jusqu'à luminance simple ≤ 0,40 (≈ WCAG 4,5:1 sur
 *     blanc — calibré sur le navy Helm #0A2A5E = 0,17).
 *   - --primary-foreground bascule blanc/sombre selon la luminance réelle.
 */

import { getApiBaseUrl } from '@/lib/utils/urls';
import {
  getThemeById,
  resolveThemeVariant,
  hslToHex,
  type ThemeMode,
} from '@/lib/themes/themes.config';
import { resolveTenantColors, type TenantColors } from '@/lib/tenant/use-tenant-colors';

export type { TenantColors };

/** Cache module (par instance lambda) — évite un appel API à chaque page. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expires: number; value: AppBrandResolution | null }>();

export interface AppBrandResolution {
  colors: TenantColors;
  source: 'theme' | 'customColors' | 'logoPalette';
}

interface BrandThemeResponse {
  found: boolean;
  themeId: string | null;
  themeMode: string;
  customColors: unknown;
  logoPalette: unknown;
}

/**
 * Résout la palette de marque de l'école (côté serveur, fail-open).
 * Retourne null si : slug absent, API injoignable (timeout 2,5 s), ou
 * aucune palette configurée → l'app garde son rendu Helm actuel.
 */
export async function resolveAppBrandColors(
  tenantSlug: string | null | undefined,
): Promise<AppBrandResolution | null> {
  const slug = (tenantSlug || '').trim();
  if (!slug || slug.length < 2) return null;

  const cached = cache.get(slug);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value: AppBrandResolution | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(
      `${getApiBaseUrl()}/tenant-website/public/${encodeURIComponent(slug)}/brand-theme`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Cache de données Next (5 min) — absorbé par le CDN/instance même
        // hors cache module. Aucun cookie envoyé (endpoint public).
        next: { revalidate: 300 },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (response.ok) {
      const data = (await response.json()) as BrandThemeResponse;
      if (data?.found) {
        // 1. Thème officiel
        if (data.themeId) {
          const theme = getThemeById(data.themeId);
          if (theme) {
            const variant = resolveThemeVariant(theme, (data.themeMode as ThemeMode) || 'auto');
            value = {
              colors: {
                primary: hslToHex(variant.colors.primary),
                secondary: hslToHex(variant.colors.secondary),
                accent: hslToHex(variant.colors.accent),
                dark: hslToHex(variant.colors.sidebar),
              },
              source: 'theme',
            };
          }
        }
        // 2/3. customColors (CMS) > logoPalette (auto logo)
        if (!value) {
          const paletteSource = data.customColors || data.logoPalette;
          if (paletteSource) {
            const colors = resolveTenantColors(paletteSource);
            // resolveTenantColors retombe sur HELM_DEFAULT si vide — on
            // n'injecte alors RIEN (rendu Helm inchangé pour l'app).
            const hasReal =
              JSON.stringify(colors) !== JSON.stringify(HELM_DEFAULT_COMPARE);
            if (hasReal) {
              value = {
                colors,
                source: data.customColors ? 'customColors' : 'logoPalette',
              };
            }
          }
        }
      }
    }
  } catch {
    /* fail-open : aucune palette → rendu Helm actuel */
  }

  cache.set(slug, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

// Référence pour détecter le fallback HELM_DEFAULT de resolveTenantColors.
const HELM_DEFAULT_COMPARE = resolveTenantColors(null);

// ═══════════════════════════════════════════════════════════════════════════
// GÉNÉRATION CSS — dérivations contraste-sûres depuis la palette école
// ═══════════════════════════════════════════════════════════════════════════

export function buildAppBrandCss(c: TenantColors): string {
  const primary = normalizeHex(c.primary) || '#0A2A5E';
  const accent = normalizeHex(c.accent) || '#F2C94C';
  const secondary = normalizeHex(c.secondary) || lighten(primary, 18);
  const dark = normalizeHex(c.dark) || darken(primary, 26);

  // ── Échelle primaire (remplace la palette Tailwind blue) ──
  const p900 = darkenUntil(primary, 0.40); // sidebar / fonds structurants
  const p800 = darkenUntil(primary, 0.48); // header, fonds
  const p700 = darkenUntil(primary, 0.58); // hover, focus
  const p600 = primary; // éléments actifs
  const p500 = lighten(primary, 12); // liens
  const p400 = mix(primary, '#ffffff', 0.62); // texte atténué sur fond foncé
  const p300 = mix(primary, '#ffffff', 0.72); // texte muted sidebar
  const p200 = mix(primary, '#ffffff', 0.82);
  const p100 = mix(primary, '#ffffff', 0.90);

  // ── Échelle accent (remplace la palette Tailwind gold) ──
  const a600 = darkenUntil(accent, 0.55);
  const a500 = accent;
  const a400 = mix(accent, '#ffffff', 0.55);

  // ── Tokens shadcn/ui ──
  const deep = p800; // boutons bg-primary (texte blanc lisible)
  const onPrimary = pickForeground(deep);
  // Chips/hover : teintes TRÈS claires (≈ fond à 92-94% blanc) avec texte
  // sombre teinté — comme le --secondary oklch(0.97) du thème par défaut.
  const tint06 = mix(primary, '#ffffff', 0.94);
  const tint10 = mix(primary, '#ffffff', 0.92);
  const onTint = darkenUntil(primary, 0.30);

  return `
/* ═══ Thème de marque ${primary} / ${accent} — généré côté serveur (palette de l'école) ═══ */
:root {
  /* Palette Tailwind blue → couleur PRIMAIRE de l'école */
  --ah-blue-900: ${p900};
  --ah-blue-800: ${p800};
  --ah-blue-700: ${p700};
  --ah-blue-600: ${p600};
  --ah-blue-500: ${p500};
  --ah-blue-400: ${p400};
  --ah-blue-300: ${p300};
  --ah-blue-200: ${p200};
  --ah-blue-100: ${p100};

  /* Palette Tailwind gold → couleur d'ACCENT de l'école */
  --ah-gold-600: ${a600};
  --ah-gold-500: ${a500};
  --ah-gold-400: ${a400};

  /* Palette helm historique → couleurs de l'école */
  --ah-helm-navy: ${p900};
  --ah-helm-navyl: ${p800};
  --ah-helm-gold: ${a500};
  --ah-helm-goldd: ${a600};

  /* Primitives shadcn/ui — boutons, onglets, focus, chips */
  --primary: ${deep};
  --primary-foreground: ${onPrimary};
  --secondary: ${tint06};
  --secondary-foreground: ${onTint};
  --accent: ${tint10};
  --accent-foreground: ${onTint};
  --ring: ${deep};

  /* Sidebar (composants shadcn Sidebar) */
  --sidebar-primary: ${deep};
  --sidebar-primary-foreground: ${onPrimary};
  --sidebar-accent: ${tint10};
  --sidebar-accent-foreground: ${onTint};
  --sidebar-ring: ${deep};

  /* Graphiques — palette de l'école */
  --chart-1: ${p800};
  --chart-2: ${secondary};
  --chart-3: ${a500};
  --chart-4: ${darkenUntil(dark, 0.30)};
  --chart-5: ${mix(primary, '#ffffff', 0.62)};

  /* Variables de marque libres (pour les composants qui veulent la couleur
     EXACTE du site — ex. aperçus, exports PDF rattachés à l'identité) */
  --brand-primary: ${primary};
  --brand-primary-deep: ${deep};
  --brand-secondary: ${secondary};
  --brand-accent: ${a500};
  --brand-accent-deep: ${a600};
  --brand-dark: ${dark};
}

/* ── Modales : liseré supérieur + titre à la couleur de l'école ──
   (règles data-slot — aucun composant modifié ; s'applique à toutes les
   Dialog/AlertDialog de l'app, y compris celles rendues en portail) */
[data-slot="dialog-content"] {
  border-top: 4px solid var(--brand-primary);
}
[data-slot="alert-dialog-content"] {
  border-top: 4px solid var(--brand-primary);
}
[data-slot="dialog-title"],
[data-slot="alert-dialog-title"] {
  color: var(--brand-primary-deep);
}
[data-slot="sheet-content"] {
  border-left: 4px solid var(--brand-primary);
}

/* ── CTA or historique → accent de l'école (texte selon contraste) ── */
.btn-primary-gold {
  background-color: var(--brand-accent-deep);
  color: ${pickForeground(a600)};
}
.btn-primary-gold:hover {
  background-color: var(--brand-accent);
}
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Petites fonctions couleur (miroir TS de LogoPaletteService — API)
// ═══════════════════════════════════════════════════════════════════════════

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
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Assombrit jusqu'à luminance simple ≤ max (garde la teinte). */
function darkenUntil(hex: string, maxLum: number): string {
  let [r, g, b] = parseHex(hex);
  let guard = 0;
  while (luminance(r, g, b) > maxLum && guard < 24) {
    r *= 0.92; g *= 0.92; b *= 0.92;
    guard++;
  }
  return hexOf(r, g, b);
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return hexOf(r + amount, g + amount, b + amount);
}

function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

/** Mélange une couleur avec une autre (ratio = part du DEUXIÈME, 0..1). */
function mix(hex: string, other: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(other);
  return hexOf(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  );
}

/** Blanc si le fond est assez sombre, sinon encre très sombre teintée. */
function pickForeground(bg: string): string {
  const [r, g, b] = parseHex(bg);
  return luminance(r, g, b) <= 0.55 ? '#ffffff' : '#10131c';
}
