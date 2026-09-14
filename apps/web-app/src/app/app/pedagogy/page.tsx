/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE & ÉTUDES — TABLEAU DE BORD
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';
import PedagogyModuleDashboard from '@/components/pedagogy/PedagogyModuleDashboard';
// ⭐ P4-final : en-tête et onglets bilingues (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

export default function PedagogyPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();
  const L = useL();

  // Filtrage permissif (fail-open) : voir tabMatchesRole dans pedagogy-tabs.tsx
  const visibleTabs = pedagogyVisibleTabs;

  const navModules = visibleTabs.map((tab) => {
    const Icon = tab.icon;
    return {
      id: tab.id,
      label: L(tab.label, tab.labelEn || tab.label),
      href: tab.path,
      icon: <Icon className="h-4 w-4" />,
    };
  });

  return (
    <ModuleContainer
      header={{
        title: L("Organisation Pédagogique & Études", "Pedagogical Organisation & Studies"),
        description: L(
          "Vue consolidée : complétion, affectations, structure, workflow documents et veille ORION",
          "Consolidated view: completion, assignments, structure, document workflow and ORION monitoring",
        ),
        icon: 'bookOpen',
      }}
      subModules={{
        modules: navModules,
      }}
      content={{
        layout: 'custom',
        children: <PedagogyModuleDashboard />,
      }}
    />
  );
}
