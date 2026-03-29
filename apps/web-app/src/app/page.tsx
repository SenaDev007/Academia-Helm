/**
 * Page d'accueil (Landing Page)
 * 
 * Landing page unique, longue, premium et orientée conversion
 * Toutes les sections sur une seule page (scroll vertical)
 */

import { Metadata } from 'next';
import PremiumLandingPage from '@/components/public/PremiumLandingPage';
import StructuredData from '@/components/public/StructuredData';
import { getPublicSiteUrl, DEFAULT_OG_IMAGE_PATH } from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';
import { fetchPublishedPlatformReviews } from '@/lib/public/platform-reviews';

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: 'Academia Helm - Plateforme de pilotage éducatif',
  description: 'La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.',
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
    url: '/',
    siteName: 'Academia Helm',
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
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
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  alternates: {
    canonical: siteUrl,
    languages: buildHreflangLanguages(siteUrl, ''),
  },
};

// Force dynamic rendering to avoid build timeouts
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const platformReviews = await fetchPublishedPlatformReviews();

  return (
    <>
      <StructuredData platformReviews={platformReviews} />
      <PremiumLandingPage />
    </>
  );
}

