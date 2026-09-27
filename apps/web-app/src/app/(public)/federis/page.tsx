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
    title: 'Academia Federis — La plateforme des patronats scolaires et des examens',
    description:
      "Academia Federis aide les patronats scolaires à coordonner leurs écoles membres et à organiser les examens nationaux : inscriptions, centres, surveillance et résultats.",
    keywords: [
      'Academia Federis',
      'patronat scolaire',
      'patronat écoles privées',
      'examens nationaux',
      'examens inter-écoles',
      'centres de composition',
      'coordination écoles membres',
      'Academia Helm',
    ],
    openGraph: {
      title: 'Academia Federis — La plateforme des patronats scolaires et des examens',
      description:
        'Organisez les sessions d’examen de votre patronat dans un espace dédié. Découvrez Academia Federis, par Academia Helm.',
      url: 'https://www.academiahelm.com/federis',
      siteName: 'Academia Helm',
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: 'Academia Federis — par Academia Helm',
          type: 'image/jpeg',
        },
      ],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Academia Federis — La plateforme des patronats scolaires et des examens',
      description:
        'Organisez les sessions d’examen de votre patronat dans un espace dédié. Découvrez Academia Federis, par Academia Helm.',
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
