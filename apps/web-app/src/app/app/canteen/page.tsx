/**
 * ============================================================================
 * APP CANTEEN PAGE — Cantine (uniquement)
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10 v2) : la page Cantine est servie par
 * ShopCanteenModulePage avec `mode='canteen'`. La sidebar ne contient QUE
 * les 12 sous-modules Cantine. Le HomeView ne montre QUE les KPIs et
 * cartes Cantine. Aucun mélange avec Boutique.
 *
 * Toutes les données proviennent du backend (pas de mock).
 * Endpoint : /api/modules-complementaires/canteen/dashboard
 * ============================================================================
 */

import ShopCanteenModulePage from '@/components/pilotage/modules/ShopCanteenModulePage';

export default function CanteenPage() {
  return <ShopCanteenModulePage mode="canteen" initialView="canteen:dashboard" />;
}
