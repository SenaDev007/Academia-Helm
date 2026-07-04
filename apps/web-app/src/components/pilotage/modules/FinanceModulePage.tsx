/**
 * ============================================================================
 * MODULE FINANCES & ÉCONOMAT (Spec Premium)
 * ============================================================================
 *
 * Sous-modules métier (alignés sur la spec MODULE FINANCE.txt) :
 *   1. Tableau de Bord
 *   2. Configuration des frais
 *   3. Comptes élèves
 *   4. Encaissements
 *   5. Recouvrement
 *   6. Dépenses
 *   7. Clôture & Trésorerie
 *   8. Multi-caisses
 *   9. Rapports financiers
 *  10. Contrôle & Audit
 *  11. Paramètres
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation
 * (sinon duplication des onglets — voir pattern StudentsModulePage).
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  DollarSign,
  CreditCard,
  AlertCircle,
  TrendingDown,
  Wallet,
  BarChart3,
  ShieldCheck,
  Coins,
  Users,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatCurrency } from '@/lib/utils';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern StudentsModulePage)
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import FeeStructuresContent from '@/components/finance/FeeStructuresContent';
import StudentAccountsContent from '@/components/finance/StudentAccountsContent';
import TransactionsContent from '@/components/finance/TransactionsContent';
import RecoveryRemindersContent from '@/components/finance/RecoveryRemindersContent';
import ExpensesManagement from '@/components/finance/ExpensesManagement';
import BankTreasury from '@/components/finance/BankTreasury';
import CashRegistersContent from '@/components/finance/CashRegistersContent';
import FinanceReportsContent from '@/components/finance/FinanceReportsContent';
import FinanceSettings from '@/components/finance/FinanceSettingsContent';
import FinanceAuditContent from '@/components/finance/FinanceAuditContent';

export default function FinanceModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
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
        description:
          'Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage',
        icon: 'dollarSign',
        kpis: stats
          ? [
              {
                label: 'Recettes Total',
                value: formatCurrency(stats.totalRevenue),
                icon: 'trendingUp',
                trend: 'up',
              },
              {
                label: 'Taux de Recouvrement',
                value: `${stats.recoveryRate}%`,
                icon: 'badgeCheck',
                trend: 'neutral',
              },
              {
                label: 'Dépenses',
                value: formatCurrency(stats.totalExpenses),
                icon: 'trendingDown',
                trend: 'down',
              },
              {
                label: 'Impayés Critiques',
                value: formatCurrency(stats.criticalArrears),
                icon: 'alertCircle',
                trend: 'up',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all">
              <Plus className="w-4 h-4" /> Nouveau Paiement
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Exporter Rapport
            </button>
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'fees', label: 'Configuration des frais', icon: <DollarSign className="w-4 h-4" /> },
          { id: 'accounts', label: 'Comptes élèves', icon: <Users className="w-4 h-4" /> },
          { id: 'payments', label: 'Encaissements', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'recovery', label: 'Recouvrement', icon: <AlertCircle className="w-4 h-4" /> },
          { id: 'expenses', label: 'Dépenses', icon: <TrendingDown className="w-4 h-4" /> },
          { id: 'treasury', label: 'Clôture & Trésorerie', icon: <Wallet className="w-4 h-4" /> },
          { id: 'cash-registers', label: 'Multi-caisses', icon: <Coins className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports financiers', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'audit', label: "Contrôle & Audit", icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramétrage', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <FinanceDashboard /> } :
        activeSubModuleId === 'fees' ? { layout: 'default', children: <FeeStructuresContent /> } :
        activeSubModuleId === 'accounts' ? { layout: 'default', children: <StudentAccountsContent /> } :
        activeSubModuleId === 'payments' ? { layout: 'default', children: <TransactionsContent /> } :
        activeSubModuleId === 'recovery' ? { layout: 'default', children: <RecoveryRemindersContent /> } :
        activeSubModuleId === 'expenses' ? { layout: 'default', children: <ExpensesManagement /> } :
        activeSubModuleId === 'treasury' ? { layout: 'default', children: <BankTreasury /> } :
        activeSubModuleId === 'cash-registers' ? { layout: 'default', children: <CashRegistersContent /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <FinanceReportsContent /> } :
        activeSubModuleId === 'audit' ? { layout: 'default', children: <FinanceAuditContent /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <FinanceSettings /> } :
        { layout: 'default', children: <FinanceDashboard /> }
      }
    />
  );
}
