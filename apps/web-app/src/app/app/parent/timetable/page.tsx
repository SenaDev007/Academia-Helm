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
  CalendarDays, Clock, Loader2, RefreshCw, BookOpen,
  Users, AlertCircle, Coffee, ChevronDown, ChevronRight,
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
  classId?: string;
  className?: string;
  teacherName?: string;
  roomName?: string;
  notes?: string;
}

export default function ParentTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

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
    if (!academicYear?.id || !selectedChild?.classId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Récupérer tous les EDT pour l'année
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

      // 2. Pour chaque EDT, récupérer les entries et filtrer par classId
      const allEntries: TimetableEntry[] = [];
      for (const t of tList) {
        try {
          const r2 = await fetch(`/api/timetables/${t.id}`, { credentials: "include" });
          const data = await r2.json();
          const tEntries = data?.entries || [];
          for (const e of tEntries) {
            // Filtrer par la classe de l'enfant
            if (e.classId === selectedChild.classId || !e.classId) {
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
              });
            }
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
  }, [academicYear?.id, selectedChild?.classId]);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  // Grouper par jour
  const byDay: Record<number, TimetableEntry[]> = {};
  for (const e of entries) {
    const day = e.dayOfWeek || 0;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

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
        <div className="space-y-3">
          {DAYS.map((day) => {
            const dayEntries = byDay[day.id] || [];
            if (dayEntries.length === 0) return null;
            const isExpanded = expandedDay === day.id;
            return (
              <div key={day.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between cursor-pointer hover:bg-emerald-100/50"
                  onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-emerald-600" />
                      : <ChevronRight className="h-4 w-4 text-emerald-600" />}
                    <span className="font-bold text-sm text-emerald-900">{day.label}</span>
                  </div>
                  <span className="text-xs text-emerald-600">{dayEntries.length} créneau(x)</span>
                </div>
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {dayEntries.map((e, idx) => {
                      const isBreakEntry = isBreak(e.subjectName);
                      const colorClass = isBreakEntry
                        ? "bg-slate-50 border-slate-200 text-slate-600"
                        : getSubjectColor(subjectColorMap[e.subjectId || ""] || 0);
                      return (
                        <div key={e.id || idx} className={`flex items-stretch border-l-4 ${isBreakEntry ? "border-slate-300" : "border-emerald-400"}`}>
                          <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center px-3 py-3 bg-slate-50/50 border-r border-slate-100">
                            <span className="text-sm font-bold text-slate-900">{e.startTime}</span>
                            <span className="text-[10px] text-slate-400">{e.endTime}</span>
                            {e.duration && (
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                {formatWeeklyDuration(e.duration)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isBreakEntry ? (
                                <Coffee className="h-5 w-5 text-slate-400" />
                              ) : (
                                <BookOpen className="h-5 w-5 text-emerald-600" />
                              )}
                              <div>
                                <p className={`text-sm font-bold ${isBreakEntry ? "text-slate-600" : "text-slate-900"}`}>
                                  {e.subjectName || "Créneau"}
                                </p>
                                {e.subjectCode && !isBreakEntry && (
                                  <p className="text-[10px] text-slate-400">[{e.subjectCode}]</p>
                                )}
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                                  {e.teacherName && (
                                    <span>{e.teacherName}</span>
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
