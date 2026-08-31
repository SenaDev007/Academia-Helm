'use client';

/**
 * ============================================================================
 * BOUTIQUE OU CANTINE — Interface unifiée type YouTube (sidebar + feed)
 * ============================================================================
 *
 * Refonte août 2026 (Issue #10 v2) :
 * La page sidebar+feed (pattern EduCast) sert DÉSORMAIS un seul module à la
 * fois, déterminé par le prop `mode` :
 *   - mode='shop'    → affiche UNIQUEMENT les 14 sous-modules Boutique
 *   - mode='canteen' → affiche UNIQUEMENT les 12 sous-modules Cantine
 *
 * ❌ Aucune donnée mock : toutes les stats proviennent des vrais endpoints
 *    backend `/api/modules-complementaires/shop/stats` (Boutique) ou
 *    `/api/modules-complementaires/canteen/dashboard` (Cantine).
 *
 * ❌ Aucun mélange Boutique ↔ Cantine : la sidebar ne contient QUE les items
 *    du module actif. Le HomeView ne montre QUE les KPIs et cartes du module
 *    actif. La top bar ne montre QUE le bouton d'action rapide du module actif.
 *
 * Structure :
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ Top bar: [☰] [Logo mono-couleur] [Search] [Action] [Avatar]│
 *   ├────────────┬──────────────────────────────────────────────┤
 *   │ Sidebar    │ Main content area                             │
 *   │            │                                                │
 *   │ 🏠 Accueil │  Selon `activeView` :                           │
 *   │ ─ MODULE  │   - 'home'           → HomeView (KPIs + cards) │
 *   │   📊 Stats │   - '<mode>:<sub>'  → Sous-composant           │
 *   │   ...      │                                                │
 *   └────────────┴──────────────────────────────────────────────┘
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

type ModuleMode = 'shop' | 'canteen';

interface ShopCanteenModulePageProps {
  /** Détermine QUEL module cette page sert. Aucun mélange Boutique ↔ Cantine. */
  mode: ModuleMode;
  /** Vue initiale présélectionnée (ex: 'shop:dashboard' ou 'canteen:menus'). Si omis, utilise '<mode>:dashboard'. */
  initialView?: string;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  /** 'home' pour l'accueil du module, sinon identique au mode actif. */
  group: 'home' | ModuleMode;
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
// Sidebar config — Boutique ET Cantine declarés, MAIS filtrés par `mode`
// ─────────────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS: SidebarItem[] = [
  // ACCUEIL du module (vue d'ensemble)
  { id: 'home', label: 'Accueil', icon: Home, group: 'home' },

  // BOUTIQUE — 14 sous-modules
  { id: 'shop:dashboard', label: 'Vue d\'ensemble', icon: Activity, group: 'shop' },
  { id: 'shop:catalog', label: 'Catalogue', icon: List, group: 'shop' },
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

// ─────────────────────────────────────────────────────────────────────
// Config par mode — couleur, libellé, logo, action rapide
// ─────────────────────────────────────────────────────────────────────

interface ModeConfig {
  /** Label humain du module. */
  label: string;
  /** Description courte affichée dans le HomeView. */
  description: string;
  /** Couleur d'accent (Tailwind). */
  accent: 'amber' | 'emerald';
  /** Classes Tailwind pour le logo de la top bar. */
  logoBg: string;
  /** Icône principale du module (rendue dans le logo). */
  logoIcon: any;
  /** Bouton d'action rapide (un seul par mode). */
  quickAction: { label: string; icon: any; view: string; btnClass: string };
  /** Endpoint backend pour récupérer les KPIs. */
  statsEndpoint: string;
  /** Libellé de la section dans la sidebar. */
  sidebarSectionLabel: string;
}

