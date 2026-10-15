/**
 * ============================================================================
 * MODULE CANTINE & RESTAURATION - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern ModuleContainer (comme
 * FinanceModulePage / InfirmaryModulePage / LaboratoryModulePage) pour
 * uniformiser le design à travers tous les modules. Avant, ce module utilisait
 * ModulePageLayout (obsolète) avec des onglets pills custom navy-900/uppercase
 * framer-motion — désormais il utilise ModuleContainer + SubModuleNavigation
 * standard (bleus soulignés).
 *
 * Sous-modules :
 *   1. Tableau de Bord (dashboard)
 *   2. Menus (menus)
 *   3. Inscriptions (enrollments)
 *   4. Élèves inscrits (students)
 *   5. Présences (attendance)
 *   6. Régimes & Allergies (diets)
 *   7. Paiements (payments)
 *   8. Stocks (stocks)
 *   9. Fournisseurs (suppliers)
 *  10. Incidents & Hygiène (incidents)
 *  11. Rapports (reports)
 *  12. Paramètres (settings)
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ChefHat,
  ClipboardCheck,
  Users,
  UtensilsCrossed,
  AlertTriangle,
  CreditCard,
  Package,
  Truck,
  AlertCircle,
  BarChart3,
  Settings,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern FinanceModulePage)
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
// 🗑️ 2026-10-15 — CanteenReports supprimé (sous-module Rapports retiré)
// import CanteenReports from './canteen/CanteenReports';
import CanteenSettings from './canteen/CanteenSettings';

export default function CanteenModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  // Charger les stats cantine pour les KPIs du header
  useEffect(() => {
    if (academicYear?.id) {
      loadCanteenStats();
    }
  }, [academicYear?.id]);

  const loadCanteenStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/canteen/dashboard?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Erreur chargement stats cantine:', e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Cantine & Restauration',
        description:
          'Gestion complète de la restauration scolaire : menus, inscriptions, présences, régimes & allergies, paiements, stocks, fournisseurs, incidents hygiène et rapports',
        icon: 'utensils',
        kpis: stats
          ? [
              {
                label: 'Élèves inscrits',
                value: String(stats.enrolledStudents ?? 0),
                icon: 'users',
                trend: 'up',
              },
              {
                label: 'Repas aujourd’hui',
                value: String(stats.mealsToday ?? 0),
                icon: 'utensils',
                trend: 'neutral',
              },
              {
                label: 'Alertes stock',
                value: String(stats.stockAlerts ?? 0),
                icon: 'package',
                trend: stats.stockAlerts > 0 ? 'up' : 'neutral',
              },
              {
                label: 'Score hygiène',
                value: stats.hygieneScore ?? '—',
                icon: 'badgeCheck',
                trend: 'up',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubModuleId('menus')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all"
              title="Planifier un nouveau menu"
            >
              <Plus className="w-4 h-4" /> Nouveau menu
            </button>
            {/* 🗑️ 2026-10-15 — Bouton Rapports supprimé */}
          </div>
        ),
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'menus', label: 'Menus', icon: <ChefHat className="w-4 h-4" /> },
          { id: 'enrollments', label: 'Inscriptions', icon: <ClipboardCheck className="w-4 h-4" /> },
          { id: 'students', label: 'Élèves inscrits', icon: <Users className="w-4 h-4" /> },
          { id: 'attendance', label: 'Présences', icon: <UtensilsCrossed className="w-4 h-4" /> },
          { id: 'diets', label: 'Régimes & Allergies', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'payments', label: 'Paiements', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'stocks', label: 'Stocks', icon: <Package className="w-4 h-4" /> },
          { id: 'suppliers', label: 'Fournisseurs', icon: <Truck className="w-4 h-4" /> },
          { id: 'incidents', label: 'Incidents & Hygiène', icon: <AlertCircle className="w-4 h-4" /> },
          // 🗑️ 2026-10-15 — Rapports supprimé
          // { id: 'reports', label: 'Rapports', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <CanteenDashboard /> } :
        activeSubModuleId === 'menus' ? { layout: 'default', children: <CanteenMenus /> } :
        activeSubModuleId === 'enrollments' ? { layout: 'default', children: <CanteenEnrollments /> } :
        activeSubModuleId === 'students' ? { layout: 'default', children: <CanteenStudents /> } :
        activeSubModuleId === 'attendance' ? { layout: 'default', children: <CanteenAttendance /> } :
        activeSubModuleId === 'diets' ? { layout: 'default', children: <CanteenDiets /> } :
        activeSubModuleId === 'payments' ? { layout: 'default', children: <CanteenPayments /> } :
        activeSubModuleId === 'stocks' ? { layout: 'default', children: <CanteenStocks /> } :
        activeSubModuleId === 'suppliers' ? { layout: 'default', children: <CanteenSuppliers /> } :
        activeSubModuleId === 'incidents' ? { layout: 'default', children: <CanteenIncidents /> } :
        // 🗑️ 2026-10-15 — Rapports supprimé
        // activeSubModuleId === 'reports' ? { layout: 'default', children: <CanteenReports /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <CanteenSettings /> } :
        { layout: 'default', children: <CanteenDashboard /> }
      }
    />
  );
}
