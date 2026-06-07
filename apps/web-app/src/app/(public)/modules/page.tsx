/**
 * Page Modules
 */

import { Metadata } from 'next';
import ModulesPage from '@/components/public/ModulesPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Modules - Fonctionnalités Complètes',
  description: 'Découvrez tous les modules d\'Academia Helm : Administration, Finances, Pédagogie, RH, ORION (IA) et bien plus. Une solution complète pour la gestion scolaire.',
  keywords: ['modules gestion scolaire', 'fonctionnalités Academia Helm', 'administration scolaire', 'gestion financière école'],
  path: '/modules',
});

export default function Page() {
  return <ModulesPage />;
}

