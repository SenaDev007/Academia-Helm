/**
 * Page Tarification
 */

import type { Metadata } from 'next';
import TarificationPage from '@/components/public/TarificationPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Tarification',
  description:
    'Comprendre la tarification Academia Helm : modèle adapté aux établissements, transparence et modules complets pour le pilotage éducatif.',
  keywords: ['tarification école', 'coût plateforme scolaire', 'Academia Helm prix'],
  path: '/tarification',
});

export default function Page() {
  return <TarificationPage />;
}

