/**
 * Design Tokens System - Academia Hub V2
 * 
 * CHARTE COULEURS PREMIUM — VERSION 2.0
 * Alignée avec le logo officiel (Bouclier + AH bleu lumineux + point gold)
 * 
 * RÈGLE D'OR (À GRAVER) :
 * La couleur n'est jamais décorative.
 * Elle est hiérarchique, fonctionnelle et rare.
 * 
 * DISTRIBUTION STRICTE :
 * - 60% : Royal Institutional Blue
 * - 25% : White / Cloud / Mist
 * - 10% : Professional Graphite
 * - ≤5% : Living Gold / Crimson
 * 
 * OBJECTIF :
 * Ne plus jamais écrire de classes arbitraires.
 * Utiliser uniquement les tokens définis ici.
 */

/**
 * Tokens de Couleurs V2
 * 
 * RÈGLES D'UTILISATION OFFICIELLES :
 * 
 * 🟦 Royal Institutional Blue (60%)
 * - Rôle : autorité, structure, cadre principal
 * - Usage : Header, Sidebar, Titres H1/H2, Contours, Fond dashboard
 * - blue-900: Base (autorité)
 * - blue-800: Header, sidebar, fonds structurants
 * - blue-700: Hover, focus, highlights
 * - blue-600: Éléments actifs, liens importants
 * 
 * ⚪ White / Cloud / Mist (25%)
 * - Rôle : respiration, lisibilité, structure
 * - Usage : Fonds principaux, Cartes, Modales, Zones de lecture
 * - white: Fond carte, modale
 * - cloud: Fond application
 * - mist: Fond secondaire, séparateurs
 * 
 * ⚙️ Professional Graphite (10%)
 * - Rôle : information secondaire, texte
 * - Usage : Textes non prioritaires, Labels, Séparateurs
 * - graphite-900: Texte principal
 * - graphite-700: Texte secondaire
 * - graphite-500: Labels, méta
 * 
 * 🟡 Living Gold (≤5%)
 * - Rôle : distinction premium (RARE)
 * - Usage : KPI majeurs, ORION (accent discret), Badges "Premium / Actif"
 * - gold-600: Accent principal
 * - gold-500: Badges premium, focus
 * - gold-400: Hover très subtil (rare)
 * - Jamais sur de gros aplats
 * - Jamais pour du texte long
 * 
 * 🔴 Crimson (CTA uniquement)
 * - Rôle : décision / gravité
 * - Usage : CTA principal uniquement, Alertes critiques
 * - crimson-600: CTA principal
 * - crimson-500: Hover CTA
 * - Jamais pour la décoration
 * - Jamais pour du texte standard
 */
export const colors = {
  // Brand Colors
  brand: {
    primary: 'blue-900',      // Royal Institutional Blue - Autorité
    secondary: 'white',       // Pure White - Respiration
    accent: 'gold-500',       // Living Gold - Premium (RARE < 5%)
    danger: 'crimson-600',    // Crimson - CTA principal uniquement
  },
  
  // Text Colors
  text: {
    primary: 'graphite-900',      // Texte principal
    secondary: 'graphite-700',   // Texte secondaire
    muted: 'graphite-500',       // Texte atténué, labels
    inverse: 'white',         // Texte sur fond sombre
    disabled: 'graphite-500',    // Texte désactivé
  },
  
  // Background Colors
  background: {
    app: 'cloud',           // Fond application (cloud)
    card: 'white',            // Fond carte
    sidebar: 'blue-800',      // Fond sidebar
    header: 'blue-800',       // Fond header
    dashboard: 'blue-900',    // Fond dashboard direction
    modal: 'white',           // Fond modale
    secondary: 'mist',        // Fond secondaire
  },
  
  // Border Colors
  border: {
    subtle: 'gray-200',       // Bordure légère
    default: 'gray-300',      // Bordure standard
    strong: 'blue-700',       // Bordure forte
    accent: 'gold-500',       // Bordure accent (RARE)
  },
  
  // Status Colors
  status: {
    success: 'green-600',     // Succès
    warning: 'yellow-600',    // Attention
    error: 'crimson-600',     // Erreur critique
    info: 'blue-600',         // Information
  },
  
  // Interactive States
  interactive: {
    hover: 'blue-700',        // Hover blue
    active: 'blue-600',       // Active blue
    focus: 'blue-700',        // Focus blue
    disabled: 'gray-300',     // Désactivé
  },
} as const;

