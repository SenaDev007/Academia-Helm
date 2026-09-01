"use client";

/**
 * ============================================================================
 * APPEL JOURNALIER — Avec marquage Morning/Afternoon/Excused + Auto-save 5s
 * ============================================================================
 *
 * Système de marquage (demi-jours) :
 *   - 3 boutons par élève pour le MATIN : PM (Present), AM (Absent), EM (Excused)
 *   - 3 boutons par élève pour l'APRÈS-MIDI : PS (Present), AS (Absent), ES (Excused)
 *   - Bouton "Late" pour notifier les parents
 *   - Auto-save toutes les 5 secondes si changements détectés
 *   - Sync automatique vers le Registre d'Appel mensuel
 *
 * ⭐ FIX BUG DÉMI-JOURNÉES (commit 2026-08-16) :
 *   - Avant : le hack JSON dans `notes` + cache BFF 60s causait un stale read
 *     → le second save écrasait le premier avec des PRESENT par défaut
 *   - Maintenant : colonnes dédiées amStatus/pmStatus/eveningStatus + cache no-store
 *     → chaque période est persistée indépendamment, plus d'écrasement
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

  // ⭐ FIX : Mettre à jour studentsRef IMMÉDIATEMENT (pas via useEffect)
  const updateStudents = (updater: (prev: any[]) => any[]) => {
    const newState = updater(studentsRef.current);
    studentsRef.current = newState;
    setStudents(newState);
    isDirtyRef.current = true;
    setSaveStatus("idle");
  };

  // Charger mes classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}&language=EN`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].classId);
      } catch { setClasses([]); }
    })();
  }, [teacherId, academicYearId]);

  // ⭐ Charger l'appel — cache: 'no-store' pour éviter le stale read
  //    (defense-in-depth : le BFF applique aussi no-store sur /attendance)
  const loadAttendance = useCallback(async () => {
    if (!selectedClassId || !date) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/attendance/${selectedClassId}?date=${date}`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      studentsRef.current = list;
      setStudents(list);
      isDirtyRef.current = false;
      setSaveStatus("idle");
    } catch {
      studentsRef.current = [];
      setStudents([]);
    } finally { setLoading(false); }
  }, [selectedClassId, date]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ⭐ Marquer matin/après-midi/excusé/retard
  const setMorning = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    updateStudents(prev => prev.map(s => s.studentId !== studentId ? s : { ...s, morningStatus: status }));
  };

  const setAfternoon = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    updateStudents(prev => prev.map(s => s.studentId !== studentId ? s : { ...s, afternoonStatus: status }));
  };

  const toggleLate = (studentId: string) => {
    updateStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      return { ...s, late: !s.late };
    }));
  };

  // ⭐ Marquer toute la journée (raccourci)
  const markAllPresent = () => {
    updateStudents(prev => prev.map(s => ({ ...s, morningStatus: 'PRESENT', afternoonStatus: 'PRESENT', late: false })));
  };

  // ⭐ Sauvegarder — envoie amStatus/pmStatus/eveningStatus/late au backend
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
          eveningStatus: s.eveningStatus || 'PRESENT',
          late: !!s.late,
          notes: s.notes || undefined,
        }));

      if (records.length === 0) throw new Error('No valid student to save');

      const selectedClass = classes.find(c => c.classId === selectedClassId);
      const bodyPayload: any = {
        academicYearId,
        classId: selectedClassId,
        date,
        records,
      };
      const resolvedSchoolLevelId = schoolLevelId || selectedClass?.schoolLevelId || '';
      if (resolvedSchoolLevelId && resolvedSchoolLevelId.length > 10) {
        bodyPayload.schoolLevelId = resolvedSchoolLevelId;
      }

      const res = await fetch("/api/pedagogy-space/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
      isDirtyRef.current = false;
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      if (!silent) toast.success("✅ Attendance saved");

      // ⭐ Notifier les autres onglets (ex: Registre d'appels) qu'un appel a été sauvegardé.
      //    Le Registre écoute cet event et recharge son tableau automatiquement.
      //    Sans ça, l'enseignant doit manuellement changer de mois ou recharger la page
      //    pour voir les absences apparaître dans le registre mensuel.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('attendance:saved', {
          detail: {
            classId: selectedClassId,
            date,
            academicYearId,
          },
        }));
      }
    } catch (e: any) {
      setSaveStatus("error");
      if (!silent) toast.error("Save error", { description: e.message });
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
          afternoonStatus: s.afternoonStatus || 'PRESENT',
          eveningStatus: s.eveningStatus || 'PRESENT',
          late: !!s.late,
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
  const presentMorning = students.filter(s => s.morningStatus === "PRESENT").length;
  const absentMorning = students.filter(s => s.morningStatus === "ABSENT").length;
  const excusedMorning = students.filter(s => s.morningStatus === "EXCUSED").length;
  const presentAprem = students.filter(s => s.afternoonStatus === "PRESENT").length;
  const absentAprem = students.filter(s => s.afternoonStatus === "ABSENT").length;
  const excusedAprem = students.filter(s => s.afternoonStatus === "EXCUSED").length;
  const retards = students.filter(s => s.late).length;

  const renderSaveBadge = () => {
    switch (saveStatus) {
      case "saving": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold"><Cloud className="h-3.5 w-3.5 animate-pulse" /> Enregistrement…</span>;
      case "saved": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold"><CheckCircle2 className="h-3.5 w-3.5" /> Enregistré{lastSavedAt && <span className="font-normal opacity-70"> à {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}</span>;
      case "error": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold"><CloudOff className="h-3.5 w-3.5" /> Error — retry</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"><Clock className="h-3.5 w-3.5" /> Auto-save actif (5s)</span>;
    }
  };

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-slate-900">Daily Attendance</h3>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          {renderSaveBadge()}
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="h-9 min-w-[200px] px-3 rounded-lg border border-slate-200 text-sm">
            {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
          {students.length > 0 && (
            <button onClick={markAllPresent}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Tous présents
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
            ☀️ Morning: {presentMorning} présents, {absentMorning} absents{excusedMorning > 0 && `, ${excusedMorning} excusés`}
          </span>
          <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
            🌙 Afternoon: {presentAprem} présents, {absentAprem} absents{excusedAprem > 0 && `, ${excusedAprem} excusés`}
          </span>
          {retards > 0 && <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">⏰ {retards} retard(s)</span>}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-600">
          <strong>Marquage :</strong> Pour chaque élève, marquez le matin (PM/AM/EM) et l'après-midi (PS/AS/ES).
          <strong> EM/ES = Excused</strong> (ne compte pas comme absence, justifié).
          Les absences sont comptées en demi-jours. Le bouton <strong>Late</strong> notifie les parents.
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No students in this class.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 font-semibold text-slate-700">No.</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Nom</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={3}>☀️ Morning</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={3}>🌙 Afternoon</th>
                <th className="text-center px-2 py-2 font-semibold text-slate-700">⏰ Late</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th colSpan={2}></th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-emerald-600">Present</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-red-600">Absent</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-purple-600">Excused</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-emerald-600">Present</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-red-600">Absent</th>
                <th className="text-center px-2 py-1 text-[10px] font-bold text-purple-600">Excused</th>
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
                  {/* Morning : PM / AM / EM */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setMorning(s.studentId, 'PRESENT')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.morningStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      PM
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setMorning(s.studentId, 'ABSENT')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.morningStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      AM
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setMorning(s.studentId, 'EXCUSED')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.morningStatus === 'EXCUSED' ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      EM
                    </button>
                  </td>
                  {/* Afternoon : PS / AS / ES */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setAfternoon(s.studentId, 'PRESENT')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.afternoonStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      PS
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setAfternoon(s.studentId, 'ABSENT')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.afternoonStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      AS
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setAfternoon(s.studentId, 'EXCUSED')}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.afternoonStatus === 'EXCUSED' ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      ES
                    </button>
                  </td>
                  {/* Late */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => toggleLate(s.studentId)}
                      className={cn("px-2.5 py-1.5 rounded text-xs font-bold transition-colors",
                        s.late ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      Late
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
