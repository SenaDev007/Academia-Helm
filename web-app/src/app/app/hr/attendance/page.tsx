'use client';

import { HRShell } from '../_components/HRShell';
import { AttendanceWorkspace } from '../_components/workspaces/AttendanceWorkspace';

export default function AttendancePage() {
  return (
    <HRShell
      activeId="attendance"
      title="Suivi des Présences"
      description="Suivi journalier des présences, absences et heures supplémentaires du personnel."
    >
      <AttendanceWorkspace />
    </HRShell>
  );
}
