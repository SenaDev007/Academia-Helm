/**
 * ============================================================================
 * APP CANTEEN PAGE — Point d'entrée Cantine
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10) : la page Cantine est désormais servie par
 * l'interface unifiée `ShopCanteenModulePage` (sidebar + feed type EduCast)
 * qui regroupe Boutique + Cantine dans une seule page. On transmet
 * `initialView='canteen:dashboard'` pour présélectionner le tableau de bord
 * Cantine à l'arrivée.
 * ============================================================================
 */

import ShopCanteenModulePage from '@/components/pilotage/modules/ShopCanteenModulePage';

export default function CanteenPage() {
  return <ShopCanteenModulePage initialView="canteen:dashboard" />;
}
