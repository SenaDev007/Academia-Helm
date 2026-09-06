'use client';

import { HRShell } from '../_components/HRShell';
import { CollaboratorsWorkspace } from '../_components/workspaces/CollaboratorsWorkspace';

export default function CollaboratorsPage() {
  return (
    <HRShell
      activeId="collaborators"
      title="Collaborateurs"
      titleEn="Staff Members"
      description="Gestion des fiches de personnel, contrats, affectations et organigramme."
      descriptionEn="Staff records, contracts, assignments and organisation chart management."
    >
      <CollaboratorsWorkspace />
    </HRShell>
  );
}
