/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE - CONTRÔLE DIRECTION & ORION
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import ControlWorkspace from '@/components/pedagogy/control/ControlWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ControlPage() {
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Contrôle direction & ORION',
        description: academicYear
          ? `Supervision institutionnelle et audit de conformité — année ${academicYear.label}`
          : 'Pilotage pédagogique global, approbations et intelligence prédictive ORION',
        icon: 'shieldCheck',
        kpis: [
          { label: 'Indice Qualité', value: 'A-', trend: '+0.2', trendType: 'up' },
          { label: 'Risques Détectés', value: '3', trend: '-2', trendType: 'down' },
          { label: 'Attente Visas', value: '14', trend: '+5', trendType: 'up' },
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
        activeModuleId: 'control',
      }}
      content={{
        layout: 'custom',
        children: <ControlWorkspace />,
      }}
    />
  );
}