const MODE_CONFIG: Record<ModuleMode, ModeConfig> = {
  shop: {
    label: 'Academia Shop & Économat',
    description: 'Gestion des ventes, stocks, fournisseurs, kits scolaires et lien direct avec les encaissements du module Finance.',
    accent: 'amber',
    logoBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    logoIcon: ShoppingBag,
    quickAction: {
      label: 'Nouvelle Vente',
      icon: Plus,
      view: 'shop:pos',
      btnClass: 'bg-amber-600 text-white rounded-full text-sm font-bold hover:bg-amber-700',
    },
    statsEndpoint: '/api/modules-complementaires/shop/stats',
    sidebarSectionLabel: 'Academia Shop & Économat',
  },
  canteen: {
    label: 'Cantine & Restauration',
    description: 'Gestion complète de la restauration scolaire : menus, inscriptions, présences, régimes & allergies, paiements, stocks, fournisseurs, incidents hygiène et rapports.',
    accent: 'emerald',
    logoBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    logoIcon: UtensilsCrossed,
    quickAction: {
      label: 'Nouveau Menu',
      icon: ChefHat,
      view: 'canteen:menus',
      btnClass: 'bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700',
    },
    statsEndpoint: '/api/modules-complementaires/canteen/dashboard',
    sidebarSectionLabel: 'Cantine & Restauration',
  },
};

