/**
 * Landing Page Institutionnelle - Patronat & Examens
 * 
 * Landing page dédiée pour les patronats d'écoles privées,
 * associations départementales et organismes organisateurs d'examens.
 * Design institutionnel, premium et sobre.
 */

import { Metadata } from 'next';
import PatronatExamensLanding from '@/components/public/PatronatExamensLanding';
import StructuredData from '@/components/public/StructuredData';

export const metadata: Metadata = {
  title: 'Academia Federis - Fédérer les écoles, Organiser les examens',
  description: 'La plateforme de gouvernance, d\'examens et de pilotage des réseaux scolaires privés. Centralisez la gestion des écoles membres et l\'organisation des examens inter-écoles.',
  keywords: [
    'Academia Federis',
    'patronat écoles privées',
    'organisation examens inter-écoles',
    'gouvernance scolaire',
    'fédération éducation',
    'pilote performance scolaire',
    'Academia Helm federis',
  ],
  openGraph: {
    title: 'Academia Federis - Gouvernance & Examens',
    description: 'La plateforme SaaS dédiée aux patronats scolaires privés.',
    url: '/federis',
    siteName: 'Academia Helm',
    images: [
      {
        url: '/images/logo-Academia Hub.png',
        width: 1200,
        height: 630,
        alt: 'Academia Federis - by Academia Helm',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academia Federis - Gouvernance & Examens',
    description: 'La plateforme SaaS dédiée aux patronats scolaires privés.',
    images: ['/images/logo-Academia Hub.png'],
  },
  alternates: {
    canonical: '/federis',
  },
};

export default function PatronatExamensPage() {
  return (
    <>
      <StructuredData />
      <PatronatExamensLanding />
    </>
  );
}