/**
 * Tokens Typographiques
 * 
 * TYPOGRAPHIE OFFICIELLE :
 * - Police principale : Inter (UI, textes, KPI, formulaires)
 * - Police secondaire : Montserrat (Landing page uniquement)
 * - Dans l'app : Inter uniquement
 */
export const typography = {
  // Headings
  heading: {
    h1: 'text-h1',            // 32px / 40px / 700
    h2: 'text-h2',            // 24px / 32px / 700
    h3: 'text-h3',            // 20px / 28px / 600
    h4: 'text-h4',            // 18px / 24px / 600
  },
  
  // Body Text
  body: {
    large: 'text-body-large', // 16px / 24px / 400
    base: 'text-body',        // 14px / 20px / 400
    small: 'text-body-small', // 12px / 16px / 400
  },
  
  // Labels & Captions
  label: 'text-label',        // 14px / 20px / 500
  caption: 'text-caption',    // 12px / 16px / 400
  
  // Font Families
  font: {
    primary: 'font-sans',     // Inter (défaut)
    secondary: 'font-montserrat', // Montserrat (landing uniquement)
  },
} as const;

/**
 * Tokens UI (Radius, Shadow, Spacing)
 */
export const radius = {
  button: 'rounded-subtle',   // 6px - Boutons, inputs
  card: 'rounded-card',       // 8px - Cartes
  modal: 'rounded-modal',     // 12px - Modales
} as const;

export const shadow = {
  subtle: 'shadow-subtle',    // Ombre légère
  card: 'shadow-card',         // Ombre carte
  cardHover: 'shadow-card-hover', // Ombre carte hover
} as const;

/**
 * Tokens Spacing
 * Système basé sur 8px
 */
export const spacing = {
  xs: 'p-1',      // 4px
  sm: 'p-2',      // 8px
  md: 'p-4',      // 16px
  lg: 'p-6',      // 24px
  xl: 'p-8',      // 32px
  '2xl': 'p-12',  // 48px
} as const;

/**
 * Tokens Icon
 * Alignement avec la charte iconographique
 */
export const icon = {
  size: {
    menu: 20,        // Menu principal
    submenu: 16,     // Sous-menu
    dashboard: 24,   // Dashboard / KPI
    action: 16,      // Bouton action
    alert: 18,       // Alertes
  },
  stroke: 1.5,       // Standard Lucide
} as const;

/**
 * Helper Functions
 */

/**
 * Génère une classe de couleur de texte
 */
export function textColor(variant: keyof typeof colors.text): string {
  return `text-${colors.text[variant]}`;
}

/**
 * Génère une classe de couleur de fond
 */
export function bgColor(variant: keyof typeof colors.background): string {
  const color = colors.background[variant];
  // Gérer les couleurs spéciales (cloud, mist)
  if (color === 'cloud') return 'bg-cloud';
  if (color === 'mist') return 'bg-mist';
  return `bg-${color}`;
}

/**
 * Génère une classe de couleur de bordure
 */
export function borderColor(variant: keyof typeof colors.border): string {
  return `border-${colors.border[variant]}`;
}

/**
 * Génère une classe de couleur de statut
 */
export function statusColor(variant: keyof typeof colors.status): string {
  return `text-${colors.status[variant]}`;
}

/**
 * Génère une classe typographique
 */
export function typo(variant: keyof typeof typography.heading | keyof typeof typography.body | 'label' | 'caption'): string {
  if (variant in typography.heading) {
    return typography.heading[variant as keyof typeof typography.heading];
  }
  if (variant in typography.body) {
    return typography.body[variant as keyof typeof typography.body];
  }
  return typography[variant as 'label' | 'caption'];
}
