"use client";

/**
 * My Classes — Overview of classes assigned to the teacher (English track).
 * Displays: class name (EN mapping), level, headcount (Boys/Girls/Total), subjects taught.
 * Click on a class → detailed view (student list).
 *
 * ⭐ English class name mapping:
 *    Maternelle 1 → Nursery 1
 *    Maternelle 2 → Nursery 2
 *    CI → Primary 1
 *    CP → Primary 2
 *    CE1 → Primary 3
 *    CE2 → Primary 4
 *    CM1 → Primary 5
 *    CM2 → Primary 6
 *
 * ⭐ Subject filtering: only English-track subjects (language=EN) are shown.
 *    If no subjects are assigned for the EN track, a clear message is displayed
 *    instead of showing FR-track subjects.
 */

import { useState, useEffect, useCallback } from "react";
import { Users, BookOpen, ChevronRight, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { offlineFetch } from "@/lib/offline/offline-fetch";
import { formatWeeklyDuration } from "@/lib/utils/duration";

interface MyClassesTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// ⭐ Map French class names to English equivalents
const CLASS_NAME_EN: Record<string, string> = {
  'Maternelle 1': 'Nursery 1',
  'Maternelle 2': 'Nursery 2',
  'Maternelle': 'Nursery',
  'CI': 'Primary 1',
  'CP': 'Primary 2',
  'CE1': 'Primary 3',
  'CE2': 'Primary 4',
  'CM1': 'Primary 5',
  'CM2': 'Primary 6',
};

// ⭐ Map French level names to English
const LEVEL_NAME_EN: Record<string, string> = {
  'Maternelle': 'Nursery',
  'Primaire': 'Primary',
  'Secondaire': 'Secondary',
};

function translateClassName(name: string): string {
  if (!name) return '';
  // Try exact match first
  if (CLASS_NAME_EN[name]) return CLASS_NAME_EN[name];
  // Try case-insensitive match
  const key = Object.keys(CLASS_NAME_EN).find(k => k.toLowerCase() === name.toLowerCase());
  if (key) return CLASS_NAME_EN[key];
  return name;
}

function translateLevelName(name: string): string {
  if (!name) return '';
  if (LEVEL_NAME_EN[name]) return LEVEL_NAME_EN[name];
  const key = Object.keys(LEVEL_NAME_EN).find(k => name.toLowerCase().includes(k.toLowerCase()));
  if (key) return name.replace(new RegExp(key, 'i'), LEVEL_NAME_EN[key]);
  return name;
}

export function MyClassesTab({ tenantId, academicYearId, teacherId }: MyClassesTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await offlineFetch<any>(
        `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}&language=EN`,
        "teacherclassassignment",
        { tenantId }
      );
      let classList = Array.isArray(data) ? data : (data?.data ?? []);

      // ⭐ Filter subjects to only show English-track subjects (language=EN)
      //    If a class has subjects, filter them. If after filtering the class
      //    has 0 EN subjects, we keep the class but clear the subjects array
      //    so the UI can show "No subjects assigned yet".
      //    Note: the backend returns the subject's language as `subjectLanguage`
      //    (added in getMyClasses service). We also accept `language` for
      //    backward compatibility with older backend versions.
      classList = classList.map((cls: any) => {
        if (!cls.subjects || cls.subjects.length === 0) return cls;
        const enSubjects = cls.subjects.filter((s: any) => {
          // Filter by language — only keep EN subjects
          const lang = String(s?.subjectLanguage || s?.language || '').toUpperCase();
          return lang === 'EN' || lang === '';
        });
        return { ...cls, subjects: enSubjects };
      });

      setClasses(classList);
    } catch (e: any) {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        toast.warning("Offline", {
          description: "You are offline and class data has not been cached yet. Reconnect to load your classes.",
        });
      } else {
        toast.error("Error", { description: e?.message || "Loading error" });
      }
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, tenantId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Detailed class view (student list)
  if (selectedClass) {
    const enClassName = translateClassName(selectedClass.className);
    const enLevelName = translateLevelName(selectedClass.schoolLevelName);
    return (
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedClass(null)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{enClassName}</h3>
            <p className="text-sm text-slate-500">{enLevelName}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{selectedClass.totalStudents}</div>
            <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Total</div>
          </div>
          <div className="bg-cyan-50 rounded-xl p-4 text-center border border-cyan-100">
            <div className="text-2xl font-bold text-cyan-600">{selectedClass.boys}</div>
            <div className="text-xs text-cyan-600 font-medium uppercase tracking-wider">Boys</div>
          </div>
          <div className="bg-pink-50 rounded-xl p-4 text-center border border-pink-100">
            <div className="text-2xl font-bold text-pink-600">{selectedClass.girls}</div>
            <div className="text-xs text-pink-600 font-medium uppercase tracking-wider">Girls</div>
          </div>
        </div>

        {/* Subjects taught */}
        {selectedClass.subjects?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedClass.subjects.map((s: any) => (
              <span key={s.subjectId} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                <BookOpen className="h-3 w-3" />
                {s.subjectName}
                {s.weeklyHours ? ` (${formatWeeklyDuration(s.weeklyHours)})` : ""}
              </span>
            ))}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            <BookOpen className="h-4 w-4 inline mr-1.5" />
            No subjects assigned yet for the English track. Please contact the administration.
          </div>
        )}

        {/* Student list */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">No.</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Matricule</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Gender</th>
              </tr>
            </thead>
            <tbody>
              {selectedClass.students?.slice().sort((a: any, b: any) => {
                const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                return aName.localeCompare(bName, 'en');
              }).map((s: any, idx: number) => (
                <tr key={s.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {s.lastName} {s.firstName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{s.matricule || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                      s.gender === "M" ? "bg-cyan-100 text-cyan-700" : "bg-pink-100 text-pink-700"
                    )}>
                      {s.gender === "M" ? "M" : "F"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Class list view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">My Classes</h3>
          <p className="text-sm text-slate-500">
            {loading ? "Loading..." : `${classes.length} class(es) assigned`}
          </p>
        </div>
        <button
          onClick={loadClasses}
          disabled={loading}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">No classes assigned</p>
          <p className="text-sm text-slate-400 mt-1">
            Please contact the administration to receive class assignments.
          </p>
        </div>
      ) : (
        /* Class cards grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const enClassName = translateClassName(cls.className);
            const enLevelName = translateLevelName(cls.schoolLevelName);
            return (
              <button
                key={cls.classId}
                onClick={() => setSelectedClass(cls)}
                className="text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{enClassName}</h4>
                    <p className="text-xs text-slate-500">{enLevelName}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">{cls.totalStudents}</span>
                    <span className="text-xs text-slate-400">students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-cyan-600">{cls.boys}B</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs font-medium text-pink-600">{cls.girls}G</span>
                  </div>
                </div>

                {/* Subjects */}
                {cls.subjects?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {cls.subjects.slice(0, 3).map((s: any) => (
                      <span key={s.subjectId} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
                        {s.subjectName}
                      </span>
                    ))}
                    {cls.subjects.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        +{cls.subjects.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-500 italic">No subjects assigned yet</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper (avoid importing cn from different path)
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
