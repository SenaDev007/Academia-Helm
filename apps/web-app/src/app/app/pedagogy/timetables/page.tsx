/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - EMPLOI DU TEMPS (EDT)
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import TimetablesWorkspace from '@/components/pedagogy/timetables/TimetablesWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TimetablesPage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Emploi du Temps (EDT)',
        description: academicYear
          ? `Génération et contrôle des plannings hebdomadaires — année ${academicYear.label}`
          : 'Organisation temporelle des cours, salles et enseignants',
        icon: 'calendar',
        kpis: [
          { label: 'Taux Occupation', value: '78%', trend: '+5%', trendType: 'up' },
          { label: 'Conflits', value: '0', trend: '-3', trendType: 'down' },
          { label: 'Salles Libres', value: '4', trend: 'Stable', trendType: 'neutral' },
        ]
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
        activeModuleId: 'timetables',
      }}
      content={{
        layout: 'custom',
        children: <TimetablesWorkspace />,
      }}
    />
  );
}
