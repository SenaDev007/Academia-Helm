/**
 * Page Modules
 */

import { Metadata } from 'next';
import ModulesPage from '@/components/public/ModulesPage';
import { generateSEOMetadata } from '@/lib/seo';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Modules - Fonctionnalités Complètes',
  description: "Découvrez les 9 modules d'Academia Helm : Élèves & Scolarité, Finances, Pédagogie, RH, Examens, Helm Connect, Vie Scolaire, Cantine et Paramètres.",
  keywords: ['modules gestion scolaire', 'fonctionnalités Academia Helm', 'administration scolaire', 'gestion financière école'],
  path: '/modules',
});

export default function Page() {
  return <ModulesPage />;
}

