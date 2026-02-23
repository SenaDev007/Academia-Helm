/**
 * Page Sécurité
 */

import { Metadata } from 'next';
import SecuritePage from '@/components/public/SecuritePage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Sécurité & Conformité - Protection des Données',
  description: 'Academia Helm garantit la sécurité et la conformité de vos données scolaires. Mode offline, sauvegarde automatique, conformité RGPD et standards internationaux.',
  keywords: ['sécurité données scolaires', 'RGPD école', 'protection données élèves', 'conformité gestion scolaire'],
  path: '/securite',
});

export default function Page() {
  return <SecuritePage />;
}

