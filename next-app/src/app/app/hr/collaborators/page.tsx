'use client';

import { HRShell } from '../_components/HRShell';
import { CollaboratorsWorkspace } from '../_components/workspaces/CollaboratorsWorkspace';

export default function CollaboratorsPage() {
  return (
    <HRShell
      activeId="collaborators"
      title="Collaborateurs"
      description="Gestion des fiches de personnel, contrats, affectations et organigramme."
    >
      <CollaboratorsWorkspace />
    </HRShell>
  );
}
