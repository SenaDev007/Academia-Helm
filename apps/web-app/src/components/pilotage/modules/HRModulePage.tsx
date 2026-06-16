/**
 * ============================================================================
 * MODULE PERSONNEL & RH (Spec Premium)
 * ============================================================================
 * 
 * Hub stratégique pour la gestion du capital humain :
 * Dossiers, Contrats, Paie, Présences, Performance, ORION RH, Sarah AI.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  CreditCard,
  Clock,
  Target,
  ShieldCheck,
  BrainCircuit,
  Plus,
  Search,
  Filter,
  Download,
  LayoutDashboard,
  Calendar,
  Briefcase,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Import sub-module components
import HRDashboard from '@/components/hr/HRDashboard';
import StaffDirectory from '@/components/hr/StaffDirectory';
import OrionHRVigilance from '@/components/hr/OrionHRVigilance';
import HRSaraAssistant from '@/components/hr/HRSaraAssistant';

const ContractsManagement = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Briefcase className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Gestion des Contrats & Carrière</h3>
     <p className="text-sm text-slate-400 mt-2">Suivi des CDI, CDD, vacations et évolutions salariales.</p>
  </div>
);

const PayrollManagement = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <CreditCard className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Paie & Émoluments</h3>
     <p className="text-sm text-slate-400 mt-2">Calcul des salaires, primes, retenues et édition des bulletins de paie.</p>
  </div>
);

const AttendanceTracking = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Pointage & Absences</h3>
     <p className="text-sm text-slate-400 mt-2">Suivi des présences, retards et justificatifs d'absence.</p>
  </div>
);

const PerformanceEvaluation = () => (
  <div className="p-12 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
     <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
     <h3 className="font-bold text-slate-900">Évaluation & Performance</h3>
     <p className="text-sm text-slate-400 mt-2">Suivi des objectifs pédagogiques et bilans de performance annuels.</p>
  </div>
);

const HRSettings = () => <div className="p-12 text-center text-slate-400">Paramètres RH - Grilles salariales & Catégories</div>;

export default function HRModulePage() {
  const { academicYear, schoolLevel, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (academicYear?.id) {
      loadHRStats();
    }
  }, [academicYear?.id]);

  const loadHRStats = async () => {
    try {
      const res = await fetch(`/api/hr/overview/dashboard?academicYearId=${academicYear?.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalCount: data.snapshot?.totalStaff || 0,
          attendanceRate: data.snapshot?.attendanceRate || 0,
          payrollTotal: data.snapshot?.totalPayroll || 0,
          expiringContracts: data.snapshot?.expiringContractsCount || 0,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center text-slate-400">Initialisation RH...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Personnel & RH',
        description: 'Gestion stratégique du capital humain, paie, performance et vigilance RH',
        icon: 'users',
        kpis: stats ? [
          { label: 'Effectif Total', value: stats.totalCount, icon: 'users', trend: 'neutral' },
          { label: 'Présence (Jour)', value: `${stats.attendanceRate}%`, icon: 'clock', trend: 'up' },
          { label: 'Masse Salariale', value: `${(stats.payrollTotal / 1000000).toFixed(1)}M`, icon: 'creditCard', trend: 'neutral' },
          { label: 'Alertes Contrats', value: stats.expiringContracts, icon: 'alertCircle', trend: 'up' },
        ] : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all">
              <Plus className="w-4 h-4" /> Nouveau Membre
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Rapport Global
            </button>
          </div>
        )
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'directory', label: 'Annuaire & Dossiers', icon: <Users className="w-4 h-4" /> },
          { id: 'contracts', label: 'Contrats & Carrière', icon: <Briefcase className="w-4 h-4" /> },
          { id: 'payroll', label: 'Paie & Émoluments', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'attendance', label: 'Pointage & Absences', icon: <Clock className="w-4 h-4" /> },
          { id: 'performance', label: 'Évaluation & KPIs', icon: <Target className="w-4 h-4" /> },
          { id: 'orion', label: 'ORION RH', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'sara', label: 'SARA AI', icon: <BrainCircuit className="w-4 h-4" /> },
          { id: 'settings', label: 'Paramètres', icon: <Filter className="w-4 h-4" /> },
        ]
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <HRDashboard /> } :
        activeSubModuleId === 'directory' ? { layout: 'default', children: <StaffDirectory /> } :
        activeSubModuleId === 'contracts' ? { layout: 'default', children: <ContractsManagement /> } :
        activeSubModuleId === 'payroll' ? { layout: 'default', children: <PayrollManagement /> } :
        activeSubModuleId === 'attendance' ? { layout: 'default', children: <AttendanceTracking /> } :
        activeSubModuleId === 'performance' ? { layout: 'default', children: <PerformanceEvaluation /> } :
        activeSubModuleId === 'orion' ? { layout: 'default', children: <OrionHRVigilance /> } :
        activeSubModuleId === 'sara' ? { layout: 'default', children: <HRSaraAssistant /> } :
        activeSubModuleId === 'settings' ? { layout: 'default', children: <HRSettings /> } :
        { layout: 'default', children: <HRDashboard /> }
      }
    />
  );
}
