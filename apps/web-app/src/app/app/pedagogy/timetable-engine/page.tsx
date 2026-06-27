import { redirect } from 'next/server';

/**
 * /app/pedagogy/timetable-engine → /app/pedagogy/timetables
 * Le STE V2+ est intégré dans l'onglet Emploi du temps (6 sous-onglets).
 */
export default function TimetableEngineRedirect() {
  redirect('/app/pedagogy/timetables');
}
