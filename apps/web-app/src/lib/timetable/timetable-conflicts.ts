/**
 * ============================================================================
 * TIMETABLE CONFLICTS — Helper frontend pour détection de conflits
 * ============================================================================
 *
 * Utilitaires pour vérifier les conflits d'emploi du temps côté frontend.
 * Communique avec le backend POST /api/timetables/check-conflict (dry-run).
 * ============================================================================
 */

export interface TimetableConflictEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
  subjectName?: string;
}

export interface TimetableConflict {
  type: 'CLASS' | 'TEACHER' | 'ROOM';
  message: string;
  conflictingEntry: TimetableConflictEntry;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: TimetableConflict[];
}

export interface ConflictCheckParams {
  timetableId?: string;
  classId?: string;
  teacherId?: string;
  roomId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeEntryId?: string;
}

/**
 * Vérifie les conflits côté backend (dry-run).
 * À appeler avec un debounce dans le frontend pour éviter trop de requêtes.
 */
export async function checkTimetableConflicts(
  params: ConflictCheckParams,
): Promise<ConflictCheckResult> {
  try {
    const res = await fetch('/api/timetables/check-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn('[checkTimetableConflicts] HTTP', res.status);
      return { hasConflict: false, conflicts: [] };
    }

    const data = await res.json();
    return {
      hasConflict: !!data.hasConflict,
      conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
    };
  } catch (err: any) {
    console.warn('[checkTimetableConflicts] Error:', err.message);
    return { hasConflict: false, conflicts: [] };
  }
}

/**
 * Formate un conflit pour affichage.
 */
export function formatConflict(c: TimetableConflict): string {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const day = days[c.conflictingEntry.dayOfWeek] || '?';
  return `${c.message} — ${day} ${c.conflictingEntry.startTime}-${c.conflictingEntry.endTime}`;
}

/**
 * Couleur par type de conflit (pour UI).
 */
export const CONFLICT_COLORS: Record<TimetableConflict['type'], string> = {
  CLASS: 'bg-red-100 text-red-700 border-red-300',
  TEACHER: 'bg-orange-100 text-orange-700 border-orange-300',
  ROOM: 'bg-purple-100 text-purple-700 border-purple-300',
};

export const CONFLICT_LABELS: Record<TimetableConflict['type'], string> = {
  CLASS: 'Classe',
  TEACHER: 'Enseignant',
  ROOM: 'Salle',
};
