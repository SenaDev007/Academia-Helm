'use client';

import { HRShell } from '../_components/HRShell';
import { RecruitmentWorkspace } from '../_components/workspaces/RecruitmentWorkspace';

export default function RecruitmentPage() {
  return (
    <HRShell
      activeId="recruitment"
      title="Recrutement"
      description="Plateforme d'Intelligence de Talents Helm (HTIP) — Publiez des offres, gérez les candidatures et planifiez les entretiens."
    >
      <RecruitmentWorkspace />
    </HRShell>
  );
}
