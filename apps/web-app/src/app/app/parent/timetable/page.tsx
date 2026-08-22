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
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    // ⭐ ÉTAPE 0 : Déterminer le officialClassId (AcademicClass) de l'enfant.
    //    Si selectedChild.academicClassId est défini → on l'utilise DIRECTEMENT
    //    (c'est le cas le plus fiable — academicClassId est posé à l'admission).
    //    Sinon, on tente de résoudre via le physical Class.id (classId).
    const childAcademicClassId = (selectedChild as any)?.academicClassId as string | undefined;
    if (!academicYear?.id || (!selectedChild?.classId && !childAcademicClassId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ⭐ ÉTAPE 1 : Si on n'a pas academicClassId direct, on le résout via
      //    academic-structure/classes. Sinon, on skip cette étape (gain de temps).
      let childOfficialClassId: string | undefined = childAcademicClassId;

      if (!childOfficialClassId && selectedChild?.classId) {
        // Résolution physical Class.id → AcademicClass.id
        const classesRes = await fetch(
          `/api/pedagogy/academic-structure/classes?academicYearId=${encodeURIComponent(academicYear.id)}`,
          { credentials: "include" },
        );
        const classList = await classesRes.json();
        const academicClasses = Array.isArray(classList) ? classList : (classList?.data || []);
        // Trouver l'officialClassId (AcademicClass) de la classe de l'enfant
        for (const ac of academicClasses) {
          const phys = (ac.physicalClasses || []);
          if (phys.some((pc: any) => pc.id === selectedChild.classId)) {
            childOfficialClassId = ac.id;
            break;
          }
        }
      }

      // ⭐ ÉTAPE 2 : Récupérer tous les EDT pour l'année
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

      // ⭐ ÉTAPE 3 : Pour chaque EDT, récupérer les entries et filtrer par officialClassId
      //    Avant ce fix, le parent ne voyait RIEN car le filter `e.classId === child.classId`
      //    ne matchait jamais (entries ont le 1er physical Class.id, pas celui de l'enfant).
      //    Maintenant on filtre via la relation Class.officialClassId → AcademicClass.id.
      const allEntries: TimetableEntry[] = [];
      for (const t of tList) {
        try {
          const r2 = await fetch(`/api/timetables/${t.id}`, { credentials: "include" });
          const data = await r2.json();
          const tEntries = data?.entries || [];
          for (const e of tEntries) {
            // ⭐ Filtrage : l'entry appartient à la classe de l'enfant si :
            //    - childOfficialClassId est défini ET e.class.officialClassId === childOfficialClassId
            //    - OU fallback : e.classId === selectedChild.classId (compatibilité)
            //    - OU l'entry n'a pas de classId (entry globale, ex: cérémonial)
            const entryOfficialClassId = e.class?.officialClassId;
            const isGlobal = !e.classId;
            const belongsToChild = isGlobal
              || (childOfficialClassId && entryOfficialClassId === childOfficialClassId)
              || (e.classId === selectedChild.classId);
            if (!belongsToChild) continue;
            // ⭐ Attacher le timetable parent pour que TimetableView puisse récupérer la config
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
              classId: e.classId,
              className: e.class?.name,
              teacherName: e.teacher ? `${e.teacher.firstName || ""} ${e.teacher.lastName || ""}`.trim() : undefined,
              roomName: e.room?.name,
              notes: e.notes,
              step: e.step,
              timetable: ttMeta,
            });
          }
        } catch (e) { console.warn("Failed:", e); }
      }

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
  }, [academicYear?.id, selectedChild]);

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
              {selectedChild
                ? `${selectedChild.firstName} ${selectedChild.lastName} — ${selectedChild.className || "Classe non assignée"}`
                : "Aucun enfant sélectionné"}
            </p>
          </div>
        </div>
        {children.length > 1 && (
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.className || "—"}
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

      {entries.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun emploi du temps disponible</p>
          <p className="text-xs text-slate-400 mt-1">
            La direction n'a pas encore configuré l'emploi du temps de cette classe.
          </p>
        </div>
      ) : (
        <>
          {/* ⭐ Grille d'emploi du temps IDENTIQUE au director UI (TimetablesWorkspace).
              On prend le timetable de la première entry — toutes les entries du child
              viennent du même EDT (celui de sa classe). */}
          {(() => {
            const tt = entries.find(e => e.timetable)?.timetable;
            if (!tt) return null;
            return <TimetableView entries={entries} timetable={tt} />;
          })()}
        </>
      )}
    </div>
  );
}
