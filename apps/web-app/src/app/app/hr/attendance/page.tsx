'use client';

import { HRShell } from '../_components/HRShell';
import { AttendanceWorkspace } from '../_components/workspaces/AttendanceWorkspace';

export default function AttendancePage() {
  return (
    <HRShell
      activeId="attendance"
      title="Suivi des Présences"
      titleEn="Attendance Tracking"
      description="Suivi journalier des présences, absences et heures supplémentaires du personnel."
      descriptionEn="Daily tracking of staff attendance, absences and overtime."
    >
      <AttendanceWorkspace />
    </HRShell>
  );
}
