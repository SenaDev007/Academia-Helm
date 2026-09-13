"use client";

/**
 * ============================================================================
 * Parent Portal — Présences (Module dédié)
 * ============================================================================
 *
 * Historique complet de l'assiduité de l'enfant, organisé en collapses hiérarchisés :
 *   ▼ Trimestre 1
 *       ▼ Septembre 2026
 *           - Mercredi 30 septembre : Présent
 *           - Lundi 28 septembre : Demi-journée (Matin: Absent · Après-midi: Présent)
 *       ▶ Octobre 2026
 *   ▶ Trimestre 2
 *   ▶ Trimestre 3
 *
 * Aucun sélecteur — tout est dépliable/repliable.
 * Les trimestres et mois sont auto-générés depuis les données réelles.
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

// ─── Attendance helpers ──────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  date: string;
  status: string;
  notes?: any;
}

interface MonthGroup {
  monthKey: string; // "2026-08"
  monthLabel: string; // "Août 2026"
  records: AttendanceRecord[];
}

interface TrimesterGroup {
  trimesterNumber: number;
  trimesterLabel: string;
  months: MonthGroup[];
}

// ─── Determine trimester from date ──────────────────────────────────────────
// T1: Sep–Dec, T2: Jan–Mar, T3: Apr–Jun
// (July/Aug are between T3 and T1 — assigned to T1 of next year, but for simplicity
//  we'll include Jul/Aug in T3 of previous year OR T1 — depends on school calendar)
// We'll use: Sep-Dec = T1, Jan-Mar = T2, Apr-Jun = T3, Jul-Aug = T1 (summer/preparation)

function getTrimesterNumber(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  if (month >= 8 && month <= 11) return 1; // Sep-Dec → T1
  if (month >= 0 && month <= 2) return 2;  // Jan-Mar → T2
  if (month >= 3 && month <= 5) return 3;  // Apr-Jun → T3
  return 1; // Jul-Aug → T1 (summer/preparation for next year)
}

const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ─── Main Page ───────────────────────────────────────────────────────────────

/** v4.3.0 — format() sur date valide uniquement (sinon RangeError date-fns). */
function safeFormatDate(date: unknown): string {
  try {
    const d = new Date(date as any);
    if (!date || Number.isNaN(d.getTime())) return String(date ?? '');
    return format(d, "EEEE d MMMM yyyy", { locale: fr });
  } catch {
    return String(date ?? '');
  }
}

