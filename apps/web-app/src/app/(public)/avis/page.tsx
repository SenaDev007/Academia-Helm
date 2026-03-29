import type { Metadata } from 'next';
import AvisPageClient from '@/components/public/AvisPageClient';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Laisser un avis',
  description:
    'Partagez votre expérience avec Academia Helm : note, commentaire et modération avant publication.',
  keywords: [
    'avis Academia Helm',
    'retour établissement scolaire',
    'témoignage logiciel école',
  ],
  path: '/avis',
});

export default function Page() {
  return <AvisPageClient />;
}
