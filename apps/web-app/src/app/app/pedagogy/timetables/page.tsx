/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - EMPLOI DU TEMPS (EDT) — STE V2+
 * ============================================================================
 */
'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import TimetablesWorkspace from '@/components/pedagogy/timetables/TimetablesWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TimetablesPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Emploi du Temps (EDT)',
        description: academicYear
          ? `Générateur d'emploi du temps — multi-solutions Pareto, contraintes dures/souples, backtracking — année ${academicYear.label}`
          : 'Génération multi-solutions Pareto avec contraintes et backtracking',
        icon: 'calendar',
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
        activeModuleId: 'timetables',
      }}
      content={{ layout: 'custom', children: <TimetablesWorkspace /> }}
    />
  );
}
