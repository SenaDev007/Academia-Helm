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

export default function PedagogyPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  // Filtrage permissif (fail-open) : voir tabMatchesRole dans pedagogy-tabs.tsx
  const visibleTabs = getVisiblePedagogyTabs(userRole);

  const navModules = visibleTabs.map((tab) => {
    const Icon = tab.icon;
    return {
      id: tab.id,
      label: tab.label,
      href: tab.path,
      icon: <Icon className="h-4 w-4" />,
    };
  });

  return (
    <ModuleContainer
      header={{
        title: 'Organisation Pédagogique & Études',
        description:
          'Vue consolidée : complétion, affectations, structure, workflow documents et veille ORION',
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
