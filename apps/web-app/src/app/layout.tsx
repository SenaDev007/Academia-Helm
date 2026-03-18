/**
 * Root Layout
 * 
 * Layout global de l'application Next.js
 * 
 * ⚠️ NEXT.JS = WEB UNIQUEMENT
 * Aucune dépendance Electron ou Desktop
 */

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { InstallPromptWrapper } from '@/components/pwa/InstallPromptWrapper';
import { BRAND } from '@/lib/brand';

// ✅ POLICES LOCALES - Téléchargées depuis Google Fonts et stockées localement
// 
// Avantages :
// - Pas de dépendance à la connexion Internet
// - Chargement plus rapide (pas de requête externe)
// - Fonctionne même si Google Fonts est inaccessible
// - Meilleure performance et contrôle
// 
// Les fichiers de police sont stockés dans : public/fonts/inter/
// Pour télécharger de nouvelles polices : node scripts/download-fonts.js
const inter = localFont({
  src: [
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyeMZg.ttf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyfMZg.ttf',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../fonts/inter/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  display: 'swap', // ✅ Afficher le texte immédiatement avec fallback
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'], // ✅ Fallback système
  variable: '--font-inter', // ✅ Variable CSS pour utilisation optionnelle
  preload: true, // ✅ Précharger les polices locales (rapide, pas de timeout)
  adjustFontFallback: true, // ✅ Ajuster le fallback automatiquement
});

// Titre par défaut unique (un seul titre, pas de template pour éviter toute concaténation)
const defaultTitle = `${BRAND.name} - ${BRAND.subtitle}`;
const defaultDescription = `${BRAND.description}. ${BRAND.slogan}`;

// eslint-disable-next-line @next/next/no-head-element
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: defaultTitle,
  description: defaultDescription,
  keywords: ['pilotage éducatif', 'plateforme éducation', BRAND.name, 'gestion établissement'],
  authors: [{ name: BRAND.name }],
  creator: 'YEHI OR Tech',
  publisher: BRAND.name,
  icons: {
    icon: [
      { url: '/images/logo-Academia-Hub.ico', sizes: 'any' },
      { url: BRAND.logoPath, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/images/logo-Academia-Hub.ico',
    apple: [{ url: BRAND.logoPath, sizes: '512x512', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://academiahelm.com',
    siteName: BRAND.name,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: BRAND.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D1F6E',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body className={`${inter.className} antialiased overflow-x-hidden`}>
        {children}
        <InstallPromptWrapper />
      </body>
    </html>
  );
}
