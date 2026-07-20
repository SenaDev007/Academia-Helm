"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarCheck, Loader2, Save, RefreshCw, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

interface AttendanceTabProps {
  tenantId: string;
  academicYearId: string;
  schoolLevelId: string;
  teacherId: string;
}

export function AttendanceTab({ tenantId, academicYearId, schoolLevelId, teacherId }: AttendanceTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger mes classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
        if (data.length > 0) setSelectedClassId(data[0].classId);
      } catch { setClasses([]); }
    })();
  }, [teacherId, academicYearId]);

  // Charger l'appel
  const loadAttendance = useCallback(async () => {
    if (!selectedClassId || !date) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/attendance/${selectedClassId}?date=${date}`, { credentials: "include" });
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch { setStudents([]); }
    finally { setLoading(false); }
  }, [selectedClassId, date]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const setStatus = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = students.map(s => ({ studentId: s.studentId, status: s.status }));
      const res = await fetch("/api/pedagogy-space/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academicYearId, schoolLevelId, classId: selectedClassId, date, records }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Appel enregistré");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const present = students.filter(s => s.status === "PRESENT").length;
  const absent = students.filter(s => s.status === "ABSENT").length;
  const late = students.filter(s => s.status === "LATE").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">Appel Journalier</h3>
        <div className="flex items-center gap-2">
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm">
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          <button onClick={handleSave} disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      {students.length > 0 && (
        <div className="flex gap-3">
          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">{present} Présents</span>
          <span className="px-3 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold">{absent} Absents</span>
          <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">{late} Retards</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Aucun élève dans cette classe.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 font-semibold text-slate-700">N°</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-700">Nom</th>
              <th className="text-center px-4 py-2 font-semibold text-slate-700">Statut</th>
            </tr></thead>
            <tbody>
              {students.map((s, idx) => (
                <tr key={s.studentId} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {["PRESENT", "ABSENT", "LATE"].map(st => (
                        <button key={st} onClick={() => setStatus(s.studentId, st)}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-bold transition-colors",
                            s.status === st
                              ? st === "PRESENT" ? "bg-emerald-500 text-white"
                                : st === "ABSENT" ? "bg-red-500 text-white"
                                : "bg-amber-500 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}>
                          {st === "PRESENT" ? "P" : st === "ABSENT" ? "A" : "R"}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(" "); }
