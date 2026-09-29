'use client';

/**
 * ============================================================================
 * PORTAIL SECRETAIRE-COMPTABLE — ACCUEIL (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du secrétaire-comptable (/app/secretaire-comptable).
 * ⭐ FIX 2026-09-07 (demande promoteur) : le TABLEAU DE BORD s'affiche par
 * défaut à l'arrivée dans le portail — plus l'outil Encaissements directement.
 * On rend PilotageDashboardV2 (tableau de bord de pilotage unifié — le même
 * que /app : KPIs transverses élèves/finances/pédagogie/RH), cohérent avec
 * l'union des deux métiers (secrétariat + comptabilité). L'outil quotidien
 * « Encaissements » (TransactionsContent — le même que /app/finance/payments)
 * reste le module n°2 de la sidebar, à un clic.
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

export default function SecretaryAccountantHomePage() {
  return <PilotageDashboardV2 />;
}
