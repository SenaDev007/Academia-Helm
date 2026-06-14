/**
 * Page d'accueil (Landing Page)
 * 
 * Landing page unique, longue, premium et orientée conversion
 * Toutes les sections sur une seule page (scroll vertical)
 */

import { Metadata } from 'next';
import PremiumLandingPage from '@/components/public/PremiumLandingPage';
import StructuredData from '@/components/public/StructuredData';
import {
  buildAbsoluteOGImageUrl,
  detectRequestHostname,
  isMainDomain,
} from '@/lib/seo';
import { buildHreflangLanguages } from '@/lib/seo/locales';

/**
 * generateMetadata — utilise la détection dynamique du hostname pour
 * construire des URLs OG absolues et accessibles aux crawlers sociaux.
 *
 * Avant : la page utilisait getPublicSiteUrl() qui retournait https://academiahelm.com
 * (redirige 307 → www), causant l'échec de l'image OG sur WhatsApp/Facebook/Twitter.
 * Maintenant : détecte le hostname réel et normalise vers www.academiahelm.com.
 */
export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();
  const mainDomain = isMainDomain(hostname);

  // URL canonique : toujours www.academiahelm.com pour le domaine principal
  const canonicalUrl = mainDomain
    ? 'https://www.academiahelm.com'
    : `https://${hostname.split(':')[0]}`;

  const ogImageAbsolute = buildAbsoluteOGImageUrl(hostname);

  const title = 'Academia Helm - Plateforme de pilotage éducatif';
  const description =
    'La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.';

  return {
    title,
    description,
    robots: { index: true, follow: true },
    keywords: [
      'pilotage éducatif',
      'logiciel école',
      'plateforme éducation',
      'gestion établissement scolaire',
      'ORION IA éducation',
      'Academia Helm',
      'gestion scolaire Bénin',
      "gestion scolaire Afrique de l'Ouest",
    ],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Academia Helm',
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageAbsolute],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: buildHreflangLanguages(canonicalUrl, ''),
    },
  };
}

// Pas de fetch SSR vers l'API (évite blocage si API down) ; avis = client dans ReviewsSection.
export default function HomePage() {
  return (
    <>
      <StructuredData platformReviews={[]} />
      <PremiumLandingPage />
    </>
  );
}
