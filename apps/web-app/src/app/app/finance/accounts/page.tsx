/**
 * MODULE 4 - COMPTES ÉLÈVES
 * Visualisation solde, détail des frais, régime appliqué, arriérés, historique paiements, blocage.
 */
'use client';

import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

export default function FinanceAccountsPage() {
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Comptes élèves"
        description="Consultez les comptes financiers par élève : solde, frais, régime, arriérés et historique des paiements."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/accounts" />
      <ModuleContentArea layout="custom">
        <p className="text-gray-600">
          Filtres : Année | Classe | Statut paiement. Table : Élève | Total dû | Payé | Solde | Statut.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          À brancher sur l’API comptes élèves (PaymentSummary / StudentFee par année).
        </p>
      </ModuleContentArea>
    </div>
  );
}
