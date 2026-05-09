/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - PRODUCTION PÉDAGOGIQUE
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import ProductionWorkspace from '@/components/pedagogy/production/ProductionWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ProductionPage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Production pédagogique',
        description: academicYear
          ? `Cahiers de textes et programmations — année ${academicYear.label}`
          : 'Espace de travail enseignant : fiches, cahiers et suivi de progression',
        icon: 'bookOpen',
        kpis: [
          { label: 'Séances Saisies', value: '142', trend: '+12', trendType: 'up' },
          { label: 'Couverture Moy.', value: '64%', trend: '+4%', trendType: 'up' },
          { label: 'Retards Saisie', value: '2', trend: '-5', trendType: 'down' },
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
        activeId: 'pedagogical-production',
      }}
      content={{
        layout: 'custom',
        children: <ProductionWorkspace />,
      }}
    />
  );
}
