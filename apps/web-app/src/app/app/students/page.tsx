'use client';

/**
 * ============================================================================
 * APP STUDENTS PAGE
 * ============================================================================
 *
 * ✅ Optimisé avec lazy loading pour performance
 * Client Component requis (Next 16 : `dynamic` + `ssr: false` interdit dans les RSC).
 */

import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
// ⭐ P4-final : message de chargement bilingue (piste EN → anglais)
import { pickLabel } from '@/lib/i18n/bilingual';

// ✅ Lazy load du composant lourd pour améliorer le temps de chargement initial
const StudentsModulePage = dynamic(
  () => import('@/components/pilotage/modules/StudentsModulePage'),
  {
    loading: () => <LoadingState message={pickLabel(typeof window !== 'undefined' ? localStorage.getItem('academia_helm_locale') : 'fr', "Chargement du module Élèves...", "Loading Students module...")} />,
    ssr: false, // ✅ Désactiver SSR pour les composants lourds côté client
  }
);

export default function StudentsPage() {
  return <StudentsModulePage />;
}

