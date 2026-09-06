'use client';

import { HRShell } from '../_components/HRShell';
import { PlanningWorkspace } from '../_components/workspaces/PlanningWorkspace';

export default function PlanningPage() {
  return (
    <HRShell
      activeId="planning"
      title="Plannings & Horaires"
      titleEn="Plannings & Schedules"
      description="Gestion des tours de garde, permanences et plannings du personnel."
      descriptionEn="Management of duty rosters, on-call shifts and staff plannings."
    >
      <PlanningWorkspace />
    </HRShell>
  );
}
