/**
 * ============================================================================
 * MODULE PÉDAGOGIE & SUIVI (Spec Premium)
 * ============================================================================
 * 
 * Hub stratégique pour l'excellence académique :
 * Cahier de textes, Avancement Curriculum, Évaluations, Bulletins, 
 * ORION Pédagogie, Sara AI, Emploi du Temps.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  TrendingUp,
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
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Award
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Import sub-module components
import { PedagogyDashboard, CurriculumTracking, ScheduleManagement } from '@/components/pedagogy/PedagogyPlaceholders';
import ClassLogManagement from '@/components/pedagogy/ClassLogManagement';
import ReportCardsManagement from '@/components/pedagogy/ReportCardsManagement';
import OrionPedagogyVigilance from '@/components/pedagogy/OrionPedagogyVigilance';
import PedagogySaraAssistant from '@/components/pedagogy/PedagogySaraAssistant';

export default function PedagogyModulePage() {
  const { academicYear, schoolLevel, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (academicYear?.id) {
      loadPedagogyStats();
    }
  }, [academicYear?.id]);

  const loadPedagogyStats = async () => {
    try {
      const res = await fetch(`/api/pedagogy/control/dashboard?academicYearId=${academicYear?.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          globalAverage: 14.5, // Mock for now if not in dashboard
          curriculumProgress: data.overallRate || 0,
          logsCompletion: data.classLogRate || 0,
          alertsCount: 3, // Mock or fetch from orion-advanced
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center text-slate-400">Initialisation Pédagogique...</div>;

  return (
    <ModuleContainer
      header={{
        title: 'Pédagogie & Suivi',
        description: 'Excellence académique, cahier de textes digital, bulletins et vigilance pédagogique',
        icon: 'bookOpen',
        kpis: stats ? [
          { label: 'Moyenne Générale', value: `${stats.globalAverage}/20`, icon: 'award', trend: 'up' },
          { label: 'Avancement Prog.', value: `${stats.curriculumProgress}%`, icon: 'trendingUp', trend: 'up' },
          { label: 'Cahiers à jour', value: `${stats.logsCompletion}%`, icon: 'checkCircle2', trend: 'neutral' },
          { label: 'Alertes ORION', value: stats.alertsCount, icon: 'shieldCheck', trend: 'down' },
        ] : [],
        actions: (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all">
              <Plus className="w-4 h-4" /> Nouvelle Séance
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" /> Générer Bulletins
            </button>
          </div>
        )
      }}
      subModules={{
        activeModuleId: activeSubModuleId,
        onModuleChange: setActiveSubModuleId,
        modules: [
          { id: 'dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="w-4 h-4" /> },
          { id: 'classlog', label: 'Cahier de Textes', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'curriculum', label: 'Avancement & Programme', icon: <Target className="w-4 h-4" /> },
          { id: 'reportcards', label: 'Bulletins & Moyennes', icon: <Award className="w-4 h-4" /> },
          { id: 'schedule', label: 'Emploi du Temps', icon: <Calendar className="w-4 h-4" /> },
          { id: 'orion', label: 'ORION Pédagogie', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'sara', label: 'SARA AI Pédagogique', icon: <BrainCircuit className="w-4 h-4" /> },
        ]
      }}
      content={
        activeSubModuleId === 'dashboard' ? { layout: 'default', children: <PedagogyDashboard /> } :
        activeSubModuleId === 'classlog' ? { layout: 'default', children: <ClassLogManagement /> } :
        activeSubModuleId === 'curriculum' ? { layout: 'default', children: <CurriculumTracking /> } :
        activeSubModuleId === 'reportcards' ? { layout: 'default', children: <ReportCardsManagement /> } :
        activeSubModuleId === 'schedule' ? { layout: 'default', children: <ScheduleManagement /> } :
        activeSubModuleId === 'orion' ? { layout: 'default', children: <OrionPedagogyVigilance /> } :
        activeSubModuleId === 'sara' ? { layout: 'default', children: <PedagogySaraAssistant /> } :
        { layout: 'default', children: <PedagogyDashboard /> }
      }
    />
  );
}
