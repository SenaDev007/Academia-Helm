'use client';

import { HRShell } from '../_components/HRShell';
import { ContractsWorkspace } from '../_components/workspaces/ContractsWorkspace';

export default function ContractsPage() {
  return (
    <HRShell
      activeId="contracts"
      title="Contrats"
      description="Suivi des contrats, avenants, échéances et historique contractuel."
    >
      <ContractsWorkspace />
    </HRShell>
  );
}
