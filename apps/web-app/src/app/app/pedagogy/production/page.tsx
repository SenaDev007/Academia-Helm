/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - PRODUCTION PÉDAGOGIQUE
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import { PedagogicalSpaceWorkspace } from '@/components/pedagogy/production/PedagogicalSpaceWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ProductionPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Espace Pédagogique',
        description: academicYear
          ? `Espace enseignant — année ${academicYear.label}`
          : 'Mes classes, cahier journal, devoirs et suivi pédagogique',
        icon: 'bookOpen'
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
        activeModuleId: 'production',
      }}
      content={{
        layout: 'custom',
        children: <PedagogicalSpaceWorkspace />,
      }}
    />
  );
}
