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

export default function FinancePage() {
  const router = useRouter();
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
      content={{
        layout: 'custom',
        children: <FinanceDashboard />,
      }}
    />
  );
}
