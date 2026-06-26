/** @type {import('tailwindcss').Config} */
/**
 * ACADEMIA HUB — DESIGN SYSTEM OFFICIEL V2
 * 
 * PALETTE ALIGNÉE AVEC LE LOGO OFFICIEL
 * (Bouclier + monogramme AH bleu lumineux + point gold central)
 * 
 * CHARTE COULEURS PREMIUM — VERSION 2.0 VERROUILLÉE
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
 * Voir DESIGN-SYSTEM.md et docs/ICON-SYSTEM.md pour les règles complètes
 */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      ringWidth: {
        3: '3px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      colors: {
        /* Shadcn / Radix — variables oklch dans globals.css */
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        /* Design system Academia Helm (palette institutionnelle)
         * Ces couleurs sont maintenant dynamiques — elles référencent les
         * variables CSS du thème choisi par le directeur (via TenantThemeProvider).
         * Fallback vers les valeurs hardcoded si les vars ne sont pas définies. */
        helm: {
          navy: 'hsl(var(--sidebar, 222 47% 11%))',
          navyl: 'hsl(var(--primary, 217 91% 45%))',
          gold: 'hsl(var(--accent, 42 92% 56%))',
          goldd: 'hsl(var(--accent, 42 92% 40%))',
        },
        // BLEU PRINCIPAL — adapté au thème via CSS vars
        blue: {
          900: 'hsl(var(--sidebar, 222 47% 11%))',    // Base — Autorité, structure principale
          800: 'hsl(var(--sidebar, 222 47% 14%))',    // Header, sidebar, fonds structurants
          700: 'hsl(var(--primary, 217 91% 45%))',    // Hover, focus, highlights contrôlés
          600: 'hsl(var(--primary, 217 91% 60%))',    // Éléments actifs, liens importants
          500: 'hsl(var(--primary, 217 91% 65%))',    // Liens, texte secondaire
          400: 'hsl(var(--primary, 217 91% 75%))',    // Texte atténué sur fond foncé
          300: 'hsl(var(--sidebar-foreground, 210 40% 80%))', // Texte muted sur sidebar
          200: 'hsl(var(--sidebar-foreground, 210 40% 70%))', // Texte très muted
          100: 'hsl(var(--sidebar-foreground, 210 40% 90%))', // Texte hover clair
        },
        
        // GOLD PREMIUM — adapté au thème via CSS var --accent
        gold: {
          600: 'hsl(var(--accent, 42 92% 40%))',  // Accent principal (ORION, badges premium)
          500: 'hsl(var(--accent, 42 92% 56%))',  // Badges premium, focus, points d'accent
          400: 'hsl(var(--accent, 42 92% 72%))',  // Hover très subtil (rare)
        },
        
        // NEUTRES — Structure & respiration (25% de l'UI)
        white: {
          DEFAULT: '#FFFFFF',
        },
        cloud: '#F7F9FC',  // Fond application, zones de respiration
        mist: '#EEF2F8',    // Fond secondaire, séparateurs subtils
        
        // TEXTE — Professional Graphite (10% de l'UI)
        graphite: {
          900: '#0F172A', // Texte principal
          700: '#334155', // Texte secondaire
          500: '#64748B', // Labels, méta, texte atténué
        },
        
        // ALERTES / CTA CRITIQUES
        crimson: {
          600: '#B91C1C', // CTA principal, alertes critiques
          500: '#DC2626', // Hover CTA
        },
        
        // Palette gris complémentaire (pour compatibilité technique)
        gray: {
          50: '#F7F9FC',  // Cloud (alias)
          100: '#EEF2F8', // Mist (alias)
          200: '#E2E8F0', // Bordures très légères
          300: '#CBD5E1', // Bordures légères
          400: '#94A3B8', // Texte secondaire léger
          500: '#64748B', // Graphite-500 (alias)
          600: '#475569', // Texte secondaire foncé
          700: '#334155', // Graphite-700 (alias)
          800: '#1E293B', // Texte sur fond clair
          900: '#0F172A', // Graphite-900 (alias)
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        montserrat: [
          'Montserrat',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Hiérarchie typographique officielle (conservée)
        'h1': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'h3': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'h4': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-large': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-small': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        // Fluid typography (responsive)
        'fluid-sm': ['clamp(0.75rem, 2vw, 0.875rem)', { lineHeight: '1.5' }],
        'fluid-base': ['clamp(0.875rem, 2.5vw, 1rem)', { lineHeight: '1.6' }],
        'fluid-lg': ['clamp(1rem, 3vw, 1.125rem)', { lineHeight: '1.5' }],
        'fluid-xl': ['clamp(1.125rem, 4vw, 1.5rem)', { lineHeight: '1.4' }],
        'fluid-2xl': ['clamp(1.5rem, 5vw, 2.25rem)', { lineHeight: '1.3' }],
        'fluid-3xl': ['clamp(1.875rem, 6vw, 3rem)', { lineHeight: '1.2' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'subtle': '6px',  // Boutons, inputs
        'card': '8px',    // Cartes
        'modal': '12px',  // Modales
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        // Système de spacing basé sur 8px
        '18': '4.5rem', // 72px
        '22': '5.5rem', // 88px
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
  darkMode: 'class', // Activation du mode sombre via classe
}
