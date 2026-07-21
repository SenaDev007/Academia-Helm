"use client";

/**
 * ============================================================================
 * APPEL JOURNALIER — Avec marquage Matin/Après-midi + Auto-save 5s
 * ============================================================================
 *
 * Système de marquage (demi-jours) :
 *   - 4 boutons par élève : PM (Présent Matin), AM (Absent Matin),
 *     PS (Présent Soir), AS (Absent Soir)
 *   - Bouton "Retard" pour notifier les parents
 *   - Auto-save toutes les 5 secondes si changements détectés
 *   - Sync automatique vers le Registre d'Appel mensuel
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CalendarCheck, Loader2, Save, CheckCircle2, Cloud, CloudOff,
  Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface AttendanceTabProps {
  tenantId: string;
  academicYearId: string;
  schoolLevelId: string;
  teacherId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AttendanceTab({ tenantId, academicYearId, schoolLevelId, teacherId }: AttendanceTabProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const isDirtyRef = useRef(false);
  const studentsRef = useRef<any[]>(students);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { studentsRef.current = students; }, [students]);

  // Charger mes classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].classId);
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
      isDirtyRef.current = false;
      setSaveStatus("idle");
    } catch { setStudents([]); }
    finally { setLoading(false); }
  }, [selectedClassId, date]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ⭐ Marquer matin/après-midi/retard
  const setMorning = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      return { ...s, morningStatus: status };
    }));
    isDirtyRef.current = true;
    setSaveStatus("idle");
  };

  const setAfternoon = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      return { ...s, afternoonStatus: status };
    }));
    isDirtyRef.current = true;
    setSaveStatus("idle");
  };

  const toggleLate = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      return { ...s, late: !s.late };
    }));
    isDirtyRef.current = true;
    setSaveStatus("idle");
  };

  // Sauvegarder
  const handleSave = useCallback(async (silent = false) => {
    if (!isDirtyRef.current || studentsRef.current.length === 0) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const records = studentsRef.current
        .filter(s => s && s.studentId && typeof s.studentId === 'string')
        .map(s => ({
          studentId: s.studentId,
          status: s.status || 'PRESENT',
          morningStatus: s.morningStatus || 'PRESENT',
          afternoonStatus: s.afternoonStatus || 'PRESENT',
          late: !!s.late,
        }));

      if (records.length === 0) throw new Error('Aucun élève valide à enregistrer');

      const selectedClass = classes.find(c => c.classId === selectedClassId);
      const resolvedSchoolLevelId = schoolLevelId || selectedClass?.schoolLevelId || '';

      const res = await fetch("/api/pedagogy-space/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId,
          schoolLevelId: resolvedSchoolLevelId,
          classId: selectedClassId,
          date,
          records,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
      isDirtyRef.current = false;
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      if (!silent) toast.success("✅ Appel enregistré");
    } catch (e: any) {
      setSaveStatus("error");
      if (!silent) toast.error("Erreur d'enregistrement", { description: e.message });
    } finally { setSaving(false); }
  }, [academicYearId, schoolLevelId, selectedClassId, date, classes]);

  // Auto-save 5s
  useEffect(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(async () => {
      if (isDirtyRef.current && !saving && studentsRef.current.length > 0) {
        await handleSave(true);
      }
    }, 5000);
    return () => {
      if (autoSaveTimerRef.current) { clearInterval(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    };
  }, [handleSave, saving]);

  // Sauvegarde avant déchargement
  useEffect(() => {
    const handler = async () => {
      if (isDirtyRef.current && studentsRef.current.length > 0) {
        const records = studentsRef.current.map(s => ({
          studentId: s.studentId, status: s.status || 'PRESENT',
          morningStatus: s.morningStatus || 'PRESENT',
          afternoonStatus: s.afternoonStatus || 'PRESENT', late: !!s.late,
        }));
        try {
          navigator.sendBeacon("/api/pedagogy-space/attendance",
            new Blob([JSON.stringify({ academicYearId, schoolLevelId, classId: selectedClassId, date, records })],
              { type: "application/json" }));
        } catch {}
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [academicYearId, schoolLevelId, selectedClassId, date]);

  // Stats rapides
  const presentMatin = students.filter(s => s.morningStatus === "PRESENT").length;
  const absentMatin = students.filter(s => s.morningStatus === "ABSENT").length;
  const presentSoir = students.filter(s => s.afternoonStatus === "PRESENT").length;
  const absentSoir = students.filter(s => s.afternoonStatus === "ABSENT").length;
  const retards = students.filter(s => s.late).length;

  const renderSaveBadge = () => {
    switch (saveStatus) {
      case "saving": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold"><Cloud className="h-3.5 w-3.5 animate-pulse" /> Enregistrement…</span>;
      case "saved": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold"><CheckCircle2 className="h-3.5 w-3.5" /> Enregistré{lastSavedAt && <span className="font-normal opacity-70"> à {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}</span>;
      case "error": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold"><CloudOff className="h-3.5 w-3.5" /> Erreur — réessayer</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"><Clock className="h-3.5 w-3.5" /> Auto-save actif (5s)</span>;
    }
  };

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-slate-900">Appel Journalier</h3>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          {renderSaveBadge()}
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="h-9 min-w-[200px] px-3 rounded-lg border border-slate-200 text-sm">
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          <button onClick={() => handleSave(false)} disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer maintenant
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">☀️ Matin: {presentMatin} présents, {absentMatin} absents</span>
          <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">🌙 Après-midi: {presentSoir} présents, {absentSoir} absents</span>
          {retards > 0 && <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">⏰ {retards} retard(s)</span>}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-600">
          <strong>Marquage :</strong> Pour chaque élève, marquez le matin (PM/AM) et l'après-midi (PS/AS).
          Les absences sont comptées en demi-jours : 1 demi-jour par demi-journée d'absence.
          Le bouton <strong>Retard</strong> notifie automatiquement les parents.
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Aucun élève dans cette classe.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 font-semibold text-slate-700">N°</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Nom</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={2}>☀️ Matin</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={2}>🌙 Après-midi</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700">⏰ Retard</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th colSpan={2}></th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-emerald-600">Présent</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-red-600">Absent</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-emerald-600">Présent</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-red-600">Absent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...students].sort((a, b) => {
                const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                return aName.localeCompare(bName, 'fr');
              }).map((s, idx) => (
                <tr key={s.studentId} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                  {/* Matin : PM / AM */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setMorning(s.studentId, 'PRESENT')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors",
                        s.morningStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      PM
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setMorning(s.studentId, 'ABSENT')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors",
                        s.morningStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      AM
                    </button>
                  </td>
                  {/* Après-midi : PS / AS */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setAfternoon(s.studentId, 'PRESENT')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors",
                        s.afternoonStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      PS
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setAfternoon(s.studentId, 'ABSENT')}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors",
                        s.afternoonStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      AS
                    </button>
                  </td>
                  {/* Retard */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => toggleLate(s.studentId)}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold transition-colors",
                        s.late ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      Retard
                    </button>
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
