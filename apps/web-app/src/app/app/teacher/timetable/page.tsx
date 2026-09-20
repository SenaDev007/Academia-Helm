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
// ⭐ P4-final : page bilingue (piste EN → anglais)
import { useL } from "@/lib/i18n/bilingual";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CalendarDays, Loader2, RefreshCw, AlertCircle,
} from "lucide-react";
import TimetableView from "@/components/pedagogy/timetables/TimetableView";

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
  officialClassId?: string;
  className?: string;
  roomId?: string;
  roomName?: string;
  notes?: string;
  step?: string;
  // ⭐ Référence au timetable parent (pour passer schoolLevelId + academicYearId à TimetableView)
  timetable?: { id: string; schoolLevelId: string; academicYearId: string; name?: string };
}

export default function TeacherTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  // ⭐ Liste des classes du teacher (pour le sélecteur)
  //    Chaque entrée : { officialClassId, name }
  //    Sert à afficher le switcher de classe quand le teacher a plusieurs classes.
  const [teacherClasses, setTeacherClasses] = useState<{id: string, name: string}[]>([]);
  // ⭐ Classe sélectionnée dans le switcher (null = "toutes mes classes")
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  // ⭐ Toutes les entries du teacher (non filtrées par classe sélectionnée)
  const [allTeacherEntries, setAllTeacherEntries] = useState<TimetableEntry[]>([]);

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
      // ⭐ Matching du profil enseignant — le TeacherAcademicProfile n'a pas de
      //    `userId` direct (il n'a que `teacherId` qui pointe vers Teacher).
      //    Le Teacher non plus n'a pas de `userId` field dans la réponse de
      //    l'API teacher-profiles (qui select: id, firstName, lastName, matricule, email).
      //    On doit matcher via :
      //      1. p.userId === user.id (au cas où userId est renvoyé)
      //      2. p.user?.id === user.id (au cas où user est populate)
      //      3. p.teacher.email === user.email (MATCHING PAR EMAIL — le plus fiable)
      //      4. p.teacher.matricule === user.matricule (matching par matricule)
      //      5. p.teacher.matricule === user.email (cas où le login est le matricule mais
      //         renvoyé dans user.email — possible selon le portail)
      //    Sans ce matching multiple, un enseignant (ex: Karim HELM, AHE-26-00008)
      //    ne trouve pas son profil → myTeacherId undefined → pas d'assignments fetchés
      //    → 'Aucun emploi du temps configuré'
      const myProfile = profiles.find((p: any) =>
        p.userId === user.id ||
        p.user?.id === user.id ||
        (p.teacher?.email && user.email && p.teacher.email.toLowerCase() === user.email.toLowerCase()) ||
        (p.teacher?.matricule && user.matricule && p.teacher.matricule === user.matricule)
      );
      const myTeacherId = myProfile?.teacherId || myProfile?.id;

      // ⭐ ÉTAPE 2 : Récupérer les assignments de classe du teacher
      //    → résoudre pour chaque assignment l'AcademicClass.id (=officialClassId)
      //    Le backend renvoie l'assignment AVEC classSubject.academicClass déjà peuplé
      //    (cf. pedagogy-prisma.service.ts → getTeacherClassAssignments).
      //    Donc PAS BESOIN de fetch academic-structure/classes séparément.
      const teacherOfficialClassIds = new Set<string>();
      const teacherClassesMap = new Map<string, string>(); // id → name
      if (myTeacherId) {
        try {
          const assignRes = await fetch(
            `/api/pedagogy/teacher-class-assignments?teacherId=${encodeURIComponent(myTeacherId)}&academicYearId=${encodeURIComponent(academicYear.id)}`,
            { credentials: "include" },
          );
          const assignList = await assignRes.json();
          const assignments = Array.isArray(assignList) ? assignList : (assignList?.data || []);
          // ⭐ Pour chaque assignment, récupérer l'AcademicClass via classSubject.academicClass
          //    (le physicalClass peut être null si le teacher est titular de toute l'AcademicClass)
          for (const a of assignments) {
            // Cas 1 : assignment via classSubject → on a academicClass.id direct
            const academicClassId = a.classSubject?.academicClass?.id;
            const academicClassName = a.classSubject?.academicClass?.name;
            if (academicClassId) {
              teacherOfficialClassIds.add(academicClassId);
              if (academicClassName) teacherClassesMap.set(academicClassId, academicClassName);
            }
          }
        } catch (e) { console.warn("Failed to load teacher assignments:", e); }
      }
      // Convertir la Map en array pour l'affichage du switcher
      setTeacherClasses(Array.from(teacherClassesMap.entries()).map(([id, name]) => ({ id, name })));

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
            // ⭐ On attache le timetable parent à chaque entry pour que TimetableView
            //    puisse récupérer la config (schoolLevelId + academicYearId) et afficher
            //    la grille complète (jours + créneaux) — pas une simple liste par jour.
            const ttMeta = {
              id: t.id,
              schoolLevelId: t.schoolLevelId,
              academicYearId: t.academicYearId,
              name: t.name,
            };
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
              officialClassId: entryOfficialClassId,
              className: e.class?.name,
              roomName: e.room?.name,
              teacherName: e.teacher ? `${e.teacher.firstName || ""} ${e.teacher.lastName || ""}`.trim() : undefined,
              notes: e.notes,
              step: e.step,
              timetable: ttMeta,
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

      setAllTeacherEntries(allEntries);
      // ⭐ Auto-sélection : si le teacher a 1 seule classe, on la sélectionne par défaut
      //    S'il en a plusieurs, on laisse null (toutes) — il choisira via le switcher
      if (teacherClassesMap.size === 1) {
        setSelectedClassId(Array.from(teacherClassesMap.keys())[0]);
      } else {
        setSelectedClassId(null);
      }
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, user?.id]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  // ⭐ Filtrer les entries par classe sélectionnée (si le teacher a choisi une classe)
  useEffect(() => {
    if (selectedClassId) {
      setEntries(allTeacherEntries.filter(e => !e.classId || e.officialClassId === selectedClassId));
    } else {
      setEntries(allTeacherEntries);
    }
  }, [selectedClassId, allTeacherEntries]);

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
            <h2 className="text-sm font-bold text-slate-900">{L("Mon Emploi du Temps", "My Timetable")}</h2>
            <p className="text-xs text-slate-500">
              {entries.length > 0
                ? L(`${entries.length} créneau(x) cette semaine`, `${entries.length} slot(s) this week`)
                : L("Aucun emploi du temps configuré pour le moment", "No timetable configured yet")}
            </p>
          </div>
        </div>
        {/* ⭐ Switcher de classe — affiché uniquement si le teacher a 2+ classes
            Saliou (CE1 + CE2 par ex.) peut basculer entre ses classes. */}
        {teacherClasses.length > 1 && (
          <select
            value={selectedClassId || ''}
            onChange={(e) => setSelectedClassId(e.target.value || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white"
            title={L("Changer de classe", "Change class")}
          >
            <option value="">{L("Toutes mes classes", "All my classes")}</option>
            {teacherClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={loadTimetable}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
          title={L("Rafraîchir", "Refresh")}
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
          <p className="text-sm text-slate-500">{L("Aucun emploi du temps disponible", "No timetable available")}</p>
          <p className="text-xs text-slate-400 mt-1">
            {L("La direction n'a pas encore configuré votre emploi du temps.", "The school management has not configured your timetable yet.")}
          </p>
        </div>
      ) : (
        <>
          {(() => {
            // ⭐ Si une classe est sélectionnée → une seule grille
            if (selectedClassId) {
              const tt = entries.find(e => e.timetable)?.timetable;
              if (!tt) return null;
              return <TimetableView entries={entries} timetable={tt} />;
            }
            // ⭐ "Toutes mes classes" → une grille PAR classe (avec titre + nom de la classe)
            //    On groupe par officialClassId pour avoir une grille distincte par classe.
            const byOfficialClass = new Map<string, { entries: TimetableEntry[]; name: string }>();
            for (const e of entries) {
              const ocId = e.officialClassId || 'global';
              if (!byOfficialClass.has(ocId)) {
                byOfficialClass.set(ocId, { entries: [], name: e.className || 'Global' });
              }
              byOfficialClass.get(ocId)!.entries.push(e);
            }
            return Array.from(byOfficialClass.entries()).map(([ocId, data]) => {
              const tt = data.entries.find(e => e.timetable)?.timetable;
              if (!tt) return null;
              return (
                <div key={ocId} className="space-y-2">
                  <h3 className="text-base font-bold text-slate-800 border-l-4 border-purple-500 pl-3">
                    {data.name}
                  </h3>
                  <TimetableView entries={data.entries} timetable={tt} />
                </div>
              );
            });
          })()}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>{L("Note :", "Note:")}</strong> {L("L'emploi du temps est configuré par la direction de l'école. Pour toute modification ou question, contactez l'administration.", "The timetable is configured by the school management. For any change or question, contact the administration.")}
          </div>
        </>
      )}
    </div>
  );
}
