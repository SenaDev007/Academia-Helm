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
import { buildAbsoluteOGImageUrl, detectRequestHostname } from '@/lib/seo';

/**
 * generateMetadata — URLs OG absolues requises par les crawlers sociaux.
 * Federis est sur le sous-domaine réservé academiafederis.academiahelm.com
 * mais les URLs OG doivent pointer vers www.academiahelm.com (domaine public canonique).
 */
export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();
  const ogImageAbsolute = buildAbsoluteOGImageUrl(hostname);

  return {
    title: 'Academia Federis - Fédérer les écoles, Organiser les examens',
    description: "La plateforme de gouvernance, d'examens et de pilotage des réseaux scolaires privés. Centralisez la gestion des écoles membres et l'organisation des examens inter-écoles.",
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
      url: 'https://www.academiahelm.com/federis',
      siteName: 'Academia Helm',
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: 'Academia Federis - by Academia Helm',
          type: 'image/jpeg',
        },
      ],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Academia Federis - Gouvernance & Examens',
      description: 'La plateforme SaaS dédiée aux patronats scolaires privés.',
      images: [ogImageAbsolute],
    },
    alternates: {
      canonical: 'https://www.academiahelm.com/federis',
    },
  };
}

export default function PatronatExamensPage() {
  return (
    <>
      <StructuredData />
      <PatronatExamensLanding />
    </>
  );
}
