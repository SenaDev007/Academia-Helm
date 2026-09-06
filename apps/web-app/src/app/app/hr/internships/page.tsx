'use client';

import { HRShell } from '../_components/HRShell';
import { InternshipsWorkspace } from '../_components/workspaces/InternshipsWorkspace';

export default function InternshipsPage() {
  return (
    <HRShell
      activeId="internships"
      title="Stagiaires & Conventions de stage"
      description="Flux stage séparé de l'embauche salariée (Décret n°2018-196) — gratification, tuteur, assurance accident du travail obligatoire."
    >
      <InternshipsWorkspace />
    </HRShell>
  );
}
