'use client';

/**
 * ============================================================================
 * BOUTIQUE & CANTINE — Interface unifiée type YouTube
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10) : remplacement des deux pages séparées
 * (`ShopModulePage` + `CanteenModulePage`) par une interface unifiée type
 * YouTube/EduCast (sidebar + feed) qui regroupe Boutique et Cantine dans
 * une seule page. Les sous-composants existants (Shop*, Canteen*) sont
 * réutilisés tels quels — seule la coquille change.
 *
 * Structure :
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ Top bar: [☰] [Logo] [Search] [Nvelle Vente] [Nouveau Menu] [Avatar]
 *   ├────────────┬──────────────────────────────────────────────┤
 *   │ Sidebar    │ Main content area                             │
 *   │            │                                                │
 *   │ 🏠 Accueil │  Selon `activeView` :                           │
 *   │ ─ BOUTIQUE │   - 'home'            → HomeView (KPIs + cards) │
 *   │   📊 Stats │   - 'shop:*'          → Shop* sub-component      │
 *   │   📋 Catal.│   - 'canteen:*'       → Canteen* sub-component  │
 *   │   📦 Art.. │                                                │
 *   │   ...      │                                                │
 *   │ ─ CANTINE │                                                │
 *   │   📊 Tabl..│                                                │
 *   │   👩‍🍳 Menus │                                                │
 *   │   ...      │                                                │
 *   └────────────┴──────────────────────────────────────────────┘
 *
 * Routing : `/app/shop` et `/app/canteen` pointent tous les deux vers
 * cette page, avec un `initialView` différent pour présélectionner le
 * sous-module à afficher en premier (utile quand l'utilisateur arrive
 * depuis la sidebar qui garde les deux entrées).
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Home, Menu as MenuIcon, Search, Plus, ChefHat, ShoppingBag,
  Activity, List, Package, Archive, QrCode, Wallet, Box, Truck,
  Tag, Bookmark, Navigation, RotateCcw, BarChart3, Settings,
  LayoutDashboard, ClipboardCheck, Users, UtensilsCrossed,
  AlertTriangle, CreditCard, AlertCircle, ExternalLink,
  TrendingUp, X,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';

// Sous-composants Boutique
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

// Sous-composants Cantine
import CanteenDashboard from './canteen/CanteenDashboard';
import CanteenMenus from './canteen/CanteenMenus';
import CanteenEnrollments from './canteen/CanteenEnrollments';
import CanteenStudents from './canteen/CanteenStudents';
import CanteenAttendance from './canteen/CanteenAttendance';
import CanteenDiets from './canteen/CanteenDiets';
import CanteenPayments from './canteen/CanteenPayments';
import CanteenStocks from './canteen/CanteenStocks';
import CanteenSuppliers from './canteen/CanteenSuppliers';
import CanteenIncidents from './canteen/CanteenIncidents';
import CanteenReports from './canteen/CanteenReports';
import CanteenSettings from './canteen/CanteenSettings';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

interface ShopCanteenModulePageProps {
  /** Vue initiale présélectionnée. Ex: 'shop:dashboard' ou 'canteen:dashboard'. */
  initialView?: string;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  /** 'shop' pour Boutique, 'canteen' pour Cantine, 'home' pour l'accueil unifié. */
  group: 'home' | 'shop' | 'canteen';
}

interface ShopStats {
  totalProducts?: number;
  totalRevenueMonth?: number;
  totalSalesMonth?: number;
  lowStockAlerts?: number;
}

interface CanteenStats {
  enrolledStudents?: number;
  mealsToday?: number;
  stockAlerts?: number;
  hygieneScore?: string | number;
}

