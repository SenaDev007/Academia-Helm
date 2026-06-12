'use client';

import { HRShell } from '../_components/HRShell';
import { RecruitmentWorkspace } from '../_components/workspaces/RecruitmentWorkspace';

export default function RecruitmentPage() {
  return (
    <HRShell
      activeId="recruitment"
      title="Recrutement"
      description="Helm Talent Intelligence Platform (HTIP) — Publiez des offres, gérez les candidatures et planifiez les entretiens."
    >
      <RecruitmentWorkspace />
    </HRShell>
  );
}
