"use client";

/**
 * ============================================================================
 * TEACHER TIMETABLE — Vue lecture seule avec chargement dynamique
 * ============================================================================
 *
 * L'enseignant voit automatiquement son emploi du temps basé sur :
 *   - Les entrées où il est assigné comme teacherId
 *   - Les entrées pour les classes où il est titular/specialist
 *
 * La colonne horaire est DYNAMIQUE : elle s'ajuste aux heures réelles
 * des sessions (pas de grille fixe 8h-17h). Si une matière commence à 8:00
 * et dure 45 min → la cellule affiche 8:00-8:45 et la suivante commence à 8:45.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CalendarDays, Clock, Loader2, RefreshCw, BookOpen,
  Users, AlertCircle, Coffee,
} from "lucide-react";
import { formatWeeklyDuration } from "@/lib/utils/duration";

const DAYS = [
  { id: 1, label: "LUNDI" },
  { id: 2, label: "MARDI" },
  { id: 3, label: "MERCREDI" },
  { id: 4, label: "JEUDI" },
  { id: 5, label: "VENDREDI" },
  { id: 6, label: "SAMEDI" },
];

const SUBJECT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
];

function getSubjectColor(idx: number): string {
  return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
}

function isBreak(subjectName: string | null | undefined): boolean {
  if (!subjectName) return false;
  const n = subjectName.toLowerCase();
  return n.includes("récréation") || n.includes("recreation") || n.includes("pause") || n.includes("cérémonie");
}

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  duration?: number;
  subjectId?: string;
  subjectName?: string;
  subjectCode?: string;
  teacherId?: string;
  classId?: string;
  className?: string;
  roomId?: string;
  roomName?: string;
  notes?: string;
  step?: string;
}

export default function TeacherTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTimetable = useCallback(async () => {
    if (!academicYear?.id || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ⭐ ÉTAPE 1 : Récupérer le profil enseignant (user.id → teacher.id)
      //    Nécessaire pour fetch les assignments de classe du teacher
      const profRes = await fetch(
        `/api/pedagogy/teacher-profiles?academicYearId=${encodeURIComponent(academicYear.id)}`,
        { credentials: "include" },
      );
      const profList = await profRes.json();
      const profiles = Array.isArray(profList) ? profList : (profList?.data || []);
      const myProfile = profiles.find((p: any) => p.userId === user.id || p.user?.id === user.id);
      const myTeacherId = myProfile?.teacherId || myProfile?.id;

      // ⭐ ÉTAPE 2 : Récupérer les assignments de classe du teacher
      //    → liste des classId (physical Class) auxquels le teacher est titular/specialist
      let teacherOfficialClassIds = new Set<string>(); // AcademicClass IDs (officialClassIds)
      if (myTeacherId) {
        try {
          const assignRes = await fetch(
            `/api/pedagogy/teacher-class-assignments?teacherId=${encodeURIComponent(myTeacherId)}&academicYearId=${encodeURIComponent(academicYear.id)}`,
            { credentials: "include" },
          );
          const assignList = await assignRes.json();
          const assignments = Array.isArray(assignList) ? assignList : (assignList?.data || []);
          // ⭐ Récupérer les AcademicClasses pour résoudre physical Class.id → officialClassId
          const classesRes = await fetch(
            `/api/pedagogy/academic-structure/classes?academicYearId=${encodeURIComponent(academicYear.id)}`,
            { credentials: "include" },
          );
          const classList = await classesRes.json();
          const academicClasses = Array.isArray(classList) ? classList : (classList?.data || []);
          // Construire la map : physicalClassId → AcademicClass.id
          const physicalToAcademic = new Map<string, string>();
          for (const ac of academicClasses) {
            const phys = (ac.physicalClasses || []);
            for (const pc of phys) {
              physicalToAcademic.set(pc.id, ac.id);
            }
          }
          // Pour chaque assignment, déterminer l'officialClassId
          for (const a of assignments) {
            const classId = a.classId || a.class?.id;
            if (!classId) continue;
            const officialId = physicalToAcademic.get(classId);
            if (officialId) teacherOfficialClassIds.add(officialId);
          }
        } catch (e) { console.warn("Failed to load teacher assignments:", e); }
      }

      // ⭐ ÉTAPE 3 : Récupérer tous les EDT pour l'année
      const res = await fetch(
        `/api/timetables?academicYearId=${encodeURIComponent(academicYear.id)}`,
        { credentials: "include" },
      );
      const timetables = await res.json();
      const tList = Array.isArray(timetables) ? timetables : (timetables?.data || []);

      if (tList.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // ⭐ ÉTAPE 4 : Pour chaque EDT, récupérer les entries et filtrer par
      //    officialClassId correspondant aux classes du teacher.
      //    Avant ce fix, le teacher voyait TOUTES les entries de TOUS les EDTs mélangés
      //    (effet "EDT fictif aléatoire"). Maintenant il ne voit QUE les entries
      //    de SES classes (via la relation Class.officialClassId → AcademicClass.id).
      const allEntries: TimetableEntry[] = [];
      for (const t of tList) {
        try {
          const r2 = await fetch(
            `/api/timetables/${t.id}`,
            { credentials: "include" },
          );
          const data = await r2.json();
          const tEntries = data?.entries || [];
          for (const e of tEntries) {
            // ⭐ Filtrage : l'entry appartient à une des classes du teacher si :
            //    - teacherOfficialClassIds contient e.class.officialClassId (cas normal)
            //    - OU l'entry n'a pas de classId (entry globale, ex: cérémonial)
            const entryOfficialClassId = e.class?.officialClassId;
            const isGlobal = !e.classId; // pas de classe = entry globale
            const belongsToTeacher = isGlobal || (entryOfficialClassId && teacherOfficialClassIds.has(entryOfficialClassId));
            if (!belongsToTeacher) continue;
            allEntries.push({
              id: e.id,
              dayOfWeek: e.dayOfWeek,
              startTime: e.startTime,
              endTime: e.endTime,
              duration: e.duration,
              subjectId: e.subjectId,
              subjectName: e.subject?.name,
              subjectCode: e.subject?.code,
              teacherId: e.teacherId,
              classId: e.classId,
              className: e.class?.name,
              roomName: e.room?.name,
              notes: e.notes,
              step: e.step,
            });
          }
        } catch (e) {
          console.warn("Failed to load timetable entries:", e);
        }
      }

      // 5. Trier par jour puis heure de début
      allEntries.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });

      setEntries(allEntries);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, user?.id]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  // Grouper par jour
  const byDay: Record<number, TimetableEntry[]> = {};
  for (const e of entries) {
    const day = e.dayOfWeek || 0;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  // Collecter tous les créneaux horaires uniques (pour colonne dynamique)
  const allTimeSlots = new Set<string>();
  for (const e of entries) {
    allTimeSlots.add(e.startTime);
    allTimeSlots.add(e.endTime);
  }
  const sortedTimes = Array.from(allTimeSlots).sort();

  // Map subject → color index
  const subjectColorMap: Record<string, number> = {};
  let colorIdx = 0;
  for (const e of entries) {
    if (e.subjectId && !(e.subjectId in subjectColorMap)) {
      subjectColorMap[e.subjectId] = colorIdx++;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <CalendarDays className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Mon Emploi du Temps</h2>
            <p className="text-xs text-slate-500">
              {entries.length > 0
                ? `${entries.length} créneau(x) cette semaine`
                : "Aucun emploi du temps configuré pour le moment"}
            </p>
          </div>
        </div>
        <button
          onClick={loadTimetable}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
          title="Rafraîchir"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {entries.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun emploi du temps disponible</p>
          <p className="text-xs text-slate-400 mt-1">
            La direction n'a pas encore configuré votre emploi du temps.
          </p>
        </div>
      ) : (
        <>
          {/* Vue par jour (cards verticaux) */}
          <div className="space-y-4">
            {DAYS.map((day) => {
              const dayEntries = byDay[day.id] || [];
              if (dayEntries.length === 0) return null;
              return (
                <div key={day.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* En-tête du jour */}
                  <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-purple-900">{day.label}</span>
                    <span className="text-xs text-purple-600">{dayEntries.length} créneau(x)</span>
                  </div>
                  {/* Liste des créneaux */}
                  <div className="divide-y divide-slate-100">
                    {dayEntries.map((e, idx) => {
                      const isBreakEntry = isBreak(e.subjectName);
                      const colorClass = isBreakEntry
                        ? "bg-slate-50 border-slate-200 text-slate-600"
                        : getSubjectColor(subjectColorMap[e.subjectId || ""] || 0);
                      return (
                        <div key={e.id || idx} className={`flex items-stretch border-l-4 ${isBreakEntry ? "border-slate-300" : "border-purple-400"}`}>
                          {/* Colonne horaire dynamique */}
                          <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center px-3 py-3 bg-slate-50/50 border-r border-slate-100">
                            <span className="text-sm font-bold text-slate-900">{e.startTime}</span>
                            <span className="text-[10px] text-slate-400">{e.endTime}</span>
                            {e.duration && (
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                {formatWeeklyDuration(e.duration)}
                              </span>
                            )}
                          </div>
                          {/* Contenu du créneau */}
                          <div className="flex-1 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isBreakEntry ? (
                                <Coffee className="h-5 w-5 text-slate-400" />
                              ) : (
                                <BookOpen className="h-5 w-5 text-purple-600" />
                              )}
                              <div>
                                <p className={`text-sm font-bold ${isBreakEntry ? "text-slate-600" : "text-slate-900"}`}>
                                  {e.subjectName || "Créneau"}
                                  {e.step && !isBreakEntry && (
                                    <span className="text-[10px] font-semibold text-slate-500 ml-1">· {e.step}</span>
                                  )}
                                </p>
                                {e.subjectCode && !isBreakEntry && (
                                  <p className="text-[10px] text-slate-400">[{e.subjectCode}]</p>
                                )}
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                  {e.className && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {e.className}
                                    </span>
                                  )}
                                  {e.roomName && (
                                    <span className="flex items-center gap-1">
                                      <span className="text-slate-400">Salle:</span> {e.roomName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${colorClass}`}>
                              {isBreakEntry ? "PAUSE" : "COURS"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>Note :</strong> L'emploi du temps est configuré par la direction de l'école.
            Pour toute modification ou question, contactez l'administration.
          </div>
        </>
      )}
    </div>
  );
}
