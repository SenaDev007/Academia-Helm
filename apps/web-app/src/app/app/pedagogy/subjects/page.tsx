/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATIÈRES & PROGRAMMES
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import SubjectsWorkspace from '@/components/pedagogy/subjects/SubjectsWorkspace';

export default function SubjectsPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();

  return (
    <ModuleContainer
      header={{
        title: 'Matières & Programmes',
        description: 'Définition institutionnelle du catalogue pédagogique, des séries et des programmes officiels.',
        icon: 'bookOpen',
      }}
      subModules={{
        modules: pedagogyVisibleTabs.map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
        activeModuleId: 'subjects',
      }}
      content={{
        layout: 'custom',
        children: <SubjectsWorkspace />,
      }}
    />
  );
}
