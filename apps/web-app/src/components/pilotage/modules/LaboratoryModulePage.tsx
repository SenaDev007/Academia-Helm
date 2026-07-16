/**
 * ============================================================================
 * MODULE LABORATOIRE - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte : alignement sur le pattern ModuleContainer (comme FinanceModulePage /
 * StudentsModulePage / ShopModulePage / InfirmaryModulePage) pour uniformiser
 * le design à travers tous les modules. Avant, ce module utilisait
 * ModulePageLayout (obsolète) avec des onglets pills custom navy-900/uppercase
 * framer-motion — désormais il utilise ModuleContainer + SubModuleNavigation
 * standard (bleus soulignés).
 *
 * Sous-modules :
 *   1. Tableau de Bord (dashboard)
 *   2. Laboratoires (labs)
 *   3. Équipements (equipments)
 *   4. Consommables (consumables)
 *   5. Réservations (reservations)
 *   6. Séances Pratiques (sessions)
 *   7. Maintenance (maintenance)
 *   8. Sécurité & Incidents (safety)
 *   9. Stocks & Appro (stocks)
 *  10. Rapports & Stats (reports)
 *  11. Configuration (settings)
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Beaker,
  Microscope,
  Droplets,
  Calendar,
  GraduationCap,
  Wrench,
  ShieldAlert,
  Package,
  BarChart3,
  Settings,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern FinanceModulePage)
import LaboratoryDashboard from './laboratory/LaboratoryDashboard';
import LabsList from './laboratory/LabsList';
import EquipmentsInventory from './laboratory/EquipmentsInventory';
import ConsumablesStock from './laboratory/ConsumablesStock';
import LabReservations from './laboratory/LabReservations';
import PracticalSessions from './laboratory/PracticalSessions';
import LabMaintenance from './laboratory/LabMaintenance';
import SafetyIncidents from './laboratory/SafetyIncidents';
import StocksApprovisionnement from './laboratory/StocksApprovisionnement';
import LabReportsStats from './laboratory/LabReportsStats';
import LaboratorySettings from './laboratory/LaboratorySettings';

export default function LaboratoryModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  // Charger les stats labs pour les KPIs du header
  useEffect(() => {
    if (academicYear?.id) {
      loadLabStats();
    }
  }, [academicYear?.id]);

  const loadLabStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/labs/dashboard?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data?.data ?? data);
      }
    } catch (e) {
      console.error('Erreur chargement stats labs:', e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Laboratoire',
        description:
          'Gestion des espaces pratiques : laboratoires, équipements, consommables, réservations, séances, maintenance, sécurité et approvisionnement',
        icon: 'flask',
        kpis: stats
          ? [
              {
                label: 'Laboratoires',
                value: String(stats.totalLabs ?? 0),
                icon: 'flask',
                trend: 'neutral',
              },
              {
                label: 'Équipements',
                value: String(stats.equipmentTotal ?? stats.equipmentsCount ?? 0),
                icon: 'microscope',
                trend: 'neutral',
              },
              {
                label: 'Incidents ouverts',
                value: String(stats.incidentsCount ?? 0),
                icon: 'alertCircle',
                trend: stats.incidentsCount > 0 ? 'up' : 'neutral',
              },
              {
                label: 'Maintenances à venir',
                value: String(stats.pendingMaintenance ?? 0),
                icon: 'wrench',
                trend: 'neutral',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubModuleId('sessions')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all"
              title="Ouvrir le formulaire de nouvelle séance"
            >
              <Plus className="w-4 h-4" /> Nouvelle séance
            </button>
            <button
              onClick={() => setActiveSubModuleId('reports')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              title="Rapports & statistiques laboratoire"
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
          { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'labs', label: 'Laboratoires', icon: <Beaker className="w-4 h-4" /> },
          { id: 'equipments', label: 'Équipements', icon: <Microscope className="w-4 h-4" /> },
          { id: 'consumables', label: 'Consommables', icon: <Droplets className="w-4 h-4" /> },
          { id: 'reservations', label: 'Réservations', icon: <Calendar className="w-4 h-4" /> },
          { id: 'sessions', label: 'Séances Pratiques', icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
          { id: 'safety', label: 'Sécurité & Incidents', icon: <ShieldAlert className="w-4 h-4" /> },
          { id: 'stocks', label: 'Stocks & Appro', icon: <Package className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports & Stats', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'settings', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <LaboratoryDashboard /> } :
        activeSubModuleId === 'labs' ? { layout: 'default', children: <LabsList /> } :
        activeSubModuleId === 'equipments' ? { layout: 'default', children: <EquipmentsInventory /> } :
        activeSubModuleId === 'consumables' ? { layout: 'default', children: <ConsumablesStock /> } :
        activeSubModuleId === 'reservations' ? { layout: 'default', children: <LabReservations /> } :
        activeSubModuleId === 'sessions' ? { layout: 'default', children: <PracticalSessions /> } :
        activeSubModuleId === 'maintenance' ? { layout: 'default', children: <LabMaintenance /> } :
        activeSubModuleId === 'safety' ? { layout: 'default', children: <SafetyIncidents /> } :
        activeSubModuleId === 'stocks' ? { layout: 'default', children: <StocksApprovisionnement /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <LabReportsStats /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <LaboratorySettings /> } :
        { layout: 'default', children: <LaboratoryDashboard /> }
      }
    />
  );
}
