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

// ✅ Lazy load du composant lourd pour améliorer le temps de chargement initial
const StudentsModulePage = dynamic(
  () => import('@/components/pilotage/modules/StudentsModulePage'),
  {
    loading: () => <LoadingState message="Chargement du module Élèves..." />,
    ssr: false, // ✅ Désactiver SSR pour les composants lourds côté client
  }
);

export default function StudentsPage() {
  return <StudentsModulePage />;
}

