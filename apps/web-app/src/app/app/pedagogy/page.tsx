/**
 * ============================================================================
 * MODULE 2 : ORGANISATION PÉDAGOGIQUE & ÉTUDES — TABLEAU DE BORD
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import PedagogyModuleDashboard from '@/components/pedagogy/PedagogyModuleDashboard';
import { useAppSession } from '@/contexts/AppSessionContext';
// ⭐ P4-final : en-tête et onglets bilingues (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';

export default function PedagogyPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const L = useL();

  // Filtrage permissif (fail-open) : voir tabMatchesRole dans pedagogy-tabs.tsx
  const visibleTabs = getVisiblePedagogyTabs(userRole);

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
