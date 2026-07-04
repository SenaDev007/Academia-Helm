import { redirect } from 'next/navigation';

/**
 * ============================================================================
 * /app/pedagogy/timetable-engine → /app/pedagogy/timetables
 * ============================================================================
 *
 * Le Smart Timetable Engine (STE) a été intégré directement dans l'onglet
 * "Emploi du temps" (Pédagogie > Emploi du temps). L'ancienne page autonome
 * /timetable-engine est maintenant redirigée vers /timetables, où l'utilisateur
 * retrouve les 5 sous-onglets STE :
 *   1. Configuration
 *   2. Disponibilités (grille enseignant × jour × créneau)
 *   3. Génération (moteur CSP V2)
 *   4. Solutions (scores + grille)
 *   5. Édition manuelle (ancien éditeur visuel)
 * ============================================================================
 */
export default function TimetableEngineRedirect() {
  redirect('/app/pedagogy/timetables');
}
