/**
 * Page d'accueil (Landing Page)
 * 
 * Landing page unique, longue, premium et orientée conversion
 * Toutes les sections sur une seule page (scroll vertical)
 */

import { Metadata } from 'next';
import PremiumLandingPage from '@/components/public/PremiumLandingPage';
import StructuredData from '@/components/public/StructuredData';
import { getPublicSiteUrl, OG_IMAGE_MAIN, buildAbsoluteOGImageUrl } from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';
const siteUrl = getPublicSiteUrl();
const ogImageAbsolute = `${siteUrl}${OG_IMAGE_MAIN}`;

export const metadata: Metadata = {
  title: 'Academia Helm - Plateforme de pilotage éducatif',
  description: 'La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.',
  robots: { index: true, follow: true },
  keywords: [
    'pilotage éducatif',
    'logiciel école',
    'plateforme éducation',
    'gestion établissement scolaire',
    'ORION IA éducation',
    'Academia Helm',
    'gestion scolaire Bénin',
    'gestion scolaire Afrique de l\'Ouest',
  ],
  openGraph: {
    title: 'Academia Helm - Plateforme de pilotage éducatif',
    description: 'La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.',
    url: siteUrl,
    siteName: 'Academia Helm',
    images: [
      {
        url: ogImageAbsolute,
        width: 1200,
        height: 630,
        alt: 'Academia Helm - Plateforme de pilotage éducatif',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academia Helm - Plateforme de pilotage éducatif',
    description: 'La plateforme de pilotage éducatif nouvelle génération.',
    images: [ogImageAbsolute],
  },
  alternates: {
    canonical: siteUrl,
    languages: buildHreflangLanguages(siteUrl, ''),
  },
};

// Pas de fetch SSR vers l’API (évite blocage si API down) ; avis = client dans ReviewsSection.
export default function HomePage() {
  return (
    <>
      <StructuredData platformReviews={[]} />
      <PremiumLandingPage />
    </>
  );
}

