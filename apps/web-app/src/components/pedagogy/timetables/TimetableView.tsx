/**
 * ============================================================================
 * TIMETABLE VIEW — Composant lecture-seule réutilisable
 * ============================================================================
 *
 * Affiche la grille d'emploi du temps EXACTEMENT comme dans le director UI
 * (TimetablesWorkspace → onglet "Emploi du temps" → ManualEditor).
 *
 * Utilisé par :
 *   - /app/teacher/timetable (UI enseignant)
 *   - /app/parent/timetable (UI parent)
 *
 * Le director UI garde sa propre version éditable (avec inline form, boutons
 * + pour ajouter des séances, boutons X pour supprimer). Ce composant est
 * strictement LECTURE-SEULE — pas d'édition.
 *
 * Le composant prend en entrée :
 *   - entries : les séances à afficher (déjà filtrées par classe)
 *   - timetable : l'objet timetable (pour récupérer schoolLevelId + academicYearId)
 *   - optional : className pour override CSS
 *
 * Il fetch automatiquement la config (schoolDays + timeBlocks) via
 * /api/timetable-engine/config?schoolLevelId=X&academicYearId=Y
 * ===========================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Calendar, Coffee, Utensils, BookOpen, Users, Loader2, X,
} from 'lucide-react';
import { BeninFlag } from '@/components/ui/BeninFlag';
import { cn } from '@/lib/utils';

const DAYS = [
  { value: 1, label: 'Lundi' }, { value: 2, label: 'Mardi' }, { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' }, { value: 5, label: 'Vendredi' }, { value: 6, label: 'Samedi' }, { value: 7, label: 'Dimanche' },
];

const DEFAULT_TIME_BLOCKS = [
  { start: '08:00', end: '10:00', type: 'BLOCK' },
  { start: '10:00', end: '10:15', type: 'BREAK' },
  { start: '10:15', end: '12:15', type: 'BLOCK' },
  { start: '12:15', end: '14:00', type: 'LUNCH' },
  { start: '14:00', end: '16:00', type: 'BLOCK' },
  { start: '16:00', end: '16:15', type: 'BREAK' },
  { start: '16:15', end: '18:00', type: 'BLOCK' },
];

const SUBJECT_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
  'bg-purple-50 border-purple-200 text-purple-700',
  'bg-cyan-50 border-cyan-200 text-cyan-700',
];

function safeParse(value: any): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function fmtTime(t: string | null | undefined): string {
  if (!t || typeof t !== 'string') return '';
  const [h, m] = t.split(':');
  if (!h || !m) return t;
  return `${parseInt(h, 10)}h${m}`;
}

export interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  duration?: number;
  subjectId?: string;
  subjectName?: string;
  subjectCode?: string;
  classId?: string;
  officialClassId?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
  notes?: string;
  step?: string;
}

interface TimetableViewProps {
  /** Les entries déjà filtrées pour la classe à afficher */
  entries: TimetableEntry[];
  /** Le timetable (pour récupérer schoolLevelId + academicYearId et fetch la config) */
  timetable: { schoolLevelId: string; academicYearId: string; name?: string };
  /** Classes complémentaires (CSS) */
  className?: string;
}

