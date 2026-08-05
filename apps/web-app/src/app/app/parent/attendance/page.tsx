"use client";

/**
 * ============================================================================
 * Parent Portal — Présences (Module dédié)
 * ============================================================================
 *
 * Historique complet de l'assiduité de l'enfant :
 *   - Sélecteur de trimestre (T1, T2, T3)
 *   - Sélecteur de mois ( filtrage par mois dans le trimestre)
 *   - Historique jour par jour avec statut + détail (matin/après-midi)
 *   - Stats: jours enregistrés, présents, absents, demi-journées
 *
 * Gère les statuts : PRESENT, ABSENT, ABSENT_HALF, LATE
 * + Parse les notes JSON {morning, afternoon, late} pour affichage détaillé
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CalendarCheck, Loader2, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Attendance helpers (shared with child detail page) ─────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PRESENT: { label: "Présent", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  ABSENT: { label: "Absent", color: "bg-red-100 text-red-700", icon: XCircle },
  ABSENT_HALF: { label: "Demi-journée", color: "bg-amber-100 text-amber-700", icon: Clock },
  LATE: { label: "En retard", color: "bg-amber-100 text-amber-700", icon: Clock },
};

function parseAttendanceNotes(notes: any): { morning?: string; afternoon?: string; late?: boolean; raw?: string } {
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return { raw: notes };
    }
  }
  return { raw: String(notes) };
}

function getAttendanceDisplay(record: { status: string; notes?: any }): { label: string; color: string; icon: any; detail: string } {
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.PRESENT;
  const parsed = parseAttendanceNotes(record.notes);

  if (parsed.morning && parsed.afternoon) {
    const morningLabel = parsed.morning === 'PRESENT' ? 'Présent' : parsed.morning === 'ABSENT' ? 'Absent' : parsed.morning === 'LATE' ? 'En retard' : parsed.morning;
    const afternoonLabel = parsed.afternoon === 'PRESENT' ? 'Présent' : parsed.afternoon === 'ABSENT' ? 'Absent' : parsed.afternoon === 'LATE' ? 'En retard' : parsed.afternoon;

    if (parsed.morning === parsed.afternoon) {
      return { label: morningLabel, color: cfg.color, icon: cfg.icon, detail: '' };
    }

    return {
      label: 'Demi-journée',
      color: 'bg-amber-100 text-amber-700',
      icon: Clock,
      detail: `Matin: ${morningLabel} · Après-midi: ${afternoonLabel}`,
    };
  }

  return { label: cfg.label, color: cfg.color, icon: cfg.icon, detail: parsed.raw || '' };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ParentAttendancePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrimester, setSelectedTrimester] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number | "ALL">("ALL");

  // ── Load children ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  // ── Load ALL attendance records (no month filter — we filter client-side) ─
  const loadAttendance = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      // Fetch all records (no month param) to allow trimester filtering
      const res = await fetch(`/api/parent/attendance/${selectedStudent}`, { credentials: "include" });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudent) loadAttendance();
  }, [loadAttendance, selectedStudent]);

  // ── Trimester → month ranges ──────────────────────────────────────────────
  // T1: Sep-Dec, T2: Jan-Mar, T3: Apr-Jun
  const trimesterMonths: Record<number, number[]> = {
    1: [8, 9, 10, 11], // Sep, Oct, Nov, Dec (0-indexed)
    2: [0, 1, 2],      // Jan, Feb, Mar
    3: [3, 4, 5],      // Apr, May, Jun
  };
  const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // ── Filter records by trimester + month ───────────────────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const d = new Date(r.date);
      const month = d.getMonth(); // 0-indexed
      const allowedMonths = trimesterMonths[selectedTrimester] || [];
      if (!allowedMonths.includes(month)) return false;
      if (selectedMonth !== "ALL" && month !== selectedMonth) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, selectedTrimester, selectedMonth]);

  // ── Compute stats ─────────────────────────────────────────────────────────
  const stats = filteredRecords.reduce((acc, r) => {
    acc.total++;
    const display = getAttendanceDisplay(r);
    if (display.label === "Présent") acc.present++;
    else if (display.label === "Absent") acc.absent++;
    else if (display.label === "Demi-journée" || display.label === "En retard") acc.late++;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0 });

  // ── Available months in the selected trimester ────────────────────────────
  const availableMonths = useMemo(() => {
    const months = trimesterMonths[selectedTrimester] || [];
    return months.map(m => ({ value: m, label: monthLabels[m] }));
  }, [selectedTrimester]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-bold text-slate-900">Présences</h2>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
          <span className="text-sm font-semibold text-slate-700">Enfant :</span>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters: Trimester + Month */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Trimestre
          </label>
          <select
            value={selectedTrimester}
            onChange={(e) => {
              setSelectedTrimester(Number(e.target.value));
              setSelectedMonth("ALL");
            }}
            className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>Trimestre 1</option>
            <option value={2}>Trimestre 2</option>
            <option value={3}>Trimestre 3</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Mois
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="w-full text-sm font-semibold border border-gray-200 bg-gray-50 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les mois</option>
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 uppercase">Jours enregistrés</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
          <p className="text-xs text-emerald-700 uppercase">Présents</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
          <p className="text-xs text-red-700 uppercase">Absents</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{stats.late}</p>
          <p className="text-xs text-amber-700 uppercase">Demi-journées / Retards</p>
        </div>
      </div>

      {/* History table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-700">
              Historique — Trimestre {selectedTrimester}
              {selectedMonth !== "ALL" && ` · ${monthLabels[selectedMonth as number]}`}
            </h3>
            <p className="text-xs text-slate-500">{filteredRecords.length} enregistrement(s)</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Détail</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, i) => {
                const display = getAttendanceDisplay(r);
                return (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {format(new Date(r.date), "EEEE d MMMM yyyy", { locale: fr })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded text-xs font-bold",
                        display.color,
                      )}>
                        {display.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {display.detail || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Aucune donnée d'assiduité pour Trimestre {selectedTrimester}
            {selectedMonth !== "ALL" && ` · ${monthLabels[selectedMonth as number]}`}.
          </p>
        </div>
      )}
    </div>
  );
}
