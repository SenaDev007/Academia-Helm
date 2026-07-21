"use client";

/**
 * ============================================================================
 * APPEL JOURNALIER — Avec auto-save toutes les 5 secondes
 * ============================================================================
 *
 * Fonctionnement :
 *   - L'enseignant sélectionne une classe + date
 *   - Les élèves s'affichent avec 3 boutons (Présent / Absent / Retard)
 *   - Auto-save toutes les 5 secondes (si des changements sont détectés)
 *   - Bouton "Enregistrer maintenant" pour sauvegarder manuellement
 *   - Indicateur visuel de l'état de sauvegarde (à jour / en cours / erreur)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CalendarCheck, Loader2, Save, RefreshCw, Check, X, Clock,
  CheckCircle2, AlertCircle, Cloud, CloudOff,
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

  // Suivi des modifications non sauvegardées
  const isDirtyRef = useRef(false);
  const studentsRef = useRef<any[]>(students);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchroniser la ref avec le state
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

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
      const list = Array.isArray(data) ? data : [];
      setStudents(list);
      isDirtyRef.current = false;
      setSaveStatus("idle");
    } catch { setStudents([]); }
    finally { setLoading(false); }
  }, [selectedClassId, date]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // Marquer "dirty" quand un statut change
  const setStatus = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
    isDirtyRef.current = true;
    setSaveStatus("idle");
  };

  // Sauvegarder (réutilisé par bouton ET auto-save)
  const handleSave = useCallback(async (silent = false) => {
    if (!isDirtyRef.current || studentsRef.current.length === 0) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const records = studentsRef.current.map(s => ({ studentId: s.studentId, status: s.status }));

      // ⭐ Résoudre schoolLevelId depuis la classe sélectionnée (au cas où
      // schoolLevelId prop est vide — ex: "Tous les niveaux" sélectionné).
      // Le backend fait aussi cette résolution, mais on l'envoie quand même
      // pour éviter les erreurs FK quand le backend n'est pas encore déployé.
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

  // ⭐ AUTO-SAVE toutes les 5 secondes si des changements sont détectés
  useEffect(() => {
    // Nettoyer l'ancien timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    // Nouveau timer : check toutes les 5 secondes
    autoSaveTimerRef.current = setInterval(async () => {
      if (isDirtyRef.current && !saving && studentsRef.current.length > 0) {
        await handleSave(true); // silent = true pour auto-save
      }
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [handleSave, saving]);

  // ⭐ Sauvegarde avant déchargement de la page / changement d'onglet
  useEffect(() => {
    const handler = async () => {
      if (isDirtyRef.current && studentsRef.current.length > 0) {
        // Utiliser sendBeacon pour ne pas bloquer la navigation
        const records = studentsRef.current.map(s => ({ studentId: s.studentId, status: s.status }));
        const payload = JSON.stringify({ academicYearId, schoolLevelId, classId: selectedClassId, date, records });
        try {
          navigator.sendBeacon(
            "/api/pedagogy-space/attendance",
            new Blob([payload], { type: "application/json" })
          );
        } catch { /* silent */ }
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [academicYearId, schoolLevelId, selectedClassId, date]);

  const present = students.filter(s => s.status === "PRESENT").length;
  const absent = students.filter(s => s.status === "ABSENT").length;
  const late = students.filter(s => s.status === "LATE").length;

  // Badge d'état de sauvegarde
  const renderSaveBadge = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
            <Cloud className="h-3.5 w-3.5 animate-pulse" /> Enregistrement…
          </span>
        );
      case "saved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré
            {lastSavedAt && (
              <span className="font-normal opacity-70">
                à {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold">
            <CloudOff className="h-3.5 w-3.5" /> Erreur — réessayer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
            <Clock className="h-3.5 w-3.5" /> Auto-save actif (5s)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête avec classe + date + actions + badge */}
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
              {[...students].sort((a, b) => {
                const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                return aName.localeCompare(bName, 'fr');
              }).map((s, idx) => (
                <tr key={s.studentId} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {["PRESENT", "ABSENT", "LATE"].map(st => (
                        <button key={st} onClick={() => setStatus(s.studentId, st)}
                          className={cn(
                            "px-3 py-1.5 rounded text-xs font-bold transition-colors",
                            s.status === st
                              ? st === "PRESENT" ? "bg-emerald-500 text-white"
                                : st === "ABSENT" ? "bg-red-500 text-white"
                                : "bg-amber-500 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          )}>
                          {st === "PRESENT" ? "Présent" : st === "ABSENT" ? "Absent" : "Retard"}
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
