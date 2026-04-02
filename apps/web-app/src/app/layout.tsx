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
import Script from 'next/script';
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

// Titre / description SEO (landing publique)
const defaultTitle = 'Academia Helm — Logiciel de gestion scolaire en Afrique';
const defaultDescription =
  'Pilotez votre école privée avec Academia Helm : gestion des élèves, finances, examens, RH et IA de direction ORION.';

const siteUrl = getPublicSiteUrl();
const verification = buildSiteVerification();

// eslint-disable-next-line @next/next/no-head-element
export const metadata: Metadata = {
  metadataBase: new URL('https://academiahelm.com'),
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
  appleWebApp: {
    title: 'Academia Helm',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png' }],
    shortcut: '/favicon.ico',
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
      <head>
        <meta name="apple-mobile-web-app-title" content="Academia Helm" />
      </head>
      <body className={`${inter.className} antialiased overflow-x-hidden`}>
        {children}
        <InstallPromptWrapper />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TG29Y7XL8S"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TG29Y7XL8S');
          `}
        </Script>
      </body>
    </html>
  );
}
