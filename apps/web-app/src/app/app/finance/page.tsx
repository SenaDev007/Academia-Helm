/**
 * ============================================================================
 * MODULE 4 - FINANCES & ÉCONOMAT - PAGE PRINCIPALE (Dashboard pilotage)
 * ============================================================================
 * 8 sous-modules : Configuration frais, Comptes élèves, Encaissements,
 * Recouvrement, Dépenses, Clôture & Trésorerie, Rapports, Paramétrage & Audit
 * ============================================================================
 */

'use client';

import { useRouter } from 'next/navigation';
import { ModuleContainer } from '@/components/modules/blueprint';
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import { Button } from '@/components/ui/button';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

export default function FinancePage() {
  const router = useRouter();
  
  const subModulesList = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.path,
    icon: t.icon,
  }));

  return (
    <ModuleContainer
      header={{
        title: 'Finances & Économat',
        description:
          'Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage.',
        icon: 'finance',
        actions: (
          <>
            <Button onClick={() => router.push('/app/finance/payments')}>
              Nouveau paiement
            </Button>
            <Button variant="outline" onClick={() => router.push('/app/finance/expenses')}>
              Nouvelle dépense
            </Button>
          </>
        ),
      }}
      subModules={{
        modules: subModulesList,
        activeModuleId: 'dashboard',
      }}
      content={{
        layout: 'custom',
        children: <FinanceDashboard />,
      }}
    />
  );
}
