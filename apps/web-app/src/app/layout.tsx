/**
 * Root Layout
 * 
 * Layout global de l'application Next.js
 * 
 * ⚠️ NEXT.JS = WEB UNIQUEMENT
 * Aucune dépendance Electron ou Desktop
 */

import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

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

// eslint-disable-next-line @next/next/no-head-element
export const metadata: Metadata = {
  // ✅ metadataBase requis pour les images Open Graph et Twitter
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  
  title: 'Academia Hub - Plateforme de gestion scolaire',
  description: 'La plateforme de gestion scolaire qui structure, contrôle et sécurise vos établissements. Conçue pour les directeurs et promoteurs exigeants.',
  keywords: ['gestion scolaire', 'ERP éducation', 'Academia Hub', 'gestion établissement'],
  authors: [{ name: 'Academia Hub' }],
  creator: 'YEHI OR Tech',
  publisher: 'Academia Hub',
  // ✅ Next.js 14 gère automatiquement les icônes via metadata (pas besoin de <head> manuel)
  // Cette configuration est correcte pour Next.js 14 App Router
  icons: {
    icon: [
      { url: '/images/logo-Academia-Hub.ico', sizes: 'any' },
      { url: '/images/logo-Academia Hub.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/images/logo-Academia-Hub.ico',
    apple: [
      { url: '/images/logo-Academia Hub.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://academiahub.com',
    siteName: 'Academia Hub',
    title: 'Academia Hub - Plateforme de gestion scolaire',
    description: 'La plateforme de gestion scolaire qui structure, contrôle et sécurise vos établissements.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academia Hub - Plateforme de gestion scolaire',
    description: 'La plateforme de gestion scolaire qui structure, contrôle et sécurise vos établissements.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
