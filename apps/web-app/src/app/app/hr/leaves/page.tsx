'use client';

import { HRShell } from '../_components/HRShell';
import { LeavesWorkspace } from '../_components/workspaces/LeavesWorkspace';

export default function LeavesPage() {
  return (
    <HRShell
      activeId="leaves"
      title="Congés & Absences"
      titleEn="Leaves & Absences"
      description="Gestion des demandes de congé, suivi des absences et validation hiérarchique."
      descriptionEn="Leave request management, absence tracking and hierarchical validation."
    >
      <LeavesWorkspace />
    </HRShell>
  );
}