// ─────────────────────────────────────────────────────────────────────
// Sidebar config (groupée Boutique + Cantine)
// ─────────────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS: SidebarItem[] = [
  // ACCUEIL (vue unifiée)
  { id: 'home', label: 'Accueil', icon: Home, group: 'home' },

  // BOUTIQUE — 14 sous-modules
  { id: 'shop:dashboard', label: 'Vue d\'ensemble', icon: Activity, group: 'shop' },
  { id: 'shop:catalog', label: 'Catalogue', icon: List, group: 'shop' },
  { id: 'shop:products', label: 'Articles & Variantes', icon: Package, group: 'shop' },
  { id: 'shop:orders', label: 'Commandes', icon: Archive, group: 'shop' },
  { id: 'shop:pos', label: 'Ventes (POS)', icon: QrCode, group: 'shop' },
  { id: 'shop:payments', label: 'Paiements & Wallet', icon: Wallet, group: 'shop' },
  { id: 'shop:inventory', label: 'Stocks & Inventaires', icon: Box, group: 'shop' },
  { id: 'shop:suppliers', label: 'Fournisseurs & Achats', icon: Truck, group: 'shop' },
  { id: 'shop:discounts', label: 'Remises & Promos', icon: Tag, group: 'shop' },
  { id: 'shop:kits', label: 'Kits Scolaires', icon: Bookmark, group: 'shop' },
  { id: 'shop:pickups', label: 'Retraits & Livraisons', icon: Navigation, group: 'shop' },
  { id: 'shop:returns', label: 'Retours & Échanges', icon: RotateCcw, group: 'shop' },
  { id: 'shop:analysis', label: 'Rapports & Stats', icon: BarChart3, group: 'shop' },
  { id: 'shop:settings', label: 'Configuration', icon: Settings, group: 'shop' },

  // CANTINE — 12 sous-modules
  { id: 'canteen:dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, group: 'canteen' },
  { id: 'canteen:menus', label: 'Menus', icon: ChefHat, group: 'canteen' },
  { id: 'canteen:enrollments', label: 'Inscriptions', icon: ClipboardCheck, group: 'canteen' },
  { id: 'canteen:students', label: 'Élèves inscrits', icon: Users, group: 'canteen' },
  { id: 'canteen:attendance', label: 'Présences', icon: UtensilsCrossed, group: 'canteen' },
  { id: 'canteen:diets', label: 'Régimes & Allergies', icon: AlertTriangle, group: 'canteen' },
  { id: 'canteen:payments', label: 'Paiements', icon: CreditCard, group: 'canteen' },
  { id: 'canteen:stocks', label: 'Stocks', icon: Package, group: 'canteen' },
  { id: 'canteen:suppliers', label: 'Fournisseurs', icon: Truck, group: 'canteen' },
  { id: 'canteen:incidents', label: 'Incidents & Hygiène', icon: AlertCircle, group: 'canteen' },
  { id: 'canteen:reports', label: 'Rapports', icon: BarChart3, group: 'canteen' },
  { id: 'canteen:settings', label: 'Paramètres', icon: Settings, group: 'canteen' },
];

const GROUP_LABELS: Record<string, string> = {
  shop: 'Boutique',
  canteen: 'Cantine',
};

