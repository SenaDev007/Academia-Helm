'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — PLANIFICATION ANNUELLE
 * ============================================================================
 *
 * Reproduction exacte de l'UI enseignant : la page Planification annuelle
 * existante (lecture seule, maternelle + CI→CM2, export PDF) est réutilisée
 * telle quelle — elle résout l'année depuis le contexte académique.
 */

import TeacherAnnualPlanningPage from '@/app/app/teacher/annual-planning/page';

export default function ProfPlanificationPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <TeacherAnnualPlanningPage />
    </div>
  );
}
