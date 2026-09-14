/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - EMPLOI DU TEMPS (EDT) — STE V2+
 * ============================================================================
 */
'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import TimetablesWorkspace from '@/components/pedagogy/timetables/TimetablesWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TimetablesPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Emploi du Temps',
        description: academicYear
          ? `Création manuelle d'emploi du temps par classe ou groupe de classes — année ${academicYear.label}`
          : "Création manuelle d'emploi du temps par classe ou groupe de classes",
        icon: 'calendar',
      }}
      subModules={{
        modules: pedagogyVisibleTabs.map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
        activeModuleId: 'timetables',
      }}
      content={{ layout: 'custom', children: <TimetablesWorkspace /> }}
    />
  );
}
