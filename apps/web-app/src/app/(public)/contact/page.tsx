/**
 * Page Contact
 */

import { Metadata } from 'next';
import ContactPage from '@/components/public/ContactPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Contact - Support Academia Helm',
  description: 'Contactez l\'équipe Academia Helm pour toute question, démonstration ou demande de devis. Support disponible pour les établissements scolaires en Afrique de l\'Ouest.',
  keywords: ['contact Academia Helm', 'support gestion scolaire', 'demande devis école'],
  path: '/contact',
});

export default function Page() {
  return <ContactPage />;
}