const GROUP_COLORS: Record<string, { active: string; text: string; dot: string }> = {
  home: { active: 'bg-slate-900 text-white', text: 'text-slate-700', dot: 'bg-slate-900' },
  shop: { active: 'bg-amber-50 text-amber-700', text: 'text-slate-700', dot: 'bg-amber-500' },
  canteen: { active: 'bg-emerald-50 text-emerald-700', text: 'text-slate-700', dot: 'bg-emerald-500' },
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500'];
function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────

export default function ShopCanteenModulePage({ initialView = 'home' }: ShopCanteenModulePageProps) {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const { user } = useAppSession();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<string>(initialView || 'home');
  const [searchQuery, setSearchQuery] = useState('');
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [canteenStats, setCanteenStats] = useState<CanteenStats | null>(null);

  // ── Chargement des KPIs Boutique + Cantine (vue d'accueil) ──
  useEffect(() => {
    if (academicYear?.id) {
      loadShopStats();
      loadCanteenStats();
    }
  }, [academicYear?.id]);

  const loadShopStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/shop/stats?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) setShopStats(await res.json());
    } catch (e) {
      console.error('Erreur chargement stats boutique:', e);
    }
  };

  const loadCanteenStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/canteen/dashboard?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) setCanteenStats(await res.json());
    } catch (e) {
      console.error('Erreur chargement stats cantine:', e);
    }
  };

  // ── Groupement des items par section pour la sidebar ──
  const groupedItems = useMemo(() => {
    const groups: Record<string, SidebarItem[]> = { home: [], shop: [], canteen: [] };
    for (const item of SIDEBAR_ITEMS) {
      groups[item.group].push(item);
    }
    return groups;
  }, []);

  // ── Filtrage par recherche ──
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return SIDEBAR_ITEMS;
    const q = searchQuery.toLowerCase();
    return SIDEBAR_ITEMS.filter(item => item.label.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredGroups = useMemo(() => {
    const groups: Record<string, SidebarItem[]> = { home: [], shop: [], canteen: [] };
    for (const item of filteredItems) {
      groups[item.group].push(item);
    }
    return groups;
  }, [filteredItems]);

  // ── Rendu du contenu principal selon activeView ──
  const renderMainContent = () => {
    if (contextLoading) {
      return (
        <div className="p-8 text-center text-slate-500">Chargement...</div>
      );
    }

    // Vue d'accueil unifiée
    if (activeView === 'home') {
      return (
        <HomeView
          shopStats={shopStats}
          canteenStats={canteenStats}
          onNavigate={setActiveView}
        />
      );
    }

    // Sous-modules Boutique
    switch (activeView) {
      case 'shop:dashboard': return <ShopDashboard />;
      case 'shop:catalog': return <ShopCatalog />;
      case 'shop:products': return <ShopProducts />;
      case 'shop:orders': return <ShopOrders />;
      case 'shop:pos': return <ShopPOS />;
      case 'shop:payments': return <ShopPayments />;
      case 'shop:inventory': return <ShopStocks />;
      case 'shop:suppliers': return <ShopSuppliers />;
      case 'shop:discounts': return <ShopDiscounts />;
      case 'shop:kits': return <ShopKits />;
      case 'shop:pickups': return <ShopPickups />;
      case 'shop:returns': return <ShopReturns />;
      case 'shop:analysis': return <ShopReports />;
      case 'shop:settings': return <ShopSettings />;

      // Sous-modules Cantine
      case 'canteen:dashboard': return <CanteenDashboard />;
      case 'canteen:menus': return <CanteenMenus />;
      case 'canteen:enrollments': return <CanteenEnrollments />;
      case 'canteen:students': return <CanteenStudents />;
      case 'canteen:attendance': return <CanteenAttendance />;
      case 'canteen:diets': return <CanteenDiets />;
      case 'canteen:payments': return <CanteenPayments />;
      case 'canteen:stocks': return <CanteenStocks />;
      case 'canteen:suppliers': return <CanteenSuppliers />;
      case 'canteen:incidents': return <CanteenIncidents />;
      case 'canteen:reports': return <CanteenReports />;
      case 'canteen:settings': return <CanteenSettings />;

      default: return <HomeView shopStats={shopStats} canteenStats={canteenStats} onNavigate={setActiveView} />;
    }
  };

  const currentView = SIDEBAR_ITEMS.find(i => i.id === activeView);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* ═════════ TOP BAR ═════════ */}
      <div className="flex items-center gap-4 px-4 h-14 border-b border-slate-200 bg-white sticky top-0 z-50">
        {/* Hamburger menu */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-full hover:bg-slate-100"
          title="Afficher/Masquer la sidebar"
        >
          {sidebarOpen ? <X className="w-5 h-5 text-slate-700" /> : <MenuIcon className="w-5 h-5 text-slate-700" />}
        </button>

        {/* Logo combiné Boutique + Cantine */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-bold text-slate-900">Boutique</span>
            <span className="text-slate-300 mx-1">+</span>
            <span className="text-lg font-bold text-slate-900">Cantine</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un module (catalogue, menus, stocks, fournisseurs...)"
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/30"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Quick actions — Boutique + Cantine */}
        <button
          onClick={() => setActiveView('shop:pos')}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-full text-sm font-bold hover:bg-amber-700"
          title="Ouvrir le point de vente Boutique"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:block">Nouvelle Vente</span>
        </button>
        <button
          onClick={() => setActiveView('canteen:menus')}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700"
          title="Planifier un nouveau menu Cantine"
        >
          <ChefHat className="w-4 h-4" />
          <span className="hidden sm:block">Nouveau Menu</span>
        </button>

        {/* User avatar */}
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getAvatarColor(user?.firstName || user?.email || 'U'))}>
          {getInitials(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'U')}
        </div>
      </div>

      {/* ═════════ MAIN LAYOUT ═════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═════════ SIDEBAR ═════════ */}
        {sidebarOpen && (
          <div className="w-60 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-white">
            <div className="py-2">
              {/* ACCUEIL (vue unifiée) */}
              {filteredGroups.home.length > 0 && (
                <div className="mb-2">
                  {filteredGroups.home.map(item => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      onClick={() => setActiveView(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* BOUTIQUE group */}
              {filteredGroups.shop.length > 0 && (
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="px-4 py-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Boutique & Économat
                  </div>
                  {filteredGroups.shop.map(item => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      onClick={() => setActiveView(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* CANTINE group */}
              {filteredGroups.canteen.length > 0 && (
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="px-4 py-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Cantine & Restauration
                  </div>
                  {filteredGroups.canteen.map(item => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      onClick={() => setActiveView(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Empty search results */}
              {filteredItems.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Aucun module ne correspond à « {searchQuery} »
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════ MAIN CONTENT AREA ═════════ */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {/* Fil d'ariane compact si on n'est pas sur l'accueil */}
          {activeView !== 'home' && currentView && (
            <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center gap-2 text-xs text-slate-500">
              <button
                onClick={() => setActiveView('home')}
                className="hover:text-slate-900 font-medium"
              >
                Accueil
              </button>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">
                {GROUP_LABELS[currentView.group]}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-slate-900">{currentView.label}</span>
            </div>
          )}

          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sidebar Button
// ─────────────────────────────────────────────────────────────────────

function SidebarButton({
  item, isActive, onClick,
}: {
  item: SidebarItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const colors = GROUP_COLORS[item.group];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        isActive
          ? cn('font-bold', colors.active)
          : cn('hover:bg-slate-50', colors.text),
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HOME VIEW — Vue d'accueil unifiée Boutique + Cantine
// ─────────────────────────────────────────────────────────────────────

function HomeView({
  shopStats, canteenStats, onNavigate,
}: {
  shopStats: ShopStats | null;
  canteenStats: CanteenStats | null;
  onNavigate: (view: string) => void;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          Boutique <span className="text-slate-300">+</span> Cantine
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Vue d'ensemble unifiée des ventes, stocks, repas et inscriptions.
          Naviguez d'un module à l'autre via la sidebar à gauche.
        </p>
      </div>

      {/* KPIs globaux ( Boutique + Cantine ) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Produits actifs"
          value={String(shopStats?.totalProducts ?? 0)}
          icon={Package}
          color="amber"
          trend={null}
          onClick={() => onNavigate('shop:products')}
        />
        <KpiCard
          label="Recette Boutique (30j)"
          value={formatCurrency(shopStats?.totalRevenueMonth ?? 0)}
          icon={TrendingUp}
          color="amber"
          trend="up"
          onClick={() => onNavigate('shop:analysis')}
        />
        <KpiCard
          label="Élèves inscrits Cantine"
          value={String(canteenStats?.enrolledStudents ?? 0)}
          icon={Users}
          color="emerald"
          trend="up"
          onClick={() => onNavigate('canteen:students')}
        />
        <KpiCard
          label="Repas aujourd'hui"
          value={String(canteenStats?.mealsToday ?? 0)}
          icon={UtensilsCrossed}
          color="emerald"
          trend={null}
          onClick={() => onNavigate('canteen:attendance')}
        />
      </div>

      {/* Deux colonnes : Boutique + Cantine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Colonne Boutique ── */}
        <ModuleSectionCard
          title="Boutique & Économat"
          description="Gestion des ventes, stocks, fournisseurs, kits scolaires et lien direct avec les encaissements du module Finance."
          accentColor="amber"
          accentIcon={ShoppingBag}
          stats={[
            { label: 'Ventes (30j)', value: String(shopStats?.totalSalesMonth ?? 0) },
            { label: 'Alertes stock', value: String(shopStats?.lowStockAlerts ?? 0) },
          ]}
          quickActions={[
            { label: 'Nouvelle Vente', icon: Plus, view: 'shop:pos', primary: true },
            { label: 'Catalogue', icon: List, view: 'shop:catalog' },
            { label: 'Commandes', icon: Archive, view: 'shop:orders' },
            { label: 'Stocks', icon: Box, view: 'shop:inventory' },
            { label: 'Fournisseurs', icon: Truck, view: 'shop:suppliers' },
            { label: 'Kits Scolaires', icon: Bookmark, view: 'shop:kits' },
            { label: 'Rapports', icon: BarChart3, view: 'shop:analysis' },
          ]}
          onNavigate={onNavigate}
          externalLink={{ href: '/app/finance/payments', label: 'Encaissements Finance' }}
        />

        {/* ── Colonne Cantine ── */}
        <ModuleSectionCard
          title="Cantine & Restauration"
          description="Gestion complète de la restauration scolaire : menus, inscriptions, présences, régimes & allergies, paiements, stocks, fournisseurs, incidents hygiène et rapports."
          accentColor="emerald"
          accentIcon={UtensilsCrossed}
          stats={[
            { label: 'Alertes stock', value: String(canteenStats?.stockAlerts ?? 0) },
            { label: 'Score hygiène', value: String(canteenStats?.hygieneScore ?? '—') },
          ]}
          quickActions={[
            { label: 'Nouveau Menu', icon: ChefHat, view: 'canteen:menus', primary: true },
            { label: 'Inscriptions', icon: ClipboardCheck, view: 'canteen:enrollments' },
            { label: 'Présences', icon: UtensilsCrossed, view: 'canteen:attendance' },
            { label: 'Régimes & Allergies', icon: AlertTriangle, view: 'canteen:diets' },
            { label: 'Paiements', icon: CreditCard, view: 'canteen:payments' },
            { label: 'Incidents', icon: AlertCircle, view: 'canteen:incidents' },
            { label: 'Rapports', icon: BarChart3, view: 'canteen:reports' },
          ]}
          onNavigate={onNavigate}
        />
      </div>

      {/* Paramètres communs en bas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('shop:settings')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Configuration Boutique</p>
            <p className="text-xs text-slate-500">Catégories, TVA, moyens de paiement, imprimantes</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate('canteen:settings')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Settings className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Paramètres Cantine</p>
            <p className="text-xs text-slate-500">Tarifs repas, allergies, fournisseurs, hygiène</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// KPI CARD — Petite carte KPI cliquable
// ─────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, trend, onClick,
}: {
  label: string;
  value: string;
  icon: any;
  color: 'amber' | 'emerald';
  trend: 'up' | 'down' | null;
  onClick?: () => void;
}) {
  const colorClasses = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'hover:border-amber-300' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'hover:border-emerald-300' },
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 transition text-left',
        colorClasses.ring,
      )}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorClasses.bg)}>
        <Icon className={cn('w-5 h-5', colorClasses.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-lg font-black text-slate-900 truncate">{value}</p>
      </div>
      {trend === 'up' && (
        <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
          <TrendingUp className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MODULE SECTION CARD — Carte résumé d'un module (Boutique ou Cantine)
// ─────────────────────────────────────────────────────────────────────

function ModuleSectionCard({
  title, description, accentColor, accentIcon: AccentIcon, stats, quickActions, onNavigate, externalLink,
}: {
  title: string;
  description: string;
  accentColor: 'amber' | 'emerald';
  accentIcon: any;
  stats: { label: string; value: string }[];
  quickActions: { label: string; icon: any; view: string; primary?: boolean }[];
  onNavigate: (view: string) => void;
  externalLink?: { href: string; label: string };
}) {
  const colorClasses = {
    amber: {
      gradient: 'from-amber-500 to-orange-500',
      chip: 'bg-amber-50 text-amber-700',
      btn: 'bg-amber-600 hover:bg-amber-700',
      btnLight: 'border-amber-200 text-amber-700 hover:bg-amber-50',
    },
    emerald: {
      gradient: 'from-emerald-500 to-teal-500',
      chip: 'bg-emerald-50 text-emerald-700',
      btn: 'bg-emerald-600 hover:bg-emerald-700',
      btnLight: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    },
  }[accentColor];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Bandeau d'en-tête avec dégradé */}
      <div className={cn('p-5 bg-gradient-to-r text-white', colorClasses.gradient)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <AccentIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">{title}</h3>
              <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{description}</p>
            </div>
          </div>
        </div>

        {/* Stats inline */}
        <div className="flex gap-4 mt-4">
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">{s.label}</p>
              <p className="text-xl font-black">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickActions.map(action => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition border',
                  action.primary
                    ? cn('text-white border-transparent shadow-sm', colorClasses.btn)
                    : cn('bg-white', colorClasses.btnLight),
                )}
              >
                <ActionIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Lien externe (Finance pour Boutique) */}
        {externalLink && (
          <a
            href={externalLink.href}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {externalLink.label}
          </a>
        )}
      </div>
    </div>
  );
}
