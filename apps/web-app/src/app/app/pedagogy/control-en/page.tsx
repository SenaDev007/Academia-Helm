/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - DIRECTOR VALIDATION (ENGLISH TRACK)
 * ============================================================================
 * Duplicate of the FR Director Validation, but for the English language track.
 * All labels are in English. Sub-tabs: Dashboard + Attendance Register only.
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { DirectorPedagogyControlEN } from '@/components/pedagogy/production-en/DirectorPedagogyControlEN';

export default function ControlENPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Director Validation',
        description: academicYear
          ? `Institutional supervision and compliance audit — year ${academicYear.label}`
          : 'Pedagogical oversight, approvals and predictive intelligence',
        icon: 'shieldCheck'
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
        activeModuleId: 'control-en',
      }}
      content={{
        layout: 'custom',
        children: <DirectorPedagogyControlEN />,
      }}
    />
  );
}