export default function TimetableView({ entries, timetable, className }: TimetableViewProps) {
  const [configSchoolDays, setConfigSchoolDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [configTimeBlocks, setConfigTimeBlocks] = useState<any[]>(DEFAULT_TIME_BLOCKS);
  const [configLoading, setConfigLoading] = useState(true);

  // Fetch config (schoolDays + timeBlocks) via /api/timetable-engine/config
  // ⭐ Le timetable.schoolLevelId est un UUID `school_levels` (table school_levels).
  //    Mais timetable_configs est indexé par UUID `education_levels` (table différente).
  //    On doit RÉSOUDRE la correspondance school_levels → education_levels via
  //    l'API /api/school-levels qui renvoie les deux UUIDs pour chaque niveau.
  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    (async () => {
      try {
        // ⭐ ÉTAPE 1 : Fetch school-levels pour résoudre schoolLevelId → educationLevelId
        const slRes = await fetch('/api/school-levels', { credentials: 'include' });
        if (!slRes.ok) throw new Error('Failed to fetch school-levels');
        const slData = await slRes.json();
        const slList = Array.isArray(slData) ? slData : [];
        // Trouver le SchoolLevel dont schoolLevelId === timetable.schoolLevelId
        // (timetable.schoolLevelId = school_levels UUID)
        // (sl.schoolLevelId = school_levels UUID, sl.id = education_levels UUID)
        const match = slList.find((sl: any) => sl.schoolLevelId === timetable.schoolLevelId);
        // Fallback : si pas de match via schoolLevelId, on essaie sl.id === timetable.schoolLevelId
        // (au cas où le timetable aurait un education_levels UUID direct)
        const educationLevelId = match?.id || slList.find((sl: any) => sl.id === timetable.schoolLevelId)?.id || timetable.schoolLevelId;
        if (cancelled) return;

        // ⭐ ÉTAPE 2 : Fetch la config avec le bon UUID (education_levels)
        const ts = Date.now();
        const res = await fetch(
          `/api/timetable-engine/config?schoolLevelId=${educationLevelId}&academicYearId=${timetable.academicYearId}&_t=${ts}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data) {
          const days = Array.isArray(data.schoolDays) ? data.schoolDays : safeParse(data.schoolDays);
          if (Array.isArray(days) && days.length > 0) setConfigSchoolDays(days);
          const blocks = Array.isArray(data.timeBlocks) ? data.timeBlocks : safeParse(data.timeBlocks);
          if (Array.isArray(blocks) && blocks.length > 0) setConfigTimeBlocks(blocks);
        }
      } catch (e) {
        console.warn('[TimetableView] Failed to fetch config:', e);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [timetable.schoolLevelId, timetable.academicYearId]);

  const configuredDays = DAYS.filter(d => configSchoolDays.includes(d.value));

  // ⭐ Entries d'une cellule (jour + block)
  const getCellEntries = (dayOfWeek: number, block: any) => {
    return entries.filter(e =>
      e.dayOfWeek === dayOfWeek && e.startTime >= block.start && e.endTime <= block.end
    );
  };

  // Couleurs cycliques pour les matières
  const getSubjectColor = (subjectId?: string) => {
    if (!subjectId) return SUBJECT_COLORS[0];
    const idx = entries.findIndex(e => e.subjectId === subjectId);
    return SUBJECT_COLORS[Math.abs(idx) % SUBJECT_COLORS.length];
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Chargement de l'emploi du temps…</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Aucun emploi du temps disponible</p>
        <p className="text-xs text-slate-400 mt-1">
          La direction n'a pas encore configuré l'emploi du temps de cette classe.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm', className)}>
      <table className="w-full text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left text-xs font-bold text-slate-700 border border-slate-200 w-20">Horaire</th>
            {configuredDays.map(d => (
              <th key={d.value} className="p-2 text-center text-xs font-bold text-slate-700 border border-slate-200 min-w-[140px]">
                {d.label.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {configTimeBlocks.map((block, blockIdx) => {
            const isBreak = block.type !== 'BLOCK';
            const breakLabel =
              block.type === 'LUNCH' ? 'Déjeuner' :
              block.type === 'BREAK' ? 'Récréation' :
              block.type === 'RECESS' ? 'Récréation' :
              block.type === 'CEREMONY' ? 'Cérémonial des couleurs / Hymne national' :
              block.type === 'STUDY' ? 'Étude' :
              block.type === 'ACTIVITY' ? 'Activité' :
              block.type === 'ASSEMBLY' ? 'Assemblée' :
              block.type || '';
            const BreakIcon =
              block.type === 'LUNCH' ? Utensils :
              block.type === 'STUDY' ? BookOpen :
              block.type === 'ACTIVITY' || block.type === 'ASSEMBLY' ? Users :
              Coffee;

            // ⭐ CEREMONY : SKIP — rendu à l'intérieur des cellules BLOCK
            if (isBreak && block.type === 'CEREMONY') return null;

            if (isBreak) {
              return (
                <tr key={blockIdx} className="bg-amber-50/50">
                  <td className="p-2 border border-slate-200 text-center whitespace-nowrap">
                    <span className="text-[10px] font-bold text-slate-500">
                      {fmtTime(block.start)}-{fmtTime(block.end)}
                    </span>
                  </td>
                  <td colSpan={configuredDays.length} className="p-2 border border-slate-200 text-center">
                    <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1">
                      <BreakIcon className="w-3 h-3" />
                      {breakLabel}
                    </span>
                  </td>
                </tr>
              );
            }

            // ⭐ Cérémonial intégré dans la cellule BLOCK
            const ceremonyInThisBlock = configTimeBlocks.filter(
              (b: any) => b.type === 'CEREMONY' && b.start >= block.start && b.end <= block.end
            );

            return (
              <tr key={blockIdx}>
                <td className="p-2 border border-slate-200 bg-slate-50 text-center whitespace-nowrap">
                  <span className="text-[11px] font-bold text-slate-700">
                    {fmtTime(block.start)}-{fmtTime(block.end)}
                  </span>
                </td>
                {configuredDays.map(day => {
                  const cellEntries = getCellEntries(day.value, block);
                  return (
                    <td key={day.value} className="p-1 border border-slate-200 align-top" style={{ minHeight: '60px' }}>
                      {/* ⭐ Cérémonial des couleurs intégré en haut de cellule */}
                      {ceremonyInThisBlock.map(cer => {
                        const cerDays = Array.isArray(cer.activeDays) ? cer.activeDays : configSchoolDays;
                        if (!cerDays.includes(day.value)) return null;
                        return (
                          <div
                            key={`cer-${cer.start}`}
                            className="bg-orange-50 border border-orange-300 rounded-md px-1.5 py-0.5 mb-0.5 flex items-center gap-1"
                            style={{ minHeight: '24px' }}
                          >
                            <BeninFlag size={12} />
                            <span className="text-[10px] font-bold text-orange-700 truncate">
                              {fmtTime(cer.start)}-{fmtTime(cer.end)} · Cérémonial des couleurs
                            </span>
                          </div>
                        );
                      })}
                      {/* ⭐ Chaque entry = une "ligne" compacte */}
                      {cellEntries.map(entry => {
                        const colorClass = getSubjectColor(entry.subjectId);
                        // Durée calculée depuis startTime/endTime
                        const [sh, sm] = (entry.startTime || '').split(':').map(Number);
                        const [eh, em] = (entry.endTime || '').split(':').map(Number);
                        const dur = (eh * 60 + em) - (sh * 60 + sm);
                        return (
                          <div
                            key={entry.id}
                            className={cn('rounded-md px-1.5 py-0.5 mb-0.5 border group relative hover:shadow-sm transition', colorClass)}
                            style={{ minHeight: '24px' }}
                          >
                            {/* Ligne 1 : matière + step inline */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold leading-tight truncate flex-1">
                                {entry.subjectName || '—'}
                                {entry.step && (
                                  <span className="text-[9px] font-semibold text-slate-500 ml-1">· {entry.step}</span>
                                )}
                              </span>
                            </div>
                            {/* Ligne 2 : "30min (8h15-8h45)" */}
                            <div className="text-[9px] font-semibold text-slate-600 leading-tight">
                              {dur}min ({fmtTime(entry.startTime)}-{fmtTime(entry.endTime)})
                            </div>
                            {/* ⭐ Infos enseignant/salle affichées pour teacher/parent (lecture-seule) */}
                            {(entry.teacherName || entry.roomName) && (
                              <div className="text-[8px] text-slate-500 leading-tight truncate">
                                {entry.teacherName && <span>{entry.teacherName}</span>}
                                {entry.teacherName && entry.roomName && <span> · </span>}
                                {entry.roomName && <span>📍 {entry.roomName}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
