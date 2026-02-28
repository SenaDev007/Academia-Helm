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
import { ModuleHeader } from '@/components/modules/blueprint';
import FinanceDashboard from '@/components/finance/FinanceDashboard';

export default function FinancePage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Finances & Économat"
        description="Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage."
        icon="finance"
        actions={[
          { label: 'Nouveau paiement', onClick: () => router.push('/app/finance/payments'), primary: true },
          { label: 'Nouvelle dépense', onClick: () => router.push('/app/finance/expenses') },
        ]}
      />
      <FinanceDashboard />
    </div>
  );
}
