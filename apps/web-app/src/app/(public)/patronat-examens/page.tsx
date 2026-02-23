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
  title: 'Patronat & Examens Nationaux - Academia Helm',
  description: 'Plateforme institutionnelle pour l\'organisation des examens des écoles privées. Centralisez les inscriptions, sécurisez les données et pilotez les examens nationaux avec rigueur.',
  keywords: [
    'patronat écoles privées',
    'organisation examens nationaux',
    'gestion examens CEP BEPC',
    'plateforme examens institutionnelle',
    'inscription candidats examens',
    'banque épreuves partagée',
    'relevés notes sécurisés',
    'Academia Helm patronat',
  ],
  openGraph: {
    title: 'Patronat & Examens Nationaux - Academia Helm',
    description: 'Plateforme institutionnelle pour l\'organisation des examens des écoles privées.',
    url: '/patronat-examens',
    siteName: 'Academia Helm',
    images: [
      {
        url: '/images/logo-Academia Hub.png',
        width: 1200,
        height: 630,
        alt: 'Academia Helm - Patronat & Examens',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Patronat & Examens Nationaux - Academia Helm',
    description: 'Plateforme institutionnelle pour l\'organisation des examens des écoles privées.',
    images: ['/images/logo-Academia Hub.png'],
  },
  alternates: {
    canonical: '/patronat-examens',
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

