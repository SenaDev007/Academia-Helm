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
import { ServiceWorkerCleanup } from '@/components/pwa/ServiceWorkerCleanup';
import { BRAND } from '@/lib/brand';
import {
  buildSiteVerification,
  getPublicSiteUrl,
  OG_IMAGE_MAIN,
  OG_IMAGE_TENANT,
  buildAbsoluteOGImageUrl,
  detectRequestHostname,
  isMainDomain,
} from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';
import { cn } from "@/lib/utils";
import { ToastContainer } from '@/components/ui/toast';

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
// ✅ POLICES LOCALES — 4 graisses essentielles uniquement (400/500/600/700)
// Les graisses 100/200/300/800/900 sont rarement utilisées et ajoutent ~1.3 Mo inutiles.
// Si une page en a besoin, ajouter un font-face dynamique dans ce composant.
const inter = localFont({
  src: [
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
  ],
  display: 'swap', // ✅ Afficher le texte immédiatement avec fallback
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'], // ✅ Fallback système
  variable: '--font-sans', // Aligné Shadcn / design system (--font-sans)
  preload: true, // ✅ Précharger les polices locales (rapide, pas de timeout)
});

// Titre / description SEO (landing publique — domaine principal)
const defaultTitle = 'Academia Helm — Logiciel de gestion scolaire en Afrique';
const defaultDescription =
  'Pilotez votre école privée avec Academia Helm : gestion des élèves, finances, examens, RH et IA de direction ORION.';

const siteUrl = getPublicSiteUrl();
const verification = buildSiteVerification();

/**
 * generateMetadata — détection dynamique du domaine pour l'image Open Graph.
 *
 * - Domaine principal (academiahelm.com, www.academiahelm.com)
 *   → /images/OpenGraph-AcademiaHelm.png
 *
 * - Sous-domaine tenant (*.academiahelm.com)
 *   → /images/OpenGraph-AcademiaHelmTenants.png
 *
 * Les URLs des images OG sont absolues (requis par les crawlers :
 * Facebook, WhatsApp, Twitter/X, LinkedIn, Telegram, etc.).
 */
export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();
  const mainDomain = isMainDomain(hostname);
  const ogImageAbsolute = buildAbsoluteOGImageUrl(hostname);

  // Ajuster titre/description pour les sous-domaines tenant
  const tenantSubdomain = mainDomain
    ? null
    : hostname.split(':')[0].split('.')[0];

  const title = mainDomain
    ? defaultTitle
    : `${tenantSubdomain} — Portail Academia Helm`;

  const description = mainDomain
    ? defaultDescription
    : `Accédez au portail de votre établissement sur Academia Helm. Gestion scolaire, notes, emplois du temps et plus.`;

  const url = mainDomain
    ? 'https://www.academiahelm.com'
    : `https://${hostname.split(':')[0]}`;

  return {
    metadataBase: new URL('https://www.academiahelm.com'),
    title,
    description,
    keywords: [
      'pilotage éducatif',
      'plateforme éducation',
      'gestion établissement scolaire',
      'logiciel école',
      'ORION IA',
      BRAND.name,
      'Bénin',
      "Afrique de l'Ouest",
    ],
    authors: [{ name: BRAND.name, url: siteUrl }],
    creator: 'YEHI OR Tech',
    publisher: BRAND.name,
    category: 'technology',
    ...(verification ? { verification } : {}),
    appleWebApp: {
      title: mainDomain ? 'Academia Helm' : `${tenantSubdomain} — Academia Helm`,
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
      url,
      siteName: BRAND.name,
      title,
      description,
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageAbsolute],
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
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
        <ServiceWorkerCleanup />
        <ToastContainer />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TG29Y7XL8S"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TG29Y7XL8S');
          `}
        </Script>
        {/* CrispChat déplacé vers app/layout-client.tsx — uniquement pour les pages authentifiées */}
      </body>
    </html>
  );
}
