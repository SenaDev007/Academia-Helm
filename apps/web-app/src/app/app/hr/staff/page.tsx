'use client';

import { HRShell } from '../_components/HRShell';
import { StaffWorkspace } from '../_components/workspaces/StaffWorkspace';

export default function StaffPage() {
  return (
    <HRShell
      activeId="staff"
      title="Personnel"
      description="Gestion des collaborateurs, fiches individuelles, matricules et documents RH."
    >
      <StaffWorkspace />
    </HRShell>
  );
}
