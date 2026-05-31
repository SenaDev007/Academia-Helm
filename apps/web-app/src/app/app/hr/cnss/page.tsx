'use client';

import { HRShell } from '../_components/HRShell';
import { CnssWorkspace } from '../_components/workspaces/CnssWorkspace';

export default function CnssPage() {
  return (
    <HRShell
      activeId="cnss"
      title="Déclarations CNSS"
      description="Déclarations et cotisations de sécurité sociale pour la part salariale et patronale."
    >
      <CnssWorkspace />
    </HRShell>
  );
}
