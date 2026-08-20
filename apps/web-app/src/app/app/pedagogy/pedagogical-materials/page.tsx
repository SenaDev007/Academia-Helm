/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - MATÉRIEL PÉDAGOGIQUE
 * ============================================================================
 *
 * Refonte 2026-08-20 — 4 sous-onglets :
 *   1. Inventaire (catalogue + stocks)
 *   2. Distribution aux enseignants (affectations)
 *   3. Retour (soumissions à valider par la direction)
 *   4. Historique (vue annuelle filtrable)
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';
import { PedagogicalMaterialsDashboard } from '@/components/pedagogy/materials/PedagogicalMaterialsDashboard';
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
          ? `Inventaire, distribution aux enseignants, retours et historique — année ${academicYear.label}`
          : 'Gestion de l\'inventaire et des ressources physiques',
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
        children: <PedagogicalMaterialsDashboard />,
      }}
    />
  );
}
