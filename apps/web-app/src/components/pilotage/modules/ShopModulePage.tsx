/**
 * ============================================================================
 * MODULE BOUTIQUE & ÉCONOMAT - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern ModuleContainer (comme
 * FinanceModulePage / StudentsModulePage) pour uniformiser le design à travers
 * tous les modules. Avant, ce module utilisait ModulePageLayout (obsolète) avec
 * des onglets pills custom navy-900/uppercase — désormais il utilise
 * ModuleContainer + SubModuleNavigation standard.
 *
 * Sous-modules :
 *   1. Vue d'ensemble (dashboard)
 *   2. Catalogue
 *   3. Articles & Variantes (products)
 *   4. Commandes (orders)
 *   5. Ventes POS (pos)
 *   6. Paiements & Wallet (payments)
 *   7. Stocks & Inventaires (inventory)
 *   8. Fournisseurs & Achats (suppliers)
 *   9. Remises & Promos (discounts)
 *  10. Kits Scolaires (kits)
 *  11. Retraits & Livraisons (pickups)
 *  12. Retours & Échanges (returns)
 *  13. Rapports & Stats (analysis)
 *  14. Configuration (settings)
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Activity, List, Package, Archive, QrCode,
  Wallet, Box, Truck, Tag, Bookmark, Navigation, RotateCcw,
  BarChart3, Settings, CreditCard, ExternalLink, Plus, Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatCurrency } from '@/lib/utils';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern FinanceModulePage)
import ShopDashboard from './shop/ShopDashboard';
import ShopCatalog from './shop/ShopCatalog';
import ShopProducts from './shop/ShopProducts';
import ShopOrders from './shop/ShopOrders';
import ShopPOS from './shop/ShopPOS';
import ShopPayments from './shop/ShopPayments';
import ShopStocks from './shop/ShopStocks';
import ShopSuppliers from './shop/ShopSuppliers';
import ShopDiscounts from './shop/ShopDiscounts';
import ShopKits from './shop/ShopKits';
import ShopPickups from './shop/ShopPickups';
import ShopReturns from './shop/ShopReturns';
import ShopReports from './shop/ShopReports';
import ShopSettings from './shop/ShopSettings';

export default function ShopModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  // Charger les stats boutique pour les KPIs du header
  useEffect(() => {
    if (academicYear?.id) {
      loadShopStats();
    }
  }, [academicYear?.id]);

  const loadShopStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/shop/stats?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Erreur chargement stats boutique:', e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Boutique & Économat',
        description:
          'Gestion des ventes, stocks, fournisseurs, kits scolaires et lien direct avec les encaissements du module Finance',
        icon: 'package',
        kpis: stats
          ? [
              {
                label: 'Produits actifs',
                value: String(stats.totalProducts ?? 0),
                icon: 'package',
                trend: 'neutral',
              },
              {
                label: "Recette (30j)",
                value: formatCurrency(stats.totalRevenueMonth ?? 0),
                icon: 'trendingUp',
                trend: 'up',
              },
              {
                label: 'Ventes (30j)',
                value: String(stats.totalSalesMonth ?? 0),
                icon: 'shoppingCart',
                trend: 'up',
              },
              {
                label: 'Alertes stock',
                value: String(stats.lowStockAlerts ?? 0),
                icon: 'alertCircle',
                trend: stats.lowStockAlerts > 0 ? 'up' : 'neutral',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            {/* Lien direct vers le module Finance (encaissements) — multi-action */}
            <a
              href="/app/finance/payments"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all"
              title="Aller aux encaissements du module Finance (multi-action : frais + boutique)"
            >
              <CreditCard className="w-4 h-4" /> Encaissements
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
            <button
              onClick={() => setActiveSubModuleId('pos')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all"
              title="Ouvrir le point de vente"
            >
              <Plus className="w-4 h-4" /> Nouvelle vente
            </button>
            <button
              onClick={() => setActiveSubModuleId('analysis')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              title="Rapports & statistiques"
            >
              <Download className="w-4 h-4" /> Rapports
            </button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Vue d\'ensemble', icon: <Activity className="w-4 h-4" /> },
          { id: 'catalog', label: 'Catalogue', icon: <List className="w-4 h-4" /> },
          { id: 'products', label: 'Articles & Variantes', icon: <Package className="w-4 h-4" /> },
          { id: 'orders', label: 'Commandes', icon: <Archive className="w-4 h-4" /> },
          { id: 'pos', label: 'Ventes (POS)', icon: <QrCode className="w-4 h-4" /> },
          { id: 'payments', label: 'Paiements & Wallet', icon: <Wallet className="w-4 h-4" /> },
          { id: 'inventory', label: 'Stocks & Inventaires', icon: <Box className="w-4 h-4" /> },
          { id: 'suppliers', label: 'Fournisseurs & Achats', icon: <Truck className="w-4 h-4" /> },
          { id: 'discounts', label: 'Remises & Promos', icon: <Tag className="w-4 h-4" /> },
          { id: 'kits', label: 'Kits Scolaires', icon: <Bookmark className="w-4 h-4" /> },
          { id: 'pickups', label: 'Retraits & Livraisons', icon: <Navigation className="w-4 h-4" /> },
          { id: 'returns', label: 'Retours & Échanges', icon: <RotateCcw className="w-4 h-4" /> },
          { id: 'analysis', label: 'Rapports & Stats', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'settings', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <ShopDashboard /> } :
        activeSubModuleId === 'catalog' ? { layout: 'default', children: <ShopCatalog /> } :
        activeSubModuleId === 'products' ? { layout: 'default', children: <ShopProducts /> } :
        activeSubModuleId === 'orders' ? { layout: 'default', children: <ShopOrders /> } :
        activeSubModuleId === 'pos' ? { layout: 'default', children: <ShopPOS /> } :
        activeSubModuleId === 'payments' ? { layout: 'default', children: <ShopPayments /> } :
        activeSubModuleId === 'inventory' ? { layout: 'default', children: <ShopStocks /> } :
        activeSubModuleId === 'suppliers' ? { layout: 'default', children: <ShopSuppliers /> } :
        activeSubModuleId === 'discounts' ? { layout: 'default', children: <ShopDiscounts /> } :
        activeSubModuleId === 'kits' ? { layout: 'default', children: <ShopKits /> } :
        activeSubModuleId === 'pickups' ? { layout: 'default', children: <ShopPickups /> } :
        activeSubModuleId === 'returns' ? { layout: 'default', children: <ShopReturns /> } :
        activeSubModuleId === 'analysis' ? { layout: 'default', children: <ShopReports /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <ShopSettings /> } :
        { layout: 'default', children: <ShopDashboard /> }
      }
    />
  );
}
