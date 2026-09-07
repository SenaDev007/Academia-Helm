'use client';

/**
 * ============================================================================
 * PORTAIL SECRETAIRE — ACCUEIL (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du secrétaire (/app/secretaire). ⭐ FIX 2026-09-07
 * (demande promoteur) : le TABLEAU DE BORD s'affiche par défaut à l'arrivée
 * dans le portail (PilotageDashboardV2 — le même tableau de bord de pilotage
 * unifié que /app : KPIs effectifs/finances/pédagogie, graphiques, alertes
 * ORION). L'outil quotidien « Élèves & Scolarité » (StudentsModulePage — le
 * même que /app/students) reste le module n°2 de la sidebar, à un clic.
 *
 * Optimisé avec lazy loading — pattern identique à /app/students/page.tsx.
 * Client Component requis (Next 16 : `dynamic` + `ssr: false` interdit dans
 * les RSC).
 * ============================================================================
 */

import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/feedback/LoadingState';

// ✅ Lazy load du composant lourd pour améliorer le temps de chargement initial
const PilotageDashboardV2 = dynamic(
  () => import('@/components/pilotage/dashboards/PilotageDashboardV2'),
  {
    loading: () => <LoadingState message="Chargement du tableau de bord..." />,
    ssr: false, // ✅ Désactiver SSR pour les composants lourds côté client
  }
);

export default function SecretaryHomePage() {
  return <PilotageDashboardV2 />;
}
