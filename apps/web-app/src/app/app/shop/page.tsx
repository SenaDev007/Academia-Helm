/**
 * ============================================================================
 * APP SHOP PAGE — Point d'entrée Boutique
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10) : la page Boutique est désormais servie par
 * l'interface unifiée `ShopCanteenModulePage` (sidebar + feed type EduCast)
 * qui regroupe Boutique + Cantine dans une seule page. On transmet
 * `initialView='shop:dashboard'` pour présélectionner la vue d'ensemble
 * Boutique à l'arrivée.
 * ============================================================================
 */

import ShopCanteenModulePage from '@/components/pilotage/modules/ShopCanteenModulePage';

export default function ShopPage() {
  return <ShopCanteenModulePage initialView="shop:dashboard" />;
}
