'use client';

import { HRShell } from '../_components/HRShell';
import { RecruitmentWorkspace } from '../_components/workspaces/RecruitmentWorkspace';

export default function EmbauchePage() {
  return (
    <HRShell
      activeId="embauche"
      title="Embauche"
      description="Finalisez l'embauche de vos candidats éligibles : préparation et signature des contrats, envoi des emails d'embauche."
    >
      <RecruitmentWorkspace initialTab="embauches" />
    </HRShell>
  );
}
