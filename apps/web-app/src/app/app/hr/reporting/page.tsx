'use client';

import { HRShell } from '../_components/HRShell';
import { ReportingWorkspace } from '../_components/workspaces/ReportingWorkspace';

export default function ReportingPage() {
  return (
    <HRShell
      activeId="reporting"
      title="Rapports & Analyses"
      titleEn="Reports & Analytics"
      description="Cockpit analytique pour le suivi de la masse salariale, de la CNSS et des effectifs."
      descriptionEn="Analytical cockpit for payroll mass, CNSS and headcount monitoring."
    >
      <ReportingWorkspace />
    </HRShell>
  );
}
