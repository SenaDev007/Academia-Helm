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
import { buildSiteVerification, getPublicSiteUrl, DEFAULT_OG_IMAGE_PATH } from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';
import { cn } from "@/lib/utils";

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
  variable: '--font-sans', // Aligné Shadcn / design system (--font-sans)
  preload: true, // ✅ Précharger les polices locales (rapide, pas de timeout)
});

// Titre par défaut unique (un seul titre, pas de template pour éviter toute concaténation)
const defaultTitle = `${BRAND.name} - ${BRAND.subtitle}`;
const defaultDescription = `${BRAND.description}. ${BRAND.slogan}`;

const siteUrl = getPublicSiteUrl();
const verification = buildSiteVerification();

// eslint-disable-next-line @next/next/no-head-element
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  keywords: [
    'pilotage éducatif',
    'plateforme éducation',
    'gestion établissement scolaire',
    'logiciel école',
    'ORION IA',
    BRAND.name,
    'Bénin',
    'Afrique de l’Ouest',
  ],
  authors: [{ name: BRAND.name, url: siteUrl }],
  creator: 'YEHI OR Tech',
  publisher: BRAND.name,
  category: 'technology',
  ...(verification ? { verification } : {}),
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
    url: siteUrl,
    siteName: BRAND.name,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: defaultTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: BRAND.description,
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
    <html lang="fr" className={cn('scroll-smooth', 'font-sans', inter.variable)}>
      <body className={`${inter.className} antialiased overflow-x-hidden`}>
        {children}
        <InstallPromptWrapper />
      </body>
    </html>
  );
}
