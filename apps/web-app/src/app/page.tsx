/**
 * Page d'accueil (Landing Page)
 * 
 * Landing page unique, longue, premium et orientée conversion
 * Toutes les sections sur une seule page (scroll vertical)
 */

import { Metadata } from 'next';
import CompleteLandingPage from '@/components/public/CompleteLandingPage';
import StructuredData from '@/components/public/StructuredData';

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
        url: '/images/logo-Academia Hub.png',
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
    images: ['/images/logo-Academia Hub.png'],
  },
  alternates: {
    canonical: '/',
  },
};

// Force dynamic rendering to avoid build timeouts
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <CompleteLandingPage />
    </>
  );
}

