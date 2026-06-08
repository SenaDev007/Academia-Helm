/**
 * ============================================================================
 * HR SHELL — Wrapper partagé pour tous les sous-modules RH
 * Même pattern que ModuleContainer dans le module pédagogie.
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { HR_SUBMODULE_TABS } from '../hr-tabs';

interface HRShellProps {
  activeId: string;
  title: string;
  description?: string;
  kpis?: Array<{ label: string; value: string | number; unit?: string }>;
  children: ReactNode;
}

export function HRShell({ activeId, title, description, kpis, children }: HRShellProps) {
  const modules = HR_SUBMODULE_TABS.map((tab) => {
    const Icon = tab.icon;
    return {
      id: tab.id,
      label: tab.label,
      href: tab.path,
      icon: <Icon className="w-4 h-4" />,
    };
  });

  return (
    <ModuleContainer
      header={{
        title,
        description,
        icon: 'rh',
        kpis,
      }}
      subModules={{
        modules,
        activeModuleId: activeId,
      }}
      content={{
        layout: 'custom',
        children,
      }}
    />
  );
}
