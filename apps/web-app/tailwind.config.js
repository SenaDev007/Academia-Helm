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
         *
         * ⭐ 2026-11-26 — THÈME AUTOMATIQUE PAR ÉCOLE (palette du logo) :
         * Les palettes blue / gold / helm sont désormais pilotées par des
         * VARIABLES CSS (--ah-*) avec les valeurs Helm historiques en
         * FALLBACK. Sans injection de thème, le rendu est strictement
         * identique à avant (aucun flash : le fallback vit dans la définition
         * même de la couleur, et le thème est injecté côté SERVEUR dans le
         * HTML du layout /app — présent dès le premier paint, contrairement
         * à l'ancien TenantThemeProvider client qui causait un flash noir).
         *
         * Quand une école a une palette (customColors CMS > logoPalette auto
         * > thème officiel — même chaîne que le site institutionnel), le
         * composant <AppBrandTheme/> (src/app/app/brand-theme.tsx) définit
         * ces variables sur :root → sidebar, boutons, modales, graphiques,
         * hover/focus, gradients… prennent la couleur de l'école.
         *
         * L'ancien commentaire (couleurs hardcodées pour éviter le flash)
         * reste documenté : c'est le fallback var(--x, #hex) qui le résout. */
        helm: {
          navy: 'var(--ah-helm-navy, #0D1F6E)',
          navyl: 'var(--ah-helm-navyl, #1A3490)',
          gold: 'var(--ah-helm-gold, #F5A623)',
          goldd: 'var(--ah-helm-goldd, #C07800)',
        },
        // BLEU PRINCIPAL — devient la couleur PRIMAIRE de l'école (60% de l'UI)
        blue: {
          900: 'var(--ah-blue-900, #0A2A5E)', // Base — Autorité, structure principale (sidebar)
          800: 'var(--ah-blue-800, #0D3B85)', // Header, sidebar, fonds structurants
          700: 'var(--ah-blue-700, #114FC4)', // Hover, focus, highlights contrôlés
          600: 'var(--ah-blue-600, #1C6FE8)', // Éléments actifs, liens importants
          500: 'var(--ah-blue-500, #3b82f6)', // Liens, texte secondaire
          400: 'var(--ah-blue-400, #60a5fa)', // Texte atténué sur fond foncé
          300: 'var(--ah-blue-300, #93c5fd)', // Texte muted sur sidebar
          200: 'var(--ah-blue-200, #bfdbfe)', // Texte très muted
          100: 'var(--ah-blue-100, #dbeafe)', // Texte hover clair
          // ⭐ 2026-11-27 — blue-50 existait dans le CODE (items actifs des
          // sidebars Enseignant/Admin : bg-blue-50) mais PAS dans cette
          // palette → la classe n'était jamais générée (fond invisible).
          50: 'var(--ah-blue-100, #eff6ff)',
        },

        // GOLD PREMIUM — devient la couleur d'ACCENT de l'école (usage ≤ 5%)
        gold: {
          600: 'var(--ah-gold-600, #CFA63A)', // Accent principal (ORION, badges premium)
          500: 'var(--ah-gold-500, #F2C94C)', // Badges premium, focus, points d'accent
          400: 'var(--ah-gold-400, #FFE08A)', // Hover très subtil (rare)
        },

        /* ⭐ 2026-11-27 — UNIFICATION TOTALE DE LA PALETTE (demande promoteur :
         * « ça ne s'applique pas partout… il faut que ça s'applique à tous les
         * modules, à tous les onglets et sous-onglets, les boutons et autres…
         * même les icônes, pour que tout soit unifié »).
         *
         * Les palettes violettes (indigo / violet / purple) étaient utilisées
         * comme accents de module (examens, RH, paramètres…) et restaient
         * fixes. Elles suivent désormais la couleur PRIMAIRE de l'école via
         * les MÊMES variables --ah-blue-* que la palette blue : dans /app,
         * chaque classe indigo/violet/purple prend automatiquement la teinte
         * de l'école (hover, focus, gradients et icônes compris).
         *
         * HORS /app (login, site institutionnel…) et pour les écoles SANS
         * palette : le fallback = les hex ORIGINAUX de Tailwind → rendu
         * strictement inchangé (même stratégie fail-open que blue/gold).
         *
         * ⚠️ green / emerald / red / amber restent SÉMANTIQUES (succès /
         * erreur / avertissement) — elles ne sont volontairement PAS mappées. */
        indigo: {
          950: 'var(--ah-blue-900, #1e1b4b)',
          900: 'var(--ah-blue-900, #312e81)',
          800: 'var(--ah-blue-800, #3730a3)',
          700: 'var(--ah-blue-700, #4338ca)',
          600: 'var(--ah-blue-600, #4f46e5)',
          500: 'var(--ah-blue-500, #6366f1)',
          400: 'var(--ah-blue-400, #818cf8)',
          300: 'var(--ah-blue-300, #a5b4fc)',
          200: 'var(--ah-blue-200, #c7d2fe)',
          100: 'var(--ah-blue-100, #e0e7ff)',
          50: 'var(--ah-blue-100, #eef2ff)',
        },
        violet: {
          950: 'var(--ah-blue-900, #2e1065)',
          900: 'var(--ah-blue-900, #4c1d95)',
          800: 'var(--ah-blue-800, #5b21b6)',
          700: 'var(--ah-blue-700, #6d28d9)',
          600: 'var(--ah-blue-600, #7c3aed)',
          500: 'var(--ah-blue-500, #8b5cf6)',
          400: 'var(--ah-blue-400, #a78bfa)',
          300: 'var(--ah-blue-300, #c4b5fd)',
          200: 'var(--ah-blue-200, #ddd6fe)',
          100: 'var(--ah-blue-100, #ede9fe)',
          50: 'var(--ah-blue-100, #f5f3ff)',
        },
        purple: {
          950: 'var(--ah-blue-900, #3b0764)',
          900: 'var(--ah-blue-900, #581c87)',
          800: 'var(--ah-blue-800, #6b21a8)',
          700: 'var(--ah-blue-700, #7e22ce)',
          600: 'var(--ah-blue-600, #9333ea)',
          500: 'var(--ah-blue-500, #a855f7)',
          400: 'var(--ah-blue-400, #c084fc)',
          300: 'var(--ah-blue-300, #d8b4fe)',
          200: 'var(--ah-blue-200, #e9d5ff)',
          100: 'var(--ah-blue-100, #f3e8ff)',
          50: 'var(--ah-blue-100, #faf5ff)',
        },

        /* ⭐ 2026-11-27 (2e vague — « la palette ne s'applique pas aux UI par
         * rôle : enseignants, secrétaire, secrétaire-comptable, directeur,
         * parents ») — Les échelles RESTANTES à usage purement DÉCORATIF
         * suivent désormais elles aussi la couleur PRIMAIRE de l'école :
         *   • sky  : accent du portail SECRÉTAIRE (sidebar, items actifs)
         *   • teal : accent du portail SURVEILLANT + chips Helm Connect
         *   • cyan : chips de modules (planification annuelle…)
         *   • fuchsia / pink / lime : chips d'icônes et badges décoratifs
         * Même mécanisme fail-open que blue/indigo : hors /app et pour les
         * écoles sans palette, le fallback = hex d'origine → rendu inchangé.
         *
         * ⚠️ Restent SÉMANTIQUES (volontairement NON mappées) :
         *   • emerald / green — succès (Payé, Présent, Validé, Actif)
         *   • amber / yellow  — avertissement (En retard, Arriérés, En attente)
         *   • rose / red      — danger et actions destructrices
         *   • orange         — échelles de notes et notations (mention D, risque moyen) */
        sky: {
          950: 'var(--ah-blue-900, #082f49)',
          900: 'var(--ah-blue-900, #0c4a6e)',
          800: 'var(--ah-blue-800, #075985)',
          700: 'var(--ah-blue-700, #0369a1)',
          600: 'var(--ah-blue-600, #0284c7)',
          500: 'var(--ah-blue-500, #0ea5e9)',
          400: 'var(--ah-blue-400, #38bdf8)',
          300: 'var(--ah-blue-300, #7dd3fc)',
          200: 'var(--ah-blue-200, #bae6fd)',
          100: 'var(--ah-blue-100, #e0f2fe)',
          50: 'var(--ah-blue-100, #f0f9ff)',
        },
        teal: {
          950: 'var(--ah-blue-900, #042f2e)',
          900: 'var(--ah-blue-900, #134e4a)',
          800: 'var(--ah-blue-800, #115e59)',
          700: 'var(--ah-blue-700, #0f766e)',
          600: 'var(--ah-blue-600, #0d9488)',
          500: 'var(--ah-blue-500, #14b8a6)',
          400: 'var(--ah-blue-400, #2dd4bf)',
          300: 'var(--ah-blue-300, #5eead4)',
          200: 'var(--ah-blue-200, #99f6e4)',
          100: 'var(--ah-blue-100, #ccfbf1)',
          50: 'var(--ah-blue-100, #f0fdfa)',
        },
        cyan: {
          950: 'var(--ah-blue-900, #083344)',
          900: 'var(--ah-blue-900, #164e63)',
          800: 'var(--ah-blue-800, #155e75)',
          700: 'var(--ah-blue-700, #0e7490)',
          600: 'var(--ah-blue-600, #0891b2)',
          500: 'var(--ah-blue-500, #06b6d4)',
          400: 'var(--ah-blue-400, #22d3ee)',
          300: 'var(--ah-blue-300, #67e8f9)',
          200: 'var(--ah-blue-200, #a5f3fc)',
          100: 'var(--ah-blue-100, #cffafe)',
          50: 'var(--ah-blue-100, #ecfeff)',
        },
        fuchsia: {
          950: 'var(--ah-blue-900, #4a044e)',
          900: 'var(--ah-blue-900, #701a75)',
          800: 'var(--ah-blue-800, #86198f)',
          700: 'var(--ah-blue-700, #a21caf)',
          600: 'var(--ah-blue-600, #c026d3)',
          500: 'var(--ah-blue-500, #d946ef)',
          400: 'var(--ah-blue-400, #e879f9)',
          300: 'var(--ah-blue-300, #f0abfc)',
          200: 'var(--ah-blue-200, #f5d0fe)',
          100: 'var(--ah-blue-100, #fae8ff)',
          50: 'var(--ah-blue-100, #fdf4ff)',
        },
        pink: {
          950: 'var(--ah-blue-900, #500724)',
          900: 'var(--ah-blue-900, #831843)',
          800: 'var(--ah-blue-800, #9d174d)',
          700: 'var(--ah-blue-700, #be185d)',
          600: 'var(--ah-blue-600, #db2777)',
          500: 'var(--ah-blue-500, #ec4899)',
          400: 'var(--ah-blue-400, #f472b6)',
          300: 'var(--ah-blue-300, #f9a8d4)',
          200: 'var(--ah-blue-200, #fbcfe8)',
          100: 'var(--ah-blue-100, #fce7f3)',
          50: 'var(--ah-blue-100, #fdf2f8)',
        },
        lime: {
          950: 'var(--ah-blue-900, #1a2e05)',
          900: 'var(--ah-blue-900, #365314)',
          800: 'var(--ah-blue-800, #3f6212)',
          700: 'var(--ah-blue-700, #4d7c0f)',
          600: 'var(--ah-blue-600, #65a30d)',
          500: 'var(--ah-blue-500, #84cc16)',
          400: 'var(--ah-blue-400, #a3e635)',
          300: 'var(--ah-blue-300, #bef264)',
          200: 'var(--ah-blue-200, #d9f99d)',
          100: 'var(--ah-blue-100, #ecfccb)',
          50: 'var(--ah-blue-100, #f7fee7)',
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
