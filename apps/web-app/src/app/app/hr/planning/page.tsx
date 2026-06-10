'use client';

import { HRShell } from '../_components/HRShell';
import { PlanningWorkspace } from '../_components/workspaces/PlanningWorkspace';

export default function PlanningPage() {
  return (
    <HRShell
      activeId="planning"
      title="Plannings & Horaires"
      description="Gestion des tours de garde, permanences et plannings du personnel."
    >
      <PlanningWorkspace />
    </HRShell>
  );
}
