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
// ⛔ OFFLINE-FIRST DÉSACTIVÉ — SW désactivé temporairement
// import { ServiceWorkerCleanup } from '@/components/pwa/ServiceWorkerCleanup';
// import { UniversalSWRegister } from '@/components/pwa/UniversalSWRegister';
// OrionWidget — désactivé temporairement, sera réimplémenté selon les specs
// import OrionWidget from '@/components/OrionWidget';
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
import I18nWrapper from '@/components/i18n/I18nWrapper';
import { PWARegister } from '@/components/pwa/PWARegister';
import { extractSchoolSubdomain } from '@/lib/pwa/manifest-branding';

// ✅ POLICES LOCALES - Téléchargées depuis Google Fonts et stockées localement
// 
// Avantages :
// - Pas de dépendance à la connexion Internet
// - Chargement plus rapide (pas de requête externe)
// - Fonctionne même si Google Fonts est inaccessible
// - Meilleure performance et contrôle
// 
// Les fichiers de police sont stockés dans : src/fonts/inter/
// ✅ POLICES LOCALES — 4 graisses en WOFF2 (subset Latin) — 79 KB total (vs 1.27 MB en TTF)
// Conversion TTF → WOFF2 + subset Latin de base : 94% de réduction.
// Si une page a besoin de plus de glyphs (Cyrillique, Grec, etc.), ajouter
// un font-face dynamique ou remettre les TTF originaux (backup dans _originals-ttf/).
const inter = localFont({
  src: [
    {
      path: '../fonts/inter/inter-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/inter/inter-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/inter/inter-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/inter/inter-700.woff2',
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
 *   → /images/OpenGraph-AcademiaHelm.webp
 *
 * - Sous-domaine tenant (*.academiahelm.com)
 *   → /images/OpenGraph-AcademiaHelmTenants.webp
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

  // ⭐ PWA — manifest et icône iOS dynamiques selon le contexte :
  //   - Domaine principal → /manifest.json (site corporate Academia Helm,
  //     branding AH, icône statique)
  //   - Sous-domaine école → /manifest-site.webmanifest (branding de
  //     l'école : nom, logo, couleurs — résolu côté route). L'icône iOS
  //     (apple-touch-icon) est générée à la volée par /pwa-icon à partir
  //     du logo de l'école.
  //   Les pages de l'application (/app/*, /login, /portal) surchargent ce
  //   manifest par /manifest-app.webmanifest (voir leurs layouts).
  const schoolSubdomain = mainDomain ? null : extractSchoolSubdomain(hostname.split(':')[0]);
  const manifestUrl = schoolSubdomain ? '/manifest-site.webmanifest' : '/manifest.json';
  const appleTouchIcon = schoolSubdomain
    ? `/pwa-icon?tenant=${encodeURIComponent(schoolSubdomain)}&s=180`
    : '/apple-touch-icon.png';

  const title = mainDomain
    ? defaultTitle
    : `${tenantSubdomain} — Portail Academia Helm`;

  const description = mainDomain
    ? defaultDescription
    : `Accédez au portail de votre établissement sur Academia Helm. Gestion scolaire, notes, emplois du temps et plus.`;

  const url = mainDomain
    ? 'https://www.academiahelm.com'
    : `https://${hostname.split(':')[0]}`;

  // Type MIME : JPG pour image statique, PNG pour image dynamique tenant
  const ogImageType = mainDomain ? 'image/jpeg' : 'image/png';

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
      capable: true,
      statusBarStyle: 'default',
      title: mainDomain ? 'Academia Helm' : `${tenantSubdomain} — Academia Helm`,
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.png', type: 'image/png' },
      ],
      apple: [{ url: appleTouchIcon }],
      shortcut: '/favicon.ico',
    },
    manifest: manifestUrl,
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
          type: ogImageType,
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
        {/* apple-mobile-web-app-title est généré dynamiquement par
            generateMetadata (appleWebApp.title) — pas de meta statique ici
            pour éviter les doublons et garder le titre par école. */}
      </head>
      <body className={`${inter.className} antialiased overflow-x-hidden`}>
        <I18nWrapper>
          {children}
        </I18nWrapper>
        {/* ⛔ OFFLINE-FIRST DÉSACTIVÉ */}
        {/* <ServiceWorkerCleanup /> */}
        <ToastContainer />

        {/* ⭐ PWA — Service Worker unifié (push + cache + installabilité
            sur PC et mobile). Captures précoces de beforeinstallprompt
            pour les bannières d'installation (PWAInstallPrompt). */}
        <PWARegister />

        {/* ────────────────────────────────────────────────────────────────
            🚀 Partytown — exécute les scripts tiers dans un Web Worker
            ────────────────────────────────────────────────────────────────
            Google Analytics et autres scripts tiers tournent normalement sur
            le main thread, ce qui bloque le rendu et augmente le TBT
            (Total Blocking Time). Partytown les déplace dans un Web Worker,
            libérant le main thread pour les interactions utilisateur.

            Gain estimé : +3-5 pts TBT sur Lighthouse mobile.
            ──────────────────────────────────────────────────────────────── */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@builder.io/partytown@0.10/lib/partytown.js"
          strategy="beforeInteractive"
        />
        {/* ✅ Google Analytics via Partytown (type="text/partytown") —
            s'exécute dans un Web Worker, ne bloque pas le main thread */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TG29Y7XL8S"
          strategy="lazyOnload"
          type="text/partytown"
        />
        <Script id="google-analytics" strategy="lazyOnload" type="text/partytown">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TG29Y7XL8S');
          `}
        </Script>
        {/* ⭐ Offline-first : enregistrer le Service Worker sur TOUTES les pages
            (site public, login, portails, app authentifiée) */}
        {/* ⛔ OFFLINE-FIRST DÉSACTIVÉ — UniversalSWRegister suspendu */}
        {/* <UniversalSWRegister /> */}

        {/* CrispChat déplacé vers app/layout-client.tsx — uniquement pour les pages authentifiées */}
        {/* ORION Widget — désactivé temporairement, sera réimplémenté selon les specs */}
      </body>
    </html>
  );
}
