'use client';

import { HRShell } from '../_components/HRShell';
import { LeavesWorkspace } from '../_components/workspaces/LeavesWorkspace';

export default function LeavesPage() {
  return (
    <HRShell
      activeId="leaves"
      title="Congés & Absences"
      description="Gestion des demandes de congé, suivi des absences et validation hiérarchique."
    >
      <LeavesWorkspace />
    </HRShell>
  );
}
