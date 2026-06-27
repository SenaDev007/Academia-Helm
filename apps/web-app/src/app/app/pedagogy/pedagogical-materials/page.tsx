/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATÉRIEL PÉDAGOGIQUE
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import MaterialsWorkspace from '@/components/pedagogy/materials/MaterialsWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function MaterialsPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Matériel pédagogique',
        description: academicYear
          ? `Gestion de l'inventaire et des ressources physiques — année ${academicYear.label}`
          : 'Suivi des stocks, des affectations et de la maintenance du matériel',
        icon: 'package'
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
        activeModuleId: 'pedagogical-materials',
      }}
      content={{
        layout: 'custom',
        children: <MaterialsWorkspace />,
      }}
    />
  );
}