export default function ParentAttendancePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapsible state
  const [openTrimesters, setOpenTrimesters] = useState<Set<number>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

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

  // ── Load ALL attendance records ────────────────────────────────────────────
  const loadAttendance = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/attendance/${selectedStudent}`, { credentials: "include" });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudent) loadAttendance();
  }, [loadAttendance, selectedStudent]);

  // ── Group records by trimester → month ─────────────────────────────────────
  const trimesterGroups = useMemo<TrimesterGroup[]>(() => {
    const trimesterMap = new Map<number, Map<string, AttendanceRecord[]>>();

    for (const r of records) {
      const d = new Date(r.date);
      // v4.3.0 — null-safety : une date absente/invalide (reponse partielle
      // hors ligne) ne doit jamais produire un RangeError date-fns ->
      // error boundary. On ignore l'enregistrement mal forme.
      if (!r?.date || Number.isNaN(d.getTime())) continue;
      const trimNum = getTrimesterNumber(d);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;

      if (!trimesterMap.has(trimNum)) {
        trimesterMap.set(trimNum, new Map());
      }
      const monthMap = trimesterMap.get(trimNum)!;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(r);
    }

    // Build sorted array
    const groups: TrimesterGroup[] = [];
    for (const [trimNum, monthMap] of trimesterMap) {
      const months: MonthGroup[] = [];
      for (const [monthKey, recs] of monthMap) {
        const [yearStr, monthStr] = monthKey.split('-');
        const monthIdx = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        // Sort records within month by date DESC
        recs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        months.push({
          monthKey,
          monthLabel: `${monthLabels[monthIdx]} ${year}`,
          records: recs,
        });
      }
      // Sort months chronologically within trimester
      months.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      groups.push({
        trimesterNumber: trimNum,
        trimesterLabel: `Trimestre ${trimNum}`,
        months,
      });
    }
    // Sort trimesters 1, 2, 3
    groups.sort((a, b) => a.trimesterNumber - b.trimesterNumber);
    return groups;
  }, [records]);

  // ── Auto-expand first trimester + first month on load ─────────────────────
  useEffect(() => {
    if (trimesterGroups.length > 0) {
      const firstTrim = trimesterGroups[0];
      setOpenTrimesters(new Set([firstTrim.trimesterNumber]));
      if (firstTrim.months.length > 0) {
        setOpenMonths(new Set([firstTrim.months[0].monthKey]));
      }
    }
  }, [trimesterGroups]);

  // ── Toggle handlers ────────────────────────────────────────────────────────
  const toggleTrimester = (trimNum: number) => {
    setOpenTrimesters(prev => {
      const next = new Set(prev);
      if (next.has(trimNum)) next.delete(trimNum);
      else next.add(trimNum);
      return next;
    });
  };

  const toggleMonth = (monthKey: string) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  // ── Compute overall stats (all records) ────────────────────────────────────
  const stats = records.reduce((acc, r) => {
    acc.total++;
    const display = getAttendanceDisplay(r);
    if (display.label === "Présent") acc.present++;
    else if (display.label === "Absent") acc.absent++;
    else if (display.label === "Demi-journée" || display.label === "En retard") acc.late++;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0 });

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

      {/* Stats cards (overall) */}
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

      {/* Hierarchical collapses: Trimester → Month → Records */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : trimesterGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune donnée d'assiduité enregistrée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trimesterGroups.map((trimester) => {
            const isTrimOpen = openTrimesters.has(trimester.trimesterNumber);
            const trimRecordCount = trimester.months.reduce((sum, m) => sum + m.records.length, 0);

            return (
              <div key={trimester.trimesterNumber} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Trimester header (clickable) */}
                <button
                  onClick={() => toggleTrimester(trimester.trimesterNumber)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isTrimOpen ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      T{trimester.trimesterNumber}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-slate-900">{trimester.trimesterLabel}</h3>
                      <p className="text-xs text-slate-500">
                        {trimester.months.length} mois · {trimRecordCount} enregistrement(s)
                      </p>
                    </div>
                  </div>
                </button>

                {/* Months (collapsible) */}
                {isTrimOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {trimester.months.map((month) => {
                      const isMonthOpen = openMonths.has(month.monthKey);
                      const monthPresent = month.records.filter(r => getAttendanceDisplay(r).label === "Présent").length;
                      const monthAbsent = month.records.filter(r => getAttendanceDisplay(r).label === "Absent").length;
                      const monthLate = month.records.filter(r => {
                        const d = getAttendanceDisplay(r);
                        return d.label === "Demi-journée" || d.label === "En retard";
                      }).length;

                      return (
                        <div key={month.monthKey} className="px-4">
                          {/* Month header (clickable) */}
                          <button
                            onClick={() => toggleMonth(month.monthKey)}
                            className="w-full py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isMonthOpen ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <div className="text-left">
                                <div className="text-sm font-semibold text-slate-900">{month.monthLabel}</div>
                                <div className="text-xs text-slate-500">
                                  {month.records.length} jour(s) · {monthPresent} présent(s) · {monthAbsent} absent(s) · {monthLate} demi-journée(s)
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Records (collapsible) */}
                          {isMonthOpen && (
                            <div className="pb-3 space-y-2">
                              {month.records.map((r, i) => {
                                const display = getAttendanceDisplay(r);
                                const Icon = display.icon;
                                return (
                                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", display.color)}>
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-slate-900">
                                          {safeFormatDate(r.date)}
                                        </span>
                                        <span className={cn(
                                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                                          display.color,
                                        )}>
                                          {display.label}
                                        </span>
                                      </div>
                                      {display.detail && (
                                        <p className="text-xs text-slate-600 mt-1">
                                          {display.detail}
                                        </p>
                                      )}
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
          })}
        </div>
      )}
    </div>
  );
}
