/**
 * ============================================================================
 * HELM CONNECT — Theme System (Azure/Cyan branding)
 * ============================================================================
 *
 * Identité visuelle Helm Connect :
 *   Primary:   #1677FF (Azure blue)
 *   Dark:      #0958D9 (États actifs / hover)
 *   Light:     #E6F4FF (Bulles, arrière-plans légers)
 *   Accent:    #13C2C2 (Cyan — statuts, éléments interactifs)
 *   Background: #F5F7FA
 *   Surface:   #FFFFFF
 *   Text:      #172033
 *   Muted:     #667085
 *
 * ⭐ Dark Mode :
 *   Background: #0B1220
 *   Surface:    #111827
 *   Surface 2:  #182235
 *   Text:       #F8FAFC
 *   Text 2:     #94A3B8
 *   Primary:    #3B9EFF
 *   Accent:     #22D3EE
 *
 * ⭐ Thèmes disponibles :
 *   - Azure (défaut)
 *   - Emerald (vert école)
 *   - Violet (créatif)
 *   - Amber (chaleureux)
 *   - Midnight (sombre premium)
 *   - Tenant (thème institutionnel — défini par l'établissement)
 *
 * ⭐ Règles fonctionnelles (ne changent jamais selon le thème) :
 *   - Rouge #DC2626 = danger/erreur
 *   - Vert #16A34A = succès/validation
 *   - Orange #F59E0B = avertissement
 *   - Bleu = information/action (couleur principale du thème)
 * ============================================================================
 *
 * Usage CSS :
 *   <div className="bg-helm-bg text-helm-text" />
 *   <button className="bg-helm-primary text-white hover:bg-helm-primary-dark" />
 *
 * Usage JS (Tailwind config ou CSS variables) :
 *   const theme = getHelmTheme();
 *   theme.primary  // #1677FF
 *   theme.accent   // #13C2C2
 * ============================================================================
 */

export type HelmThemeName = 'azure' | 'emerald' | 'violet' | 'amber' | 'midnight' | 'tenant';

export interface HelmTheme {
  name: HelmThemeName;
  label: string;
  emoji: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  // Dark mode overrides
  dark: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceSecondary: string;
    text: string;
    textSecondary: string;
  };
}

