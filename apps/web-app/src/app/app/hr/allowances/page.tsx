'use client';

import { HRShell } from '../_components/HRShell';
import { AllowancesWorkspace } from '../_components/workspaces/AllowancesWorkspace';

export default function AllowancesPage() {
  return (
    <HRShell
      activeId="allowances"
      title="Primes & Indemnités"
      description="Gestion et affectation des indemnités de transport, logement et fonctions du personnel."
    >
      <AllowancesWorkspace />
    </HRShell>
  );
}
