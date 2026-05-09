/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - AFFECTATIONS & CHARGES
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import AssignmentsWorkspace from '@/components/pedagogy/assignments/AssignmentsWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function AssignmentsPage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Affectations & Charges',
        description: academicYear
          ? `Attribution des enseignants aux matières par classe — année ${academicYear.label}`
          : 'Organisation des binômes pédagogiques et contrôle des volumes horaires',
        icon: 'clipboardList',
        kpis: [
          { label: 'Taux Affectation', value: '65%', trend: '+12%', trendType: 'up' },
          { label: 'Heures Total', value: '420h', trend: 'Stable', trendType: 'neutral' },
          { label: 'Surcharges', value: '0', trend: '-2', trendType: 'down' },
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
        activeId: 'assignments',
      }}
      content={{
        layout: 'custom',
        children: <AssignmentsWorkspace />,
      }}
    />
  );
}
