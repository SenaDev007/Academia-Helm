/**
 * Testimonials Page
 * 
 * Page publique dédiée aux témoignages
 */

import type { Metadata } from 'next';
import TestimonialsPage from '@/components/public/TestimonialsPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Témoignages',
  description:
    'Retours d’établissements sur Academia Helm : pilotage, finances, pédagogie et IA ORION au service des équipes.',
  keywords: ['témoignages Academia Helm', 'avis logiciel école', 'retour client éducation'],
  path: '/testimonials',
});

export default function Page() {
  return <TestimonialsPage />;
}