const ACCENT_COLOR_CLASSES: Record<'amber' | 'emerald', {
  text: string; dot: string; sidebarActive: string; sidebarHover: string;
}> = {
  amber: {
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    sidebarActive: 'bg-amber-50 text-amber-700 font-bold',
    sidebarHover: 'text-slate-700 hover:bg-slate-50',
  },
  emerald: {
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    sidebarActive: 'bg-emerald-50 text-emerald-700 font-bold',
    sidebarHover: 'text-slate-700 hover:bg-slate-50',
  },
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

export default function ShopCanteenModulePage({ mode, initialView }: ShopCanteenModulePageProps) {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const { user } = useAppSession();
  const config = MODE_CONFIG[mode];

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<string>(initialView || `${mode}:dashboard`);
  const [searchQuery, setSearchQuery] = useState('');
  // ⭐ Une seule source de stats — celle du module actif. Pas de mock.
  const [stats, setStats] = useState<ShopStats & CanteenStats | null>(null);

  // ── Chargement des KPIs du module actif (pas l'autre) ──
  useEffect(() => {
    if (academicYear?.id) {
      loadStats();
    }
  }, [academicYear?.id, mode]);

  const loadStats = async () => {
    try {
      const res = await fetch(
        `${config.statsEndpoint}?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error(`Erreur chargement stats ${mode}:`, e);
    }
  };

  // ── Items visibles dans la sidebar — STRICTEMENT filtrés par `mode`.
  //    Aucun item de l'autre module ne peut apparaître. ──
  const visibleItems = useMemo(() => {
    return SIDEBAR_ITEMS.filter(item =>
      item.group === 'home' || item.group === mode
    );
  }, [mode]);

  // ── Filtrage par recherche (parmi les items visibles du mode actif) ──
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return visibleItems;
    const q = searchQuery.toLowerCase();
    return visibleItems.filter(item => item.label.toLowerCase().includes(q));
  }, [visibleItems, searchQuery]);

  const filteredHome = filteredItems.filter(i => i.group === 'home');
  const filteredModule = filteredItems.filter(i => i.group === mode);

  // ── Rendu du contenu principal selon activeView ──
  const renderMainContent = () => {
    if (contextLoading) {
      return (
        <div className="p-8 text-center text-slate-500">Chargement...</div>
      );
    }

    // Vue d'accueil du module
    if (activeView === 'home') {
      return (
        <HomeView
          mode={mode}
          stats={stats}
          onNavigate={setActiveView}
        />
      );
    }

    // Sous-modules — STRICTEMENT du mode actif
    if (mode === 'shop') {
      switch (activeView) {
        case 'shop:dashboard': return <ShopDashboard />;
        case 'shop:catalog': return <ShopCatalog />;
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
        default: return <HomeView mode={mode} stats={stats} onNavigate={setActiveView} />;
      }
    }

    // mode === 'canteen'
    switch (activeView) {
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
      default: return <HomeView mode={mode} stats={stats} onNavigate={setActiveView} />;
    }
  };

  const currentView = SIDEBAR_ITEMS.find(i => i.id === activeView);
  const QuickActionIcon = config.quickAction.icon;
  const LogoIcon = config.logoIcon;
  const accentClasses = ACCENT_COLOR_CLASSES[config.accent];

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

        {/* Logo — couleur unique du module actif (pas de mélange) */}
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.logoBg)}>
            <LogoIcon className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:block text-lg font-bold text-slate-900">{config.label}</span>
        </div>

        {/* Search bar — limitée aux sous-modules du mode actif */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Rechercher dans ${config.label}...`}
              className={cn(
                'w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-sm outline-none focus:bg-white focus:ring-2',
                config.accent === 'amber' ? 'focus:ring-amber-500/30' : 'focus:ring-emerald-500/30',
              )}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Quick action — UN SEUL bouton (celui du module actif) */}
        <button
          onClick={() => setActiveView(config.quickAction.view)}
          className={cn('flex items-center gap-2 px-3 py-2', config.quickAction.btnClass)}
          title={config.quickAction.label}
        >
          <QuickActionIcon className="w-4 h-4" />
          <span className="hidden sm:block">{config.quickAction.label}</span>
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
              {/* ACCUEIL du module */}
              {filteredHome.length > 0 && (
                <div className="mb-2">
                  {filteredHome.map(item => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      accentClasses={accentClasses}
                      onClick={() => setActiveView(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* SECTION du module actif — uniquement */}
              {filteredModule.length > 0 && (
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className={cn('px-4 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5', accentClasses.text)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', accentClasses.dot)} />
                    {config.sidebarSectionLabel}
                  </div>
                  {filteredModule.map(item => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      accentClasses={accentClasses}
                      onClick={() => setActiveView(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Empty search results */}
              {filteredItems.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Aucun sous-module ne correspond à « {searchQuery} »
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
  item, isActive, accentClasses, onClick,
}: {
  item: SidebarItem;
  isActive: boolean;
  accentClasses: { sidebarActive: string; sidebarHover: string };
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        isActive ? accentClasses.sidebarActive : accentClasses.sidebarHover,
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HOME VIEW — Vue d'accueil du module actif (UN SEUL module)
// ─────────────────────────────────────────────────────────────────────

function HomeView({
  mode, stats, onNavigate,
}: {
  mode: ModuleMode;
  stats: (ShopStats & CanteenStats) | null;
  onNavigate: (view: string) => void;
}) {
  const config = MODE_CONFIG[mode];

  // KPIs et quick-actions SPÉCIFIQUES au mode actif (pas de mélange)
  const kpis = mode === 'shop' ? [
    {
      label: 'Produits actifs',
      value: String(stats?.totalProducts ?? 0),
      icon: Package,
      trend: null as 'up' | null,
      navigate: 'shop:products',
    },
    {
      label: 'Recette (30j)',
      value: formatCurrency(stats?.totalRevenueMonth ?? 0),
      icon: TrendingUp,
      trend: 'up' as 'up' | null,
      navigate: 'shop:analysis',
    },
    {
      label: 'Ventes (30j)',
      value: String(stats?.totalSalesMonth ?? 0),
      icon: Archive,
      trend: 'up' as 'up' | null,
      navigate: 'shop:orders',
    },
    {
      label: 'Alertes stock',
      value: String(stats?.lowStockAlerts ?? 0),
      icon: AlertCircle,
      trend: null as 'up' | null,
      navigate: 'shop:inventory',
    },
  ] : [
    {
      label: 'Élèves inscrits',
      value: String(stats?.enrolledStudents ?? 0),
      icon: Users,
      trend: 'up' as 'up' | null,
      navigate: 'canteen:students',
    },
    {
      label: 'Repas aujourd\'hui',
      value: String(stats?.mealsToday ?? 0),
      icon: UtensilsCrossed,
      trend: null as 'up' | null,
      navigate: 'canteen:attendance',
    },
    {
      label: 'Alertes stock',
      value: String(stats?.stockAlerts ?? 0),
      icon: Package,
      trend: null as 'up' | null,
      navigate: 'canteen:stocks',
    },
    {
      label: 'Score hygiène',
      value: String(stats?.hygieneScore ?? '—'),
      icon: ShieldIconReplacement,
      trend: 'up' as 'up' | null,
      navigate: 'canteen:incidents',
    },
  ];

  const quickActions = mode === 'shop' ? [
    { label: 'Nouvelle Vente', icon: Plus, view: 'shop:pos', primary: true },
    { label: 'Catalogue', icon: List, view: 'shop:catalog' },
    { label: 'Commandes', icon: Archive, view: 'shop:orders' },
    { label: 'Stocks', icon: Box, view: 'shop:inventory' },
    { label: 'Fournisseurs', icon: Truck, view: 'shop:suppliers' },
    { label: 'Kits Scolaires', icon: Bookmark, view: 'shop:kits' },
    { label: 'Retours', icon: RotateCcw, view: 'shop:returns' },
    { label: 'Rapports', icon: BarChart3, view: 'shop:analysis' },
  ] : [
    { label: 'Nouveau Menu', icon: ChefHat, view: 'canteen:menus', primary: true },
    { label: 'Inscriptions', icon: ClipboardCheck, view: 'canteen:enrollments' },
    { label: 'Élèves inscrits', icon: Users, view: 'canteen:students' },
    { label: 'Présences', icon: UtensilsCrossed, view: 'canteen:attendance' },
    { label: 'Régimes & Allergies', icon: AlertTriangle, view: 'canteen:diets' },
    { label: 'Paiements', icon: CreditCard, view: 'canteen:payments' },
    { label: 'Stocks', icon: Package, view: 'canteen:stocks' },
    { label: 'Fournisseurs', icon: Truck, view: 'canteen:suppliers' },
    { label: 'Incidents', icon: AlertCircle, view: 'canteen:incidents' },
    { label: 'Rapports', icon: BarChart3, view: 'canteen:reports' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* En-tête — nom du module actif uniquement */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{config.label}</h1>
        <p className="text-sm text-slate-500 mt-1">{config.description}</p>
      </div>

      {/* KPIs du module actif (données réelles backend) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={config.accent}
            trend={kpi.trend}
            onClick={() => onNavigate(kpi.navigate)}
          />
        ))}
      </div>

      {/* Carte résumé du module — une seule, pas de mélange */}
      <ModuleSectionCard
        mode={mode}
        onNavigate={onNavigate}
        quickActions={quickActions}
        externalLink={mode === 'shop' ? { href: '/app/finance/payments', label: 'Encaissements Finance' } : undefined}
      />

      {/* Carte paramètres du module */}
      <button
        onClick={() => onNavigate(mode === 'shop' ? 'shop:settings' : 'canteen:settings')}
        className={cn(
          'flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 transition text-left w-full max-w-md',
          config.accent === 'amber'
            ? 'hover:border-amber-300 hover:bg-amber-50/30'
            : 'hover:border-emerald-300 hover:bg-emerald-50/30',
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          config.accent === 'amber' ? 'bg-amber-50' : 'bg-emerald-50',
        )}>
          <Settings className={cn('w-5 h-5', config.accent === 'amber' ? 'text-amber-600' : 'text-emerald-600')} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">
            {mode === 'shop' ? 'Configuration Academia Shop' : 'Paramètres Cantine'}
          </p>
          <p className="text-xs text-slate-500">
            {mode === 'shop'
              ? 'Catégories, TVA, moyens de paiement, imprimantes'
              : 'Tarifs repas, allergies, fournisseurs, hygiène'}
          </p>
        </div>
      </button>
    </div>
  );
}

// Icône placeholder pour Score Hygiène (utilise AlertCircle déjà importé)
function ShieldIconReplacement({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
}

// ─────────────────────────────────────────────────────────────────────
// KPI CARD — Petite carte KPI cliquable (données réelles backend)
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
// MODULE SECTION CARD — Carte résumé du module actif (UN SEUL)
// ─────────────────────────────────────────────────────────────────────

function ModuleSectionCard({
  mode, onNavigate, quickActions, externalLink,
}: {
  mode: ModuleMode;
  onNavigate: (view: string) => void;
  quickActions: { label: string; icon: any; view: string; primary?: boolean }[];
  externalLink?: { href: string; label: string };
}) {
  const config = MODE_CONFIG[mode];
  const colorClasses = {
    amber: {
      gradient: 'from-amber-500 to-orange-500',
      btn: 'bg-amber-600 hover:bg-amber-700',
      btnLight: 'border-amber-200 text-amber-700 hover:bg-amber-50',
    },
    emerald: {
      gradient: 'from-emerald-500 to-teal-500',
      btn: 'bg-emerald-600 hover:bg-emerald-700',
      btnLight: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    },
  }[config.accent];

  const AccentIcon = config.logoIcon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Bandeau d'en-tête avec dégradé */}
      <div className={cn('p-5 bg-gradient-to-r text-white', colorClasses.gradient)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <AccentIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black">{config.label}</h3>
            <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{config.description}</p>
          </div>
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

        {/* Lien externe (Finance pour Boutique uniquement) */}
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
