/**
 * ============================================================================
 * MODULE FINANCES & ÉCONOMAT (Spec Premium)
 * ============================================================================
 * 
 * 14 sous-modules métier :
 * Configuration des frais, Encaissements & Inscriptions, Facturation & Recouvrement,
 * Dépenses & Engagements, Boutique & Économat, Cantine & Restauration,
 * Paie & RH (Finance), Banques & Trésorerie, Reporting & Audit,
 * ORION Vigilance, Sara AI Finance, Paramètres Financiers, Archives,
 * Simulation & Prévision.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  DollarSign,
  Receipt,
  ShoppingCart,
  Utensils,
  Wallet,
  PieChart,
  ShieldAlert,
  BrainCircuit,
  Archive,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Plus,
  Download,
  Search,
  ChevronRight
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatCurrency } from '@/lib/utils';

// Import sub-module components
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import FeeStructuresContent from '@/components/finance/FeeStructuresContent';
import TransactionsContent from '@/components/finance/TransactionsContent';
import RecoveryRemindersContent from '@/components/finance/RecoveryRemindersContent';
import ExpensesManagement from '@/components/finance/ExpensesManagement';
import ShopCanteenManagement from '@/components/finance/ShopCanteenManagement';
import BankTreasury from '@/components/finance/BankTreasury';
import FinanceReportsContent from '@/components/finance/FinanceReportsContent';
import OrionFinanceVigilance from '@/components/finance/OrionFinanceVigilance';
import FinanceSaraAssistant from '@/components/finance/FinanceSaraAssistant';
import FinanceSimulation from '@/components/finance/FinanceSimulation';
const FinanceSettings = () => <div className="p-12 text-center text-slate-400">Paramètres Financiers - Configuration avancée</div>;
const FinanceArchives = () => <div className="p-12 text-center text-slate-400">Archives Financières - Historique des exercices</div>;

export default function FinanceModulePage() {
  const { academicYear, schoolLevel, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (academicYear?.id) {
      loadFinanceStats();
    }
  }, [academicYear?.id]);

  const loadFinanceStats = async () => {
    try {
      const res = await fetch(`/api/finance/stats?academicYearId=${academicYear?.id}`);
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Finances & Économat',
        description: 'Gestion financière intégrée, recouvrement, économat et intelligence budgétaire',
        icon: 'dollarSign',
        kpis: stats ? [
          { label: 'Recettes Total', value: formatCurrency(stats.totalRevenue), icon: 'trendingUp', trend: 'up' },
          { label: 'Taux de Recouvrement', value: `${stats.recoveryRate}%`, icon: 'badgeCheck', trend: 'neutral' },
          { label: 'Dépenses', value: formatCurrency(stats.totalExpenses), icon: 'trendingDown', trend: 'down' },
          { label: 'Impayés Critiques', value: formatCurrency(stats.criticalArrears), icon: 'alertCircle', trend: 'up' },
        ] : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all">
              <Plus className="w-4 h-4" /> Nouveau Paiement
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Exporter Rapport
            </button>
          </div>
        )
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'config', label: 'Configuration Frais', icon: <Settings className="w-4 h-4" /> },
          { id: 'payments', label: 'Paiements & Encaissements', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'recovery', label: 'Recouvrement', icon: <ArrowUpRight className="w-4 h-4" /> },
          { id: 'expenses', label: 'Dépenses', icon: <TrendingDown className="w-4 h-4" /> },
          { id: 'shop', label: 'Boutique & Cantine', icon: <ShoppingCart className="w-4 h-4" /> },
          { id: 'treasury', label: 'Trésorerie & Banques', icon: <Wallet className="w-4 h-4" /> },
          { id: 'reporting', label: 'Reporting & Audit', icon: <PieChart className="w-4 h-4" /> },
          { id: 'orion', label: 'ORION Vigilance', icon: <ShieldAlert className="w-4 h-4" /> },
          { id: 'sara', label: 'SARA AI Finance', icon: <BrainCircuit className="w-4 h-4" /> },
          { id: 'simulation', label: 'Simulation & Prévision', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
          { id: 'archives', label: 'Archives', icon: <Archive className="w-4 h-4" /> },
        ]
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <FinanceDashboard /> } :
        activeSubModuleId === 'config' ? { layout: 'default', children: <FeeStructuresContent /> } :
        activeSubModuleId === 'payments' ? { layout: 'default', children: <TransactionsContent /> } :
        activeSubModuleId === 'recovery' ? { layout: 'default', children: <RecoveryRemindersContent /> } :
        activeSubModuleId === 'expenses' ? { layout: 'default', children: <ExpensesManagement /> } :
        activeSubModuleId === 'shop' ? { layout: 'default', children: <ShopCanteenManagement /> } :
        activeSubModuleId === 'treasury' ? { layout: 'default', children: <BankTreasury /> } :
        activeSubModuleId === 'reporting' ? { layout: 'default', children: <FinanceReportsContent /> } :
        activeSubModuleId === 'orion' ? { layout: 'default', children: <OrionFinanceVigilance /> } :
        activeSubModuleId === 'sara' ? { layout: 'default', children: <FinanceSaraAssistant /> } :
        activeSubModuleId === 'simulation' ? { layout: 'default', children: <FinanceSimulation /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <FinanceSettings /> } :
        activeSubModuleId === 'archives' ? { layout: 'default', children: <FinanceArchives /> } :
        { layout: 'default', children: <FinanceDashboard /> }
      }
    />
  );
}
