/**
 * ============================================================================
 * MODULE INFIRMERIE & SANTÉ - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern ModuleContainer (comme
 * FinanceModulePage / StudentsModulePage / ShopModulePage) pour uniformiser
 * le design à travers tous les modules. Avant, ce module utilisait
 * ModulePageLayout (obsolète) avec des onglets pills custom navy-900/uppercase
 * framer-motion — désormais il utilise ModuleContainer + SubModuleNavigation
 * standard (bleus soulignés).
 *
 * Sous-modules :
 *   1. Tableau de Bord (dashboard)
 *   2. Dossiers Médicaux (records)
 *   3. Passages Infirmerie (visits)
 *   4. Urgences & Incidents (emergencies)
 *   5. Pharmacie & Stocks (pharmacy)
 *   6. Allergies & Vigilance (allergies)
 *   7. Visites Médicales (checkups)
 *   8. Autorisations (authorizations)
 *   9. Rapports & Stats (reports)
 *  10. Configuration (settings)
 *
 * Note : La navigation par sous-modules est gérée par ModuleContainer.subModules.
 * Les sous-composants NE doivent PAS inclure leur propre SubModuleNavigation.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  HeartPulse,
  AlertCircle,
  Pill,
  ShieldAlert,
  Calendar,
  ClipboardCheck,
  BarChart3,
  Settings,
  Plus,
  Download,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Sous-composants (aucun ne contient SubModuleNavigation — pattern FinanceModulePage)
import InfirmaryDashboard from './infirmary/InfirmaryDashboard';
import MedicalRecords from './infirmary/MedicalRecords';
import InfirmaryVisits from './infirmary/InfirmaryVisits';
import Emergencies from './infirmary/Emergencies';
import PharmacyStock from './infirmary/PharmacyStock';
import AllergiesVigilance from './infirmary/AllergiesVigilance';
import MedicalCheckups from './infirmary/MedicalCheckups';
import Authorizations from './infirmary/Authorizations';
import ReportsStats from './infirmary/ReportsStats';
import InfirmarySettings from './infirmary/InfirmarySettings';

export default function InfirmaryModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  // Charger les stats infirmerie pour les KPIs du header
  useEffect(() => {
    if (academicYear?.id) {
      loadInfirmaryStats();
    }
  }, [academicYear?.id]);

  const loadInfirmaryStats = async () => {
    try {
      const res = await fetch(
        `/api/modules-complementaires/infirmary/dashboard?academicYearId=${academicYear?.id}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Erreur chargement stats infirmerie:', e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Infirmerie & Santé',
        description:
          'Gestion sanitaire de l’établissement : dossiers médicaux, passages infirmerie, urgences, pharmacie, vigilance, autorisations parentales et rapports',
        icon: 'heart',
        kpis: stats
          ? [
              {
                label: 'Passages (mois)',
                value: String(stats.totalVisits ?? 0),
                icon: 'heart',
                trend: 'up',
              },
              {
                label: 'Urgences actives',
                value: String(stats.criticalCases ?? 0),
                icon: 'alertCircle',
                trend: stats.criticalCases > 0 ? 'up' : 'neutral',
              },
              {
                label: 'Alertes stock',
                value: String(stats.lowStockAlerts ?? stats.medicationsDispensed ?? 0),
                icon: 'package',
                trend: 'neutral',
              },
              {
                label: 'Dossiers suivis',
                value: String(stats.allergiesTracked ?? 0),
                icon: 'fileText',
                trend: 'neutral',
              },
            ]
          : [],
        actions: (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubModuleId('visits')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 transition-all"
              title="Ouvrir le formulaire de nouveau passage"
            >
              <Plus className="w-4 h-4" /> Nouveau passage
            </button>
            <button
              onClick={() => setActiveSubModuleId('reports')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              title="Rapports & statistiques sanitaires"
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
          { id: 'records', label: 'Dossiers Médicaux', icon: <FileText className="w-4 h-4" /> },
          { id: 'visits', label: 'Passages Infirmerie', icon: <HeartPulse className="w-4 h-4" /> },
          { id: 'emergencies', label: 'Urgences & Incidents', icon: <AlertCircle className="w-4 h-4" /> },
          { id: 'pharmacy', label: 'Pharmacie & Stocks', icon: <Pill className="w-4 h-4" /> },
          { id: 'allergies', label: 'Allergies & Vigilance', icon: <ShieldAlert className="w-4 h-4" /> },
          { id: 'checkups', label: 'Visites Médicales', icon: <Calendar className="w-4 h-4" /> },
          { id: 'authorizations', label: 'Autorisations', icon: <ClipboardCheck className="w-4 h-4" /> },
          { id: 'reports', label: 'Rapports & Stats', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'settings', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
        ],
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <InfirmaryDashboard /> } :
        activeSubModuleId === 'records' ? { layout: 'default', children: <MedicalRecords /> } :
        activeSubModuleId === 'visits' ? { layout: 'default', children: <InfirmaryVisits /> } :
        activeSubModuleId === 'emergencies' ? { layout: 'default', children: <Emergencies /> } :
        activeSubModuleId === 'pharmacy' ? { layout: 'default', children: <PharmacyStock /> } :
        activeSubModuleId === 'allergies' ? { layout: 'default', children: <AllergiesVigilance /> } :
        activeSubModuleId === 'checkups' ? { layout: 'default', children: <MedicalCheckups /> } :
        activeSubModuleId === 'authorizations' ? { layout: 'default', children: <Authorizations /> } :
        activeSubModuleId === 'reports' ? { layout: 'default', children: <ReportsStats /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <InfirmarySettings /> } :
        { layout: 'default', children: <InfirmaryDashboard /> }
      }
    />
  );
}
