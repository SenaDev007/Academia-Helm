'use client';

import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

export default function FinanceReportsPage() {
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Rapports financiers"
        description="Encaissement par période et par classe, recouvrement global, dépenses par catégorie, prévision trésorerie, comparatif années."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/reports" />
      <ModuleContentArea layout="custom">
        <p className="text-gray-600">
          Rapports : Encaissement par période | Par classe | Recouvrement global | Dépenses par catégorie | Prévision trésorerie | Comparatif années.
        </p>
      </ModuleContentArea>
    </div>
  );
}
