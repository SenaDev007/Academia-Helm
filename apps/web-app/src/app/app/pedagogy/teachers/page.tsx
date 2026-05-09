/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - ENSEIGNANTS ACADÉMIQUES
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import TeachersAcademicWorkspace from '@/components/pedagogy/teachers/TeachersAcademicWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TeachersPage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Enseignants académiques',
        description: academicYear
          ? `Profils, habilitations et charge horaire — année ${academicYear.label}`
          : 'Gestion institutionnelle du corps enseignant',
        icon: 'users',
        kpis: [
          { label: 'Effectif', value: '24', trend: 'Stable', trendType: 'neutral' },
          { label: 'Habilités', value: '18', trend: '+2', trendType: 'up' },
          { label: 'Charge Moy.', value: '16h', trend: '-1h', trendType: 'down' },
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
        activeId: 'teachers-academic',
      }}
      content={{
        layout: 'custom',
        children: <TeachersAcademicWorkspace />,
      }}
    />
  );
}
