'use client';

import { HRShell } from '../_components/HRShell';
import { InternshipsWorkspace } from '../_components/workspaces/InternshipsWorkspace';

export default function InternshipsPage() {
  return (
    <HRShell
      activeId="internships"
      title="Stagiaires & Conventions de stage"
      titleEn="Interns & Internship Agreements"
      description="Flux stage séparé de l'embauche salariée (Décret n°2018-196) — gratification, tuteur, assurance accident du travail obligatoire."
      descriptionEn="Separate internship flow from salaried hiring (Decree No. 2018-196) — compensation, supervisor, mandatory work accident insurance."
    >
      <InternshipsWorkspace />
    </HRShell>
  );
}
