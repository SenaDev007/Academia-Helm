'use client';

/**
 * ============================================================================
 * PORTAIL SECRETAIRE — ACCUEIL (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du secrétaire (/app/secretaire). Le quotidien du
 * secrétariat est la SCOLARITÉ : l'accueil du portail est l'outil
 * Élèves & Scolarité (composant partagé StudentsModulePage — le même que
 * /app/students, zéro duplication), rendu dans le shell secrétaire
 * (AdminPortalShell, accent sky).
 *
 * Optimisé avec lazy loading — pattern identique à /app/students/page.tsx.
 * Client Component requis (Next 16 : `dynamic` + `ssr: false` interdit dans
 * les RSC).
 * ============================================================================
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

export default function SecretaryHomePage() {
  return <StudentsModulePage />;
}
