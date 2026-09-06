'use client';

import { HRShell } from '../_components/HRShell';
import { ContractsWorkspace } from '../_components/workspaces/ContractsWorkspace';

export default function ContractsPage() {
  return (
    <HRShell
      activeId="contracts"
      title="Contrats"
      titleEn="Contracts"
      description="Suivi des contrats, avenants, échéances et historique contractuel."
      descriptionEn="Contract tracking, amendments, deadlines and contractual history."
    >
      <ContractsWorkspace />
    </HRShell>
  );
}
