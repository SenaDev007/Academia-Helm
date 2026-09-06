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
// ⭐ P4-final : shell RH bilingue (piste EN → onglets 100% EN)
import { useL } from '@/lib/i18n/bilingual';

interface HRShellProps {
  activeId: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  kpis?: Array<{ label: string; value: string | number; unit?: string }>;
  children: ReactNode;
}

export function HRShell({ activeId, title, titleEn, description, descriptionEn, kpis, children }: HRShellProps) {
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  const modules = HR_SUBMODULE_TABS.map((tab) => {
    const Icon = tab.icon;
    return {
      id: tab.id,
      label: L(tab.label, (tab as { labelEn?: string }).labelEn || tab.label),
      href: tab.path,
      icon: <Icon className="w-4 h-4" />,
    };
  });

  return (
    <ModuleContainer
      header={{
        title: L(title, titleEn || title),
        description: description ? L(description, descriptionEn || description) : undefined,
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
