'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — TRAVAUX & SUIVI
 * ============================================================================
 *
 * Reproduction de l'UI enseignant : le workspace travaux existant est
 * branché tel quel (devoirs, leçons, recherches, soumissions). Il résout
 * seul l'enseignant et l'année depuis les contexts (même pile que /app).
 */

import TeacherTasksWorkspace from '@/components/pedagogy/tasks/TeacherTasksWorkspace';

export default function ProfTravauxPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <TeacherTasksWorkspace />
    </div>
  );
}
