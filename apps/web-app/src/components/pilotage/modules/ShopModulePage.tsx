/**
 * ============================================================================
 * MODULE BOUTIQUE & ÉCONOMAT - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { 
  Plus, Search, Activity, List, Package, Archive, QrCode, 
  Wallet, Box, Truck, Tag, Bookmark, Navigation, RotateCcw, 
  BarChart3, Settings
} from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';
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

type TabId = 
  | 'dashboard' 
  | 'catalog' 
  | 'products'
  | 'orders' 
  | 'pos'
  | 'payments'
  | 'inventory' 
  | 'suppliers' 
  | 'discounts'
  | 'kits'
  | 'pickups'
  | 'returns'
  | 'analysis' 
  | 'settings';

export default function ShopModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'dashboard', label: 'Vue d\'ensemble', icon: Activity },
    { id: 'catalog', label: 'Catalogue', icon: List },
    { id: 'products', label: 'Articles & Variantes', icon: Package },
    { id: 'orders', label: 'Commandes', icon: Archive },
    { id: 'pos', label: 'Ventes (POS)', icon: QrCode },
    { id: 'payments', label: 'Paiements & Wallet', icon: Wallet },
    { id: 'inventory', label: 'Stocks & Inventaires', icon: Box },
    { id: 'suppliers', label: 'Fournisseurs & Achats', icon: Truck },
    { id: 'discounts', label: 'Remises & Promos', icon: Tag },
    { id: 'kits', label: 'Kits Scolaires', icon: Bookmark },
    { id: 'pickups', label: 'Retraits & Livraisons', icon: Navigation },
    { id: 'returns', label: 'Retours & Échanges', icon: RotateCcw },
    { id: 'analysis', label: 'Rapports & Stats', icon: BarChart3 },
    { id: 'settings', label: 'Configuration', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <ShopDashboard />;
      case 'catalog': return <ShopCatalog />;
      case 'products': return <ShopProducts />;
      case 'orders': return <ShopOrders />;
      case 'pos': return <ShopPOS />;
      case 'payments': return <ShopPayments />;
      case 'inventory': return <ShopStocks />;
      case 'suppliers': return <ShopSuppliers />;
      case 'discounts': return <ShopDiscounts />;
      case 'kits': return <ShopKits />;
      case 'pickups': return <ShopPickups />;
      case 'returns': return <ShopReturns />;
      case 'analysis': return <ShopReports />;
      case 'settings': return <ShopSettings />;
      default: return <ShopDashboard />;
    }
  };

  return (
    <ModulePageLayout
      title="Boutique & Économat"
      subtitle={`${currentLevel?.label || ''} | ${currentYear?.name || ''}`}
      actions={
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Scanner ou rechercher..." 
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-navy-500 w-64 outline-none transition-all bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-navy-900/20">
            <Plus className="w-4 h-4" />
            <span>Nouveau</span>
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Navigation Tabs - Style Ultra Premium */}
        <div className="flex items-center space-x-1 bg-gray-100/80 p-1.5 rounded-[1.25rem] border border-gray-200/50 overflow-x-auto no-scrollbar shadow-inner backdrop-blur-sm sticky top-0 z-30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center space-x-2 px-5 py-3 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white text-navy-900 shadow-md border border-gray-100' 
                    : 'text-gray-400 hover:text-navy-600 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-navy-600' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="pb-12">
          {renderTabContent()}
        </div>
      </div>
    </ModulePageLayout>
  );
}