export const HELM_THEMES: Record<HelmThemeName, HelmTheme> = {
  azure: {
    name: 'azure',
    label: 'Azure Helm',
    emoji: '🔵',
    primary: '#1677FF',
    primaryDark: '#0958D9',
    primaryLight: '#E6F4FF',
    accent: '#13C2C2',
    dark: {
      primary: '#3B9EFF',
      accent: '#22D3EE',
      background: '#0B1220',
      surface: '#111827',
      surfaceSecondary: '#182235',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
  emerald: {
    name: 'emerald',
    label: 'Emerald',
    emoji: '🟢',
    primary: '#10B981',
    primaryDark: '#047857',
    primaryLight: '#D1FAE5',
    accent: '#06B6D4',
    dark: {
      primary: '#34D399',
      accent: '#22D3EE',
      background: '#0B1220',
      surface: '#111827',
      surfaceSecondary: '#182235',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
  violet: {
    name: 'violet',
    label: 'Violet',
    emoji: '🟣',
    primary: '#7C3AED',
    primaryDark: '#5B21B6',
    primaryLight: '#EDE9FE',
    accent: '#06B6D4',
    dark: {
      primary: '#A78BFA',
      accent: '#22D3EE',
      background: '#0B1220',
      surface: '#1A1033',
      surfaceSecondary: '#241640',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
  amber: {
    name: 'amber',
    label: 'Amber',
    emoji: '🟠',
    primary: '#F59E0B',
    primaryDark: '#B45309',
    primaryLight: '#FEF3C7',
    accent: '#06B6D4',
    dark: {
      primary: '#FBBF24',
      accent: '#22D3EE',
      background: '#0B1220',
      surface: '#1F1A11',
      surfaceSecondary: '#2A2316',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    emoji: '🌑',
    primary: '#3B82F6',
    primaryDark: '#1E40AF',
    primaryLight: '#1E3A8A',
    accent: '#8B5CF6',
    dark: {
      primary: '#60A5FA',
      accent: '#A78BFA',
      background: '#000000',
      surface: '#0A0A0A',
      surfaceSecondary: '#161616',
      text: '#FAFAFA',
      textSecondary: '#737373',
    },
  },
  tenant: {
    name: 'tenant',
    label: 'Thème de l\'établissement',
    emoji: '🏫',
    // Default values — overridden by tenant theme config
    primary: '#1677FF',
    primaryDark: '#0958D9',
    primaryLight: '#E6F4FF',
    accent: '#13C2C2',
    dark: {
      primary: '#3B9EFF',
      accent: '#22D3EE',
      background: '#0B1220',
      surface: '#111827',
      surfaceSecondary: '#182235',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
};

export const HELM_DEFAULT_THEME: HelmThemeName = 'azure';

/**
 * Récupère le thème Helm Connect pour l'utilisateur courant.
 * V1: toujours Azure (défaut). V2: lira localStorage 'helm-theme' ou la
 * préférence utilisateur côté backend.
 */
export function getHelmTheme(): HelmTheme {
  if (typeof window === 'undefined') {
    return HELM_THEMES.azure;
  }
  try {
    const stored = localStorage.getItem('helm-theme') as HelmThemeName | null;
    if (stored && HELM_THEMES[stored]) {
      return HELM_THEMES[stored];
    }
  } catch {
    // localStorage not available
  }
  return HELM_THEMES[HELM_DEFAULT_THEME];
}

export function setHelmTheme(name: HelmThemeName): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('helm-theme', name);
    // Dispatch event so React components can re-render
    window.dispatchEvent(new CustomEvent('helm-theme-change', { detail: name }));
  } catch {
    // ignore
  }
}

/**
 * Détermine si le dark mode est actif.
 * V1: prefers-color-scheme. V2: also reads user preference from backend.
 */
export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem('helm-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function setDarkMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('helm-dark-mode', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('helm-dark-mode-change', { detail: enabled }));
  } catch {
    // ignore
  }
}

/**
 * Génère les variables CSS à injecter dans un container pour appliquer
 * le thème Helm Connect.
 *
 * Usage:
 *   <div style={getHelmThemeStyle()}>
 *     <ComponentUsingVarNames />
 *   </div>
 *
 * ou en CSS:
 *   :root {
 *     --helm-primary: ...;
 *     --helm-bg: ...;
 *   }
 */
export function getHelmThemeStyle(): React.CSSProperties {
  const theme = getHelmTheme();
  const dark = isDarkMode();
  const cssVars: Record<string, string> = {
    '--helm-primary': dark ? theme.dark.primary : theme.primary,
    '--helm-primary-dark': dark ? theme.dark.primary : theme.primaryDark,
    '--helm-primary-light': dark ? theme.dark.surfaceSecondary : theme.primaryLight,
    '--helm-accent': dark ? theme.dark.accent : theme.accent,
    '--helm-bg': dark ? theme.dark.background : '#F5F7FA',
    '--helm-surface': dark ? theme.dark.surface : '#FFFFFF',
    '--helm-surface-2': dark ? theme.dark.surfaceSecondary : '#F5F7FA',
    '--helm-text': dark ? theme.dark.text : '#172033',
    '--helm-text-muted': dark ? theme.dark.textSecondary : '#667085',
    // Functional colors (constant)
    '--helm-danger': '#DC2626',
    '--helm-success': '#16A34A',
    '--helm-warning': '#F59E0B',
  };
  // Cast to React.CSSProperties — TypeScript doesn't natively support custom props
  return cssVars as React.CSSProperties;
}
