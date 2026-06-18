/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATIÈRES & PROGRAMMES
 * ============================================================================
 */

'use client';

import { 
  ModuleContainer,
} from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import SubjectsWorkspace from '@/components/pedagogy/subjects/SubjectsWorkspace';

export default function SubjectsPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  return (
    <ModuleContainer
      header={{
        title: 'Matières & Programmes',
        description: 'Définition institutionnelle du catalogue pédagogique, des séries et des programmes officiels.',
        icon: 'bookOpen',
        kpis: [
          { label: 'Matières', value: '42', trend: '+3', trendType: 'neutral' },
          { label: 'Séries', value: '8', trend: 'Stable', trendType: 'neutral' },
          { label: 'Programmes', value: '95%', trend: '+5%', trendType: 'up' },
        ]
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
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
