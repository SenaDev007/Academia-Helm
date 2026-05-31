'use client';

import { HRShell } from '../_components/HRShell';
import { ReportingWorkspace } from '../_components/workspaces/ReportingWorkspace';

export default function ReportingPage() {
  return (
    <HRShell
      activeId="reporting"
      title="Rapports & Analyses"
      description="Cockpit analytique pour le suivi de la masse salariale, de la CNSS et des effectifs."
    >
      <ReportingWorkspace />
    </HRShell>
  );
}
