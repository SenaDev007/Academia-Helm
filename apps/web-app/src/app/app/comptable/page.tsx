'use client';

/**
 * ============================================================================
 * PORTAIL COMPTABLE — TABLEAU DE BORD (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du comptable (/app/comptable). Rend le tableau de
 * bord financier de l'établissement (FinanceDashboardV2 — KPIs encaissements,
 * recouvrement par niveau et par classe, composant partagé — le même que
 * /app/finance) dans le shell comptable (AdminPortalShell, accent teal).
 * Le module complet « Finances & Économat » (sous-navigation frais, dépenses,
 * trésorerie, audit…) reste accessible depuis la sidebar du portail.
 *
 * Optimisé avec lazy loading — pattern identique à /app/students/page.tsx.
 * Client Component requis (Next 16 : `dynamic` + `ssr: false` interdit dans
 * les RSC).
 * ============================================================================
 */

import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/feedback/LoadingState';

// ✅ Lazy load du composant lourd pour améliorer le temps de chargement initial
const FinanceDashboardV2 = dynamic(
  () => import('@/components/finance/FinanceDashboardV2'),
  {
    loading: () => <LoadingState message="Chargement du tableau de bord financier..." />,
    ssr: false, // ✅ Désactiver SSR pour les composants lourds côté client
  }
);

export default function AccountantHomePage() {
  return <FinanceDashboardV2 />;
}
