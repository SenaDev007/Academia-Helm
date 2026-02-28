/**
 * MODULE 4 - PARAMÉTRAGE & AUDIT
 * Seuil blocage impayé, autorisation annulation, limite modification encaissement, historique, rôles accès finance, Fedapay.
 */
'use client';

import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

export default function FinanceSettingsPage() {
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Paramétrage & Audit"
        description="Seuil blocage impayé, autorisation annulation paiement, limite modification encaissement, historique complet, rôles accès finance, paramétrage Fedapay."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/settings" />
      <ModuleContentArea layout="custom">
        <p className="text-gray-600">
          Gouvernance financière : seuil blocage | Annulation (comptable &lt; 24h, directeur &gt; 24h) | Historique complet | Rôles accès | Fedapay.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Aucune suppression destructive ; toute modification → audit log ; année clôturée → modification interdite.
        </p>
      </ModuleContentArea>
    </div>
  );
}
