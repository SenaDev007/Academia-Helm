'use client';

/**
 * ============================================================================
 * ThemeApplier — Applique les variables CSS d'un thème sur le DOM
 * ============================================================================
 *
 * Utilisation :
 *   - Côté public (site institutionnel) : un composant <ThemeApplier />
 *     placé en haut du rendu injecte les variables CSS sur <html> via
 *     useEffect. Le thème est résolu depuis l'API tenant-website.
 *   - Côté CMS admin (preview) : un wrapper <ThemeApplierScope theme={...} />
 *     applique les variables sur un <div> scope (pas sur <html>) pour
 *     isoler la preview du reste de l'admin.
 *
 * Les variables CSS injectées sont au format shadcn/ui standard :
 *   --background, --foreground, --primary, --secondary, --muted, --accent,
 *   --destructive, --border, --input, --ring, --radius, etc.
 *
 * Les composants utilisent ensuite hsl(var(--xxx)) pour référencer ces
 * variables dans leur className Tailwind.
 * ============================================================================
 */

import { useEffect, useMemo } from 'react';
import {
  type Theme,
  type ThemeMode,
  type ThemeVariant,
  resolveThemeVariant,
  getThemeById,
  DEFAULT_ACADEMIA_HELM_THEME,
} from './themes.config';

// === Variante → CSS string (variables inline) ===

function variantToCssVars(variant: ThemeVariant): string {
  const c = variant.colors;
  const t = variant.typography;
  return [
    `--background: ${c.background}`,
    `--foreground: ${c.foreground}`,
    `--card: ${c.card}`,
    `--card-foreground: ${c.cardForeground}`,
    `--popover: ${c.popover}`,
    `--popover-foreground: ${c.popoverForeground}`,
    `--primary: ${c.primary}`,
    `--primary-foreground: ${c.primaryForeground}`,
    `--secondary: ${c.secondary}`,
    `--secondary-foreground: ${c.secondaryForeground}`,
    `--muted: ${c.muted}`,
    `--muted-foreground: ${c.mutedForeground}`,
    `--accent: ${c.accent}`,
    `--accent-foreground: ${c.accentForeground}`,
    `--destructive: ${c.destructive}`,
    `--destructive-foreground: ${c.destructiveForeground}`,
    `--border: ${c.border}`,
    `--input: ${c.input}`,
    `--ring: ${c.ring}`,
    `--sidebar: ${c.sidebar}`,
    `--sidebar-foreground: ${c.sidebarForeground}`,
    `--sidebar-primary: ${c.sidebarPrimary}`,
    `--sidebar-primary-foreground: ${c.sidebarPrimaryForeground}`,
    `--sidebar-accent: ${c.sidebarAccent}`,
    `--sidebar-accent-foreground: ${c.sidebarAccentForeground}`,
    `--sidebar-border: ${c.sidebarBorder}`,
    `--sidebar-ring: ${c.sidebarRing}`,
    `--chart-1: ${c.chart1}`,
    `--chart-2: ${c.chart2}`,
    `--chart-3: ${c.chart3}`,
    `--chart-4: ${c.chart4}`,
    `--chart-5: ${c.chart5}`,
    `--radius: ${variant.radius}`,
    `--font-sans: ${t.fontSans}`,
    `--font-serif: ${t.fontSerif}`,
    `--font-mono: ${t.fontMono}`,
    `--letter-spacing: ${t.letterSpacing}`,
  ].join('; ');
}

// === Mode 'auto' : écoute les changements d'OS ===

function useSystemDarkMode(): boolean {
  // SSR-safe : retourne false côté serveur, true côté client si l'OS est en dark
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// === Hook principal : applique un thème sur un élément cible ===

interface UseThemeApplierOptions {
  themeId: string | null | undefined;
  mode: ThemeMode;
  target?: 'html' | HTMLElement; // défaut : 'html'
}

/**
 * Applique les variables CSS du thème + mode sur la cible.
 * Si themeId est vide/null, utilise le thème par défaut Academia Helm.
 * Si mode='auto', suit l'OS et se met à jour en temps réel.
 */
export function useThemeApplier({ themeId, mode, target = 'html' }: UseThemeApplierOptions) {
  // En mode auto, on doit réagir aux changements d'OS
  const systemDark = useSystemDarkMode();
  const effectiveMode: 'light' | 'dark' = mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode;

  // Calcule la variante à appliquer
  const variant = useMemo<ThemeVariant>(() => {
    const theme: Theme = getThemeById(themeId || '') || DEFAULT_ACADEMIA_HELM_THEME;
    return effectiveMode === 'dark' ? theme.dark : theme.light;
  }, [themeId, effectiveMode]);

  // Calcule le CSS string
  const cssVars = useMemo(() => variantToCssVars(variant), [variant]);

  // Applique sur la cible
  useEffect(() => {
    const el = target === 'html'
      ? document.documentElement
      : target;
    if (!el) return;

    el.setAttribute('style', cssVars);
    // Ajoute aussi la classe 'dark' sur <html> pour Tailwind (si dark mode)
    if (target === 'html') {
      if (effectiveMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [cssVars, effectiveMode, target]);

  // En mode auto, écoute les changements d'OS
  useEffect(() => {
    if (mode !== 'auto' || typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Force re-render via le hook useSystemDarkMode
      // (le useEffect suivant s'occupera de réappliquer)
      const evt = new Event('theme-mode-change');
      window.dispatchEvent(evt);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  return { variant, cssVars, effectiveMode };
}

// === Composant <ThemeApplier /> pour le site public ===

interface ThemeApplierProps {
  themeId: string | null | undefined;
  mode: ThemeMode;
}

/**
 * Composant invisible qui applique le thème sur <html>.
 * À placer en haut du rendu du site institutionnel public.
 */
export function ThemeApplier({ themeId, mode }: ThemeApplierProps) {
  useThemeApplier({ themeId, mode, target: 'html' });
  return null;
}

// === Composant <ThemeScope> pour les previews CMS admin ===

interface ThemeScopeProps {
  theme: Theme;
  mode: ThemeMode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper qui isole un sous-arbre avec son propre thème (preview inline).
 * N'affecte PAS le <html> global — seulement le <div> wrappé.
 */
export function ThemeScope({ theme, mode, children, className = '' }: ThemeScopeProps) {
  const variant = resolveThemeVariant(theme, mode);
  const cssVars = useMemo(() => variantToCssVars(variant), [variant]);

  return (
    <div
      className={className}
      style={{
        // Convertit la chaîne CSS en objet pour React
        ...(cssVars.split('; ').reduce((acc, kv) => {
          const [k, v] = kv.split(': ');
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {} as Record<string, string>)),
        fontFamily: 'var(--font-sans)',
        borderRadius: 'var(--radius)',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      {children}
    </div>
  );
}

// === Helper : génère le CSS string pour un thème donné (utile pour SSR) ===

export function getThemeCssVars(themeId: string | null | undefined, mode: ThemeMode): string {
  const theme: Theme = getThemeById(themeId || '') || DEFAULT_ACADEMIA_HELM_THEME;
  // En SSR, mode 'auto' → on prend light par défaut (le client corrigera)
  const variant = mode === 'dark' ? theme.dark : theme.light;
  return variantToCssVars(variant);
}
