/**
 * ============================================================================
 * MODULE EXAMENS, NOTES & BULLETINS (Spec 10 Onglets — Production Ready)
 * ============================================================================
 * 
 * 1. Tableau de bord
 * 2. Paramétrage académique
 * 3. Évaluations
 * 4. Saisie des notes
 * 5. Validation & Verrouillage
 * 6. Moyennes & Classements
 * 7. Conseils de classe
 * 8. Bulletins
 * 9. Statistiques & ORION
 * 10. Audit académique
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Award,
  Settings,
  FileText,
  Lock,
  ShieldCheck,
  BrainCircuit,
  LayoutDashboard,
  Calculator,
  Users,
  Printer,
  BarChart3,
  History
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

// Fully implemented high-fidelity sub-modules
import ExamsDashboard        from '@/components/exams/ExamsDashboard';
import AcademicSettingsPanel from '@/components/exams/AcademicSettingsPanel';
import EvaluationsManagement from '@/components/exams/EvaluationsManagement';
import GradeEntrySecure      from '@/components/exams/GradeEntrySecure';
import ValidationLocking     from '@/components/exams/ValidationLocking';
import AveragesRankings      from '@/components/exams/AveragesRankings';
import ClassCouncilManagement from '@/components/exams/ClassCouncilManagement';
import OrionExamVigilance    from '@/components/exams/OrionExamVigilance';
import ExamSaraAssistant     from '@/components/exams/ExamSaraAssistant';
import AcademicAuditLog      from '@/components/exams/AcademicAuditLog';

// Bulletins placeholder (connects to ReportCardsManagement)
import ReportCardsManagement from '@/components/pedagogy/ReportCardsManagement';

export default function ExamsModulePage() {
  const { academicYear, isLoading: contextLoading } = useModuleContext();
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (academicYear?.id) loadExamStats();
  }, [academicYear?.id]);

  const loadExamStats = async () => {
    try {
      const res = await fetch(`/api/exams/dashboard?academicYearId=${academicYear?.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          successRate:   data.successRate   ?? 0,
          plannedCount:  data.plannedCount  ?? 0,
          nationalAvg:   data.globalAverage ?? 0,
          fraudAlerts:   data.orionAlerts   ?? 0,
          missingGrades: data.missingGrades ?? 0,
          lockedClasses: data.lockedClasses ?? 0,
          generatedBulletins: data.generatedBulletins ?? 0,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (contextLoading) return <div className="p-8 text-center text-slate-400">Initialisation Examens...</div>;

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Examens, Notes & Bulletins',
          description: 'Moteur académique institutionnel — certification, intégrité et pilotage des résultats',
          icon: 'award',
          kpis: stats ? [
            { label: 'Taux de Réussite',   value: `${stats.successRate}%`,      icon: 'award',       trend: 'up' },
            { label: 'Notes Manquantes',   value: stats.missingGrades,          icon: 'alertCircle', trend: 'down' },
            { label: 'Moyenne Générale',   value: `${stats.nationalAvg}/20`,    icon: 'trendingUp',  trend: 'up' },
            { label: 'Bulletins Générés',  value: stats.generatedBulletins,     icon: 'fileText',    trend: 'neutral' },
          ] : [],
          actions: null
        }}
        subModules={{
          activeModuleId: activeSubModuleId,
          onModuleChange: setActiveSubModuleId,
          modules: [
            { id: 'dashboard',     label: 'Tableau de Bord',        icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'settings',      label: 'Paramétrage',            icon: <Settings className="w-4 h-4" /> },
            { id: 'evaluations',   label: 'Évaluations',            icon: <FileText className="w-4 h-4" /> },
            { id: 'grades',        label: 'Saisie des Notes',       icon: <Lock className="w-4 h-4" /> },
            { id: 'validation',    label: 'Validation & Verrous',   icon: <ShieldCheck className="w-4 h-4" /> },
            { id: 'averages',      label: 'Moyennes & Classements', icon: <Calculator className="w-4 h-4" /> },
            { id: 'councils',      label: 'Conseils de Classe',     icon: <Users className="w-4 h-4" /> },
            { id: 'bulletins',     label: 'Bulletins',              icon: <Printer className="w-4 h-4" /> },
            { id: 'orion',         label: 'ORION & Statistiques',   icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'audit',         label: 'Audit Académique',       icon: <History className="w-4 h-4" /> },
          ]
        }}
        content={{
          layout: 'default',
          children:
            activeSubModuleId === 'dashboard'   ? <ExamsDashboard /> :
            activeSubModuleId === 'settings'    ? <AcademicSettingsPanel /> :
            activeSubModuleId === 'evaluations' ? <EvaluationsManagement /> :
            activeSubModuleId === 'grades'      ? <GradeEntrySecure /> :
            activeSubModuleId === 'validation'  ? <ValidationLocking /> :
            activeSubModuleId === 'averages'    ? <AveragesRankings /> :
            activeSubModuleId === 'councils'    ? <ClassCouncilManagement /> :
            activeSubModuleId === 'bulletins'   ? <ReportCardsManagement /> :
            activeSubModuleId === 'orion'       ? <OrionExamVigilance /> :
            activeSubModuleId === 'audit'       ? <AcademicAuditLog /> :
            <ExamsDashboard />
        }}
      />
      {/* Sara AI floating assistant */}
      <ExamSaraAssistant />
    </>
  );
}
