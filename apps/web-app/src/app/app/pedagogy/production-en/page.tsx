/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - PEDAGOGICAL SPACE (ENGLISH TRACK)
 * ============================================================================
 * Duplicate of the FR Pedagogical Space, but for the English language track.
 * All labels are in English. Subject filtering uses language=EN.
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import { PedagogicalSpaceWorkspaceEN } from '@/components/pedagogy/production-en/PedagogicalSpaceWorkspaceEN';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ProductionENPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Pedagogical Space',
        description: academicYear
          ? `Teacher workspace — year ${academicYear.label}`
          : 'My classes, daily log, assignments and pedagogical tracking',
        icon: 'bookOpen'
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
        activeModuleId: 'production-en',
      }}
      content={{
        layout: 'custom',
        children: <PedagogicalSpaceWorkspaceEN />,
      }}
    />
  );
}
