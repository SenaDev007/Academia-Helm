/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - ENSEIGNANTS ACADÉMIQUES
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import TeachersAcademicWorkspace from '@/components/pedagogy/teachers/TeachersAcademicWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TeachersPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Enseignants & Affectations',
        description: academicYear
          ? `Profils académiques, habilitations, affectations par classe et charge globale — année ${academicYear.label}`
          : 'Gestion unifiée du corps enseignant et des charges de cours',
        icon: 'users',
        kpis: [
          { label: 'Effectif', value: '24', trend: 'Stable', trendType: 'neutral' },
          { label: 'Habilités', value: '18', trend: '+2', trendType: 'up' },
          { label: 'Charge Moy.', value: '16h', trend: '-1h', trendType: 'down' },
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
        activeModuleId: 'teachers-academic',
      }}
      content={{
        layout: 'custom',
        children: <TeachersAcademicWorkspace />,
      }}
    />
  );
}
