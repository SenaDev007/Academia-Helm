"use client";

/**
 * ============================================================================
 * PARENT TIMETABLE — Emploi du temps de l'enfant
 * ============================================================================
 *
 * Le parent voit automatiquement l'emploi du temps de son enfant basé sur
 * la classe de l'enfant (child.classId). Si plusieurs enfants → sélecteur
 * d'enfant en haut de page.
 *
 * Vue lecture seule — la colonne horaire est dynamique.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
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
  classId?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
  notes?: string;
  step?: string;
  // ⭐ Référence au timetable parent (pour passer schoolLevelId + academicYearId à TimetableView)
  timetable?: { id: string; schoolLevelId: string; academicYearId: string; name?: string };
}

export default function ParentTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ⭐ Toutes les entries par enfant — pour le mode "Tous mes enfants" qui
  //    affiche une grille par enfant (enfant 1 + enfant 2 + ...).
  //    Chaque entrée du Map contient : { childName, className, entries: TimetableEntry[] }
  const [allChildrenEntries, setAllChildrenEntries] = useState<Map<string, { childName: string; className: string; entries: TimetableEntry[] }>>(new Map());

  // Charger les enfants
  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`,
          { credentials: "include" },
        );
        const list = await res.json();
        const arr = Array.isArray(list) ? list : [];
        setChildren(arr);
        if (arr.length > 0) setSelectedChildId(arr[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  const selectedChild = children.find((c) => c.id === selectedChildId);

  const loadTimetable = useCallback(async () => {
    if (!academicYear?.id || !user?.id || children.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ⭐ ÉTAPE 1 : Récupérer les AcademicClasses pour résoudre classId (physical)
      //    → officialClassId (AcademicClass) pour chaque enfant.
      //    Si l'enfant a déjà academicClassId (champ direct), on l'utilise.
      const classesRes = await fetch(
        `/api/pedagogy/academic-structure/classes?academicYearId=${encodeURIComponent(academicYear.id)}`,
        { credentials: "include" },
      );
      const classList = await classesRes.json();
      const academicClasses = Array.isArray(classList) ? classList : (classList?.data || []);

      // ⭐ ÉTAPE 2 : Pour chaque enfant, calculer son officialClassId
      //    child.academicClassId (prioritaire) OU résolution physical Class.id → AcademicClass.id
      const childOfficialClassIds = new Map<string, string | undefined>(); // childId → officialClassId
      for (const child of children) {
        let officialId: string | undefined = (child as any)?.academicClassId;
        if (!officialId && child.classId) {
          for (const ac of academicClasses) {
            const phys = (ac.physicalClasses || []);
            if (phys.some((pc: any) => pc.id === child.classId)) {
              officialId = ac.id;
              break;
            }
          }
        }
        childOfficialClassIds.set(child.id, officialId);
      }

      // ⭐ ÉTAPE 3 : Récupérer tous les EDT pour l'année
      const res = await fetch(
        `/api/timetables?academicYearId=${encodeURIComponent(academicYear.id)}`,
        { credentials: "include" },
      );
      const timetables = await res.json();
      const tList = Array.isArray(timetables) ? timetables : (timetables?.data || []);

      if (tList.length === 0) {
        setAllChildrenEntries(new Map());
        setLoading(false);
        return;
      }

      // ⭐ ÉTAPE 4 : Pour chaque EDT, récupérer les entries et dispatcher vers chaque enfant
      //    On boucle sur tous les EDTs une seule fois, et pour chaque entry on vérifie
      //    à quel(s) enfant(s) elle appartient (via officialClassId ou classId direct).
      //    On construit un Map<childId, {childName, className, entries: []}>.
      const childDataMap = new Map<string, { childName: string; className: string; entries: TimetableEntry[] }>();
      for (const child of children) {
        childDataMap.set(child.id, {
          childName: `${child.firstName} ${child.lastName}`,
          className: child.className || child.academicClassName || "—",
          entries: [],
        });
      }

      for (const t of tList) {
        try {
          const r2 = await fetch(`/api/timetables/${t.id}`, { credentials: "include" });
          const data = await r2.json();
          const tEntries = data?.entries || [];
          const ttMeta = {
            id: t.id,
            schoolLevelId: t.schoolLevelId,
            academicYearId: t.academicYearId,
            name: t.name,
          };
          for (const e of tEntries) {
            const entryOfficialClassId = e.class?.officialClassId;
            const isGlobal = !e.classId;
            // ⭐ Pour chaque enfant, vérifier si l'entry lui appartient
            for (const child of children) {
              const childOfficialId = childOfficialClassIds.get(child.id);
              const belongsToChild = isGlobal
                || (childOfficialId && entryOfficialClassId === childOfficialId)
                || (e.classId === child.classId);
              if (!belongsToChild) continue;
              childDataMap.get(child.id)!.entries.push({
                id: e.id,
                dayOfWeek: e.dayOfWeek,
                startTime: e.startTime,
                endTime: e.endTime,
                duration: e.duration,
                subjectId: e.subjectId,
                subjectName: e.subject?.name,
                subjectCode: e.subject?.code,
                classId: e.classId,
                className: e.class?.name,
                teacherName: e.teacher ? `${e.teacher.firstName || ""} ${e.teacher.lastName || ""}`.trim() : undefined,
                roomName: e.room?.name,
                notes: e.notes,
                step: e.step,
                timetable: ttMeta,
              });
            }
          }
        } catch (e) { console.warn("Failed:", e); }
      }

      // ⭐ Trier les entries par enfant par jour puis heure
      for (const child of children) {
        const data = childDataMap.get(child.id);
        if (data) {
          data.entries.sort((a, b) => {
            if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.startTime.localeCompare(b.startTime);
          });
        }
      }

      setAllChildrenEntries(childDataMap);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, user?.id, children]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête + sélecteur enfant */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Emploi du temps</h2>
            <p className="text-xs text-slate-500">
              {selectedChildId === ""
                ? (children.length > 1 ? "Tous mes enfants" : (children[0] ? `${children[0].firstName} ${children[0].lastName}` : ""))
                : (selectedChild
                  ? `${selectedChild.firstName} ${selectedChild.lastName} — ${selectedChild.className || "Classe non assignée"}`
                  : "Aucun enfant sélectionné")
              }
            </p>
          </div>
        </div>
        {children.length > 1 && (
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
            title="Changer d'enfant"
          >
            <option value="">Tous mes enfants</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.className || c.academicClassName || "—"}
              </option>
            ))}
          </select>
        )}
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

      {(() => {
        // ⭐ Si un enfant spécifique est sélectionné → une seule grille
        if (selectedChildId) {
          const data = allChildrenEntries.get(selectedChildId);
          if (!data || data.entries.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucun emploi du temps disponible</p>
                <p className="text-xs text-slate-400 mt-1">
                  La direction n'a pas encore configuré l'emploi du temps de cette classe.
                </p>
              </div>
            );
          }
          const tt = data.entries.find(e => e.timetable)?.timetable;
          if (!tt) return null;
          return <TimetableView entries={data.entries} timetable={tt} />;
        }

        // ⭐ "Tous mes enfants" → une grille PAR enfant (avec titre + nom de l'enfant + classe)
        if (allChildrenEntries.size === 0) {
          return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucun emploi du temps disponible</p>
              <p className="text-xs text-slate-400 mt-1">
                La direction n'a pas encore configuré l'emploi du temps.
              </p>
            </div>
          );
        }

        return Array.from(allChildrenEntries.entries()).map(([childId, data]) => {
          if (data.entries.length === 0) return null;
          const tt = data.entries.find(e => e.timetable)?.timetable;
          if (!tt) return null;
          return (
            <div key={childId} className="space-y-2">
              <h3 className="text-base font-bold text-slate-800 border-l-4 border-emerald-500 pl-3">
                {data.childName} <span className="text-sm font-normal text-slate-500">— {data.className}</span>
              </h3>
              <TimetableView entries={data.entries} timetable={tt} />
            </div>
          );
        });
      })()}
    </div>
  );
}
