/**
 * ============================================================================
 * APP SHOP PAGE — Boutique (uniquement)
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10 v2) : la page Boutique est servie par
 * ShopCanteenModulePage avec `mode='shop'`. La sidebar ne contient QUE
 * les 14 sous-modules Boutique. Le HomeView ne montre QUE les KPIs et
 * cartes Boutique. Aucun mélange avec Cantine.
 *
 * Toutes les données proviennent du backend (pas de mock).
 * Endpoint : /api/modules-complementaires/shop/stats
 * ============================================================================
 */

import ShopCanteenModulePage from '@/components/pilotage/modules/ShopCanteenModulePage';

export default function ShopPage() {
  return <ShopCanteenModulePage mode="shop" initialView="shop:dashboard" />;
}
