/**
 * ============================================================================
 * RÉCEPTION DES ÉPREUVES D'ÉVALUATION — Page Secrétariat
 * ============================================================================
 *
 * Module du portail SECRÉTAIRE (et SECRÉTAIRE-COMPTABLE) :
 * les épreuves d'évaluation envoyées par les enseignants (après validation de
 * la direction) arrivent ici — hiérarchisées par CLASSE, TRIMESTRE et MOIS.
 * Le secrétariat peut visualiser chaque épreuve et lancer l'impression.
 *
 * La page hérite du shell du portail selon le rôle (app/app/layout.tsx →
 * AdminPortalShell) — aucune duplication d'UI.
 * ============================================================================
 */

'use client';

import { ExamReceptionWorkspace } from '@/components/pedagogy/exam-preparation/ExamReceptionWorkspace';

export default function ExamReceptionPage() {
  return <ExamReceptionWorkspace />;
}
