"use client";

/**
 * ============================================================================
 * WEEKLY RECORD OF WORK — EN track (V2)
 * ============================================================================
 *
 * Grid: subjects (rows) × 12 weeks (columns) per term.
 * Each cell is a RichTextEditor where the teacher records what was done
 * that week for that subject.
 *
 * ⭐ V2 — CORRECTIONS DEMANDÉES :
 *   1. Colonnes de semaines DOUBLÉES (minWidth 2800px + éditeurs plus hauts)
 *   2. Dates de fin de semaine sous chaque colonne (même schéma que le
 *      cahier journal : on fixe la fin de la 1ère semaine, les 11 suivantes
 *      sont calculées +7 jours — persistées en base via weekDates)
 *   3. Catalogue année par année (WeeklyRecordCatalogueTab — sous-onglet)
 *   4. Soumission → Director Validation (pattern Scheme of Work) :
 *      le directeur voit le même tableau + colonne Observations par matière
 *      + section Observations générales
 *   5. "HEAD TEACHER'S INITIAL AND DATE" = vrais champs (initiales + date +
 *      signature) persistés en base
 *   6. PDF découpé en pages de 3 colonnes de semaines (1-3, 4-6, 7-9, 10-12)
 *
 * ⭐ documentType = 'WEEKLY_RECORD' sur tous les appels API — sépare
 *    proprement le Weekly Record du Scheme of Work (même table monthly_plans,
 *    même month = "First Term"/...).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Send, Bell,
  AlertCircle, Info, CheckCircle2, XCircle, Clock,
  Download, X, Check, CalendarDays, PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { translateClassName } from "@/lib/pedagogy/class-name-en";
import {
  WEEKS_PER_TERM, WEEK_LABELS,
  computeWeekDates, currentFriday, parseWeekDatesJson, formatDateEN,
  exportWeeklyRecordPdf, type WeeklyRecordCellData,
} from "@/lib/pedagogy/weekly-record-pdf";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface WeeklyCell {
  id?: string;
  weekNumber: number;   // Always 0 (not used for weekly record — weeks are in subDomain)
  domain: string;       // subject name
  subDomain?: string;   // week number as string: "1", "2", ..., "12" (or "DIRECTOR_OBS")
  content: string;
  isAutoProposed: boolean;
  isCustom: boolean;
}

interface WeeklyPlanResponse {
  cells: WeeklyCell[];
  hasExistingCustom: boolean;
  status?: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED";
  teacherSignature?: string | null;
  directorSignature?: string | null;
  directorObservation?: string | null;
  headTeacherInitials?: string | null;
  headTeacherDate?: string | null;
  headTeacherSignature?: string | null;
  weekDates?: string | null;
}

interface AvailableClass {
  value: string;
  label: string;
  classId?: string;
  className?: string;
  subjects?: Array<{ id: string; name: string; code: string; language?: string }>;
  totalStudents?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

type TermKey = "First Term" | "Second Term" | "Third Term";

const TERMS: Array<{ value: TermKey; label: string; short: string; color: string }> = [
  { value: "First Term",  label: "First Term",  short: "1ST TERM", color: "bg-blue-600" },
  { value: "Second Term", label: "Second Term", short: "2ND TERM", color: "bg-emerald-600" },
  { value: "Third Term",  label: "Third Term",  short: "3RD TERM", color: "bg-amber-600" },
];

const DOC_TYPE = "WEEKLY_RECORD";

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",     color: "bg-slate-100 text-slate-700",  icon: Calendar },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700",    icon: Send },
  VALIDATED: { label: "Validated", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",  color: "bg-red-100 text-red-700",     icon: XCircle },
};

function cn2(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

async function pedagogyFetch<T>(url: string, options?: { method?: string; body?: any }): Promise<T> {
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error || `Error ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export function WeeklyRecordOfWorkTab({
  tenantId, academicYearId, teacherId,
}: {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}) {
  const { user } = useAppSession();
  const { tenant, academicYear } = useModuleContext();
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifyingDirector, setNotifyingDirector] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [cells, setCells] = useState<WeeklyCell[]>([]);
  const [planStatus, setPlanStatus] = useState<"DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED">("DRAFT");
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [directorObservation, setDirectorObservation] = useState<string | null>(null);
  const [directorName, setDirectorName] = useState<string>("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  // ⭐ V2 : pad de signature Head Teacher
  const [showHeadTeacherSignPad, setShowHeadTeacherSignPad] = useState(false);

  // ⭐ V2 : dates de semaines (pattern cahier journal) — 12 dates YYYY-MM-DD
  const [weekDates, setWeekDates] = useState<string[]>(() => computeWeekDates(
    `${currentFriday().getFullYear()}-${String(currentFriday().getMonth() + 1).padStart(2, '0')}-${String(currentFriday().getDate()).padStart(2, '0')}`
  ));

  // ⭐ V2 : champs Head Teacher persistés
  const [headTeacherInitials, setHeadTeacherInitials] = useState("");
  const [headTeacherDate, setHeadTeacherDate] = useState("");
  const [headTeacherSignature, setHeadTeacherSignature] = useState<string | null>(null);

  const [loadedClasses, setLoadedClasses] = useState<AvailableClass[]>([]);
  const [selectedClassValue, setSelectedClassValue] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<TermKey>("First Term");

  const teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  const isReadOnly = planStatus === "SUBMITTED" || planStatus === "VALIDATED";
  const StatusBadge = STATUS_BADGES[planStatus] || STATUS_BADGES.DRAFT;
  const StatusIcon = StatusBadge.icon;
  const saveRef = useRef<() => Promise<void>>(async () => {});

  // ─── Load classes ───
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}&language=EN`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load classes");
        const data = await res.json();
        const list: AvailableClass[] = (Array.isArray(data) ? data : []).map((c: any) => ({
          value: c.classId || c.value || c.classLevel,
          label: translateClassName(c.className) || c.className || c.value,
          classId: c.classId,
          className: c.className,
          subjects: (c.subjects || []).filter((s: any) => {
            const lang = String(s?.subjectLanguage || s?.language || '').toUpperCase();
            return lang === 'EN' || lang === '';
          }).map((s: any) => ({
            id: s.subjectId || s.id,
            name: s.subjectName || s.name || '',
            code: s.subjectCode || s.code || '',
            language: s.subjectLanguage || s.language || '',
          })),
          totalStudents: c.totalStudents,
        }));
        setLoadedClasses(list);
        if (list.length > 0) setSelectedClassValue(list[0].value);
      } catch (e: any) {
        console.error("Failed to load classes:", e);
        setLoadedClasses([]);
      }
    })();
  }, [teacherId, academicYearId]);

  const selectedClass = useMemo(
    () => loadedClasses.find(c => c.value === selectedClassValue) || null,
    [loadedClasses, selectedClassValue]
  );
  const subjects = selectedClass?.subjects || [];

  // ─── Load plan (documentType=WEEKLY_RECORD) ───
  const loadPlan = useCallback(async () => {
    if (!academicYearId || !selectedClassValue) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await pedagogyFetch<WeeklyPlanResponse>(
        `/api/pedagogy/monthly-plans?academicYearId=${academicYearId}&classLevel=${encodeURIComponent(selectedClassValue)}&month=${encodeURIComponent(selectedTerm)}&teacherId=${teacherId}&documentType=${DOC_TYPE}`
      );
      setCells(data.cells || []);
      setPlanStatus(data.status || "DRAFT");
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      setDirectorObservation(data.directorObservation || null);
      // ⭐ Dates de semaines persistées → restauration (sinon défaut = vendredi courant)
      const savedDates = parseWeekDatesJson(data.weekDates);
      if (savedDates.length === WEEKS_PER_TERM) {
        setWeekDates(savedDates);
      }
      // ⭐ Champs Head Teacher persistés
      setHeadTeacherInitials(data.headTeacherInitials || "");
      setHeadTeacherDate(data.headTeacherDate || "");
      setHeadTeacherSignature(data.headTeacherSignature || null);
    } catch (e: any) {
      console.error("Failed to load weekly record:", e);
      setCells([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ─── Load director name ───
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setDirectorName(data.directorName || data.director_name || '');
        }
      } catch {}
    })();
  }, []);

  // ─── Dirty tracking (cells + dates + head teacher) ───
  const isDirtyRef = useRef(false);
  const markDirty = useCallback(() => { isDirtyRef.current = true; }, []);

  // ─── Save (cells + weekDates + head teacher) ───
  const handleSave = useCallback(async () => {
    if (!academicYearId || !selectedClassValue) return;
    setSaving(true);
    try {
      await pedagogyFetch("/api/pedagogy/monthly-plans/save", {
        method: "POST",
        body: {
          academicYearId,
          classLevel: selectedClassValue,
          month: selectedTerm,
          teacherId,
          cells,
          documentType: DOC_TYPE,
          weekDates: JSON.stringify(weekDates),
          headTeacherInitials: headTeacherInitials || null,
          headTeacherDate: headTeacherDate || null,
          headTeacherSignature: headTeacherSignature || null,
        },
      });
      isDirtyRef.current = false;
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, cells, weekDates, headTeacherInitials, headTeacherDate, headTeacherSignature]);
  saveRef.current = handleSave;

  // ─── Auto-save 5s (silencieux) ───
  const prevSnapshotRef = useRef("");
  useEffect(() => {
    const snapshot = JSON.stringify({ c: cells.length, d: weekDates[0], h: headTeacherInitials, hd: headTeacherDate, s: !!headTeacherSignature });
    if (prevSnapshotRef.current !== snapshot) {
      isDirtyRef.current = true;
      prevSnapshotRef.current = snapshot;
    }
  }, [cells, weekDates, headTeacherInitials, headTeacherDate, headTeacherSignature]);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isDirtyRef.current && !saving && !loading && !submitting) {
        await saveRef.current();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [saving, loading, submitting]);

  // ─── Submit (pattern Scheme of Work) ───
  const handleSubmit = useCallback(async () => {
    if (!academicYearId || !pendingSignature) {
      toast.error("Teacher signature required to submit.");
      return;
    }
    setSubmitting(true);
    try {
      await saveRef.current();
      const params = new URLSearchParams({
        academicYearId, classLevel: selectedClassValue,
        month: selectedTerm, teacherId: teacherId || 'unknown',
        documentType: DOC_TYPE,
      });
      const res = await fetch(`/api/pedagogy/monthly-plans/submit?${params.toString()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherSignature: pendingSignature,
          headTeacherInitials: headTeacherInitials || null,
          headTeacherDate: headTeacherDate || null,
          headTeacherSignature: headTeacherSignature || null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any)?.error || `Error ${res.status}`);
      }
      toast.success("Weekly Record of Work submitted to director");
      setShowSignatureModal(false);
      setPendingSignature(null);
      await loadPlan();
    } catch (e: any) {
      toast.error("Submission failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, pendingSignature, headTeacherInitials, headTeacherDate, headTeacherSignature, loadPlan]);

  // ─── Notify director ───
  const handleNotifyDirector = useCallback(async () => {
    if (!selectedClassValue) return;
    const ok = await confirmWarning(
      `Notify the director?`, 'Manual notification',
      `The director will receive a notification by:\n• Email\n• WhatsApp\n• SMS\n\nClass: ${selectedClass?.label || '—'}\nTerm: ${selectedTerm}`
    );
    if (!ok) return;
    setNotifyingDirector(true);
    try {
      const res = await fetch('/api/pedagogy-space/notify-director', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          classId: selectedClass?.classId || selectedClassValue,
          month: selectedTerm, year: new Date().getFullYear(),
          teacherId, channels: ['email', 'whatsapp', 'sms'],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success('✅ Director notified', { description: `Notification sent to ${data.notifiedDirectors || 'the director'}.` });
    } catch (e: any) {
      toast.error('Notification error', { description: e.message });
    } finally {
      setNotifyingDirector(false);
    }
  }, [selectedClassValue, selectedClass, selectedTerm, teacherId, confirmWarning]);

  // ─── PDF export (3 semaines par page) ───
  const handleExportPDF = useCallback(async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      let schoolInfo: any = {};
      try {
        const idRes = await fetch('/api/settings/identity', { credentials: 'include' });
        if (idRes.ok) schoolInfo = await idRes.json();
      } catch {}

      const pdfCells: WeeklyRecordCellData[] = cells
        .filter(c => c.subDomain !== 'DIRECTOR_OBS')
        .map(c => ({ domain: c.domain, subDomain: c.subDomain, content: c.content }));

      await exportWeeklyRecordPdf({
        subjectNames: subjects.map(s => s.name),
        cells: pdfCells,
        weekDates,
        termLabel: selectedTerm,
        classLabel: selectedClass?.label || selectedClassValue,
        academicYearLabel: academicYear?.label || String(new Date().getFullYear()),
        teacherName,
        teacherSignature,
        directorSignature,
        directorName,
        headTeacherInitials: headTeacherInitials || null,
        headTeacherDate: headTeacherDate || null,
        headTeacherSignature: headTeacherSignature || null,
        header: {
          schoolName: schoolInfo.schoolName || schoolInfo.name || tenant?.name || 'School',
          schoolLogoUrl: schoolInfo.logoUrl || schoolInfo.logo || (tenant?.id ? `/api/tenants/${tenant.id}/logo` : null),
          schoolAddress: schoolInfo.address || schoolInfo.schoolAddress || null,
          schoolPhone: schoolInfo.phone || schoolInfo.schoolPhone || null,
          schoolEmail: schoolInfo.email || schoolInfo.schoolEmail || null,
          schoolLevel: 'PRIMAIRE',
        },
      });
      toast.success('✅ PDF exported successfully');
    } catch (e: any) {
      console.error('PDF export error:', e);
      toast.error("Export error", { description: e.message });
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, subjects, cells, weekDates, selectedClassValue, selectedClass, selectedTerm, teacherId, academicYearId, tenant, teacherName, teacherSignature, directorSignature, directorName, headTeacherInitials, headTeacherDate, headTeacherSignature, academicYear]);

  // ─── Cell helpers ───
  function findCell(cellsArr: WeeklyCell[], subject: string, week: number): WeeklyCell | undefined {
    return cellsArr.find(c => c.domain === subject && (c.subDomain || "") === String(week));
  }

  const updateCellLocal = (subject: string, week: number, content: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.domain === subject && (c.subDomain || "") === String(week));
      if (idx === -1) {
        return [...prev, { weekNumber: 0, domain: subject, subDomain: String(week), content, isAutoProposed: false, isCustom: true }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], content, isCustom: true, isAutoProposed: false };
      return next;
    });
    markDirty();
  };

  // ⭐ Changement de la date de fin de la 1ère semaine → recalcul des 12 dates
  const handleFirstWeekChange = (value: string) => {
    if (!value) return;
    setWeekDates(computeWeekDates(value));
    markDirty();
  };

  // ⭐ Observations du directeur par matière (lignes DIRECTOR_OBS)
  const directorPerSubjectObs = useMemo(() => {
    return cells.filter(c => (c.subDomain || '') === 'DIRECTOR_OBS' && c.content);
  }, [cells]);

  // ─── Render ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Loading Weekly Record of Work…</span>
      </div>
    );
  }

  if (loadedClasses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-600">No class assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              Weekly Record of Work
              <span className={cn2("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", StatusBadge.color)}>
                <StatusIcon className="h-3 w-3" /> {StatusBadge.label}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {selectedClass?.label || '—'} — {selectedTerm} — {subjects.length} subject(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {loadedClasses.length > 1 ? (
            <select value={selectedClassValue} onChange={(e) => setSelectedClassValue(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white">
              {loadedClasses.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
              {loadedClasses[0]?.label}
            </span>
          )}
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value as TermKey)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white">
            {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving || isReadOnly}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
          {planStatus === "DRAFT" && (
            <button onClick={() => setShowSignatureModal(true)} disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit
            </button>
          )}
          <button onClick={handleNotifyDirector} disabled={notifyingDirector || !selectedClassValue}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
            {notifyingDirector ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Notify
          </button>
          <button onClick={handleExportPDF} disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </button>
          <button onClick={loadPlan}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className={cn2("rounded-lg p-3 text-xs flex items-start gap-2",
        planStatus === "VALIDATED" ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : planStatus === "SUBMITTED" ? "bg-blue-50 border border-blue-200 text-blue-700"
        : planStatus === "REJECTED" ? "bg-red-50 border border-red-200 text-red-700"
        : "bg-amber-50 border border-amber-200 text-amber-700")}>
        {planStatus === "VALIDATED" ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : planStatus === "SUBMITTED" ? <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : planStatus === "REJECTED" ? <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <div>
          <strong>{selectedTerm}</strong> — Weekly Record of Work for <strong>{selectedClass?.label}</strong>
          {planStatus === "SUBMITTED" && <div className="mt-1 font-semibold">📋 Submitted to director — pending validation.</div>}
          {planStatus === "VALIDATED" && <div className="mt-1 font-semibold">✅ Validated by the director.</div>}
          {planStatus === "REJECTED" && directorObservation && <div className="mt-1"><strong>Rejected:</strong> {directorObservation}</div>}
          {planStatus === "DRAFT" && <div className="mt-1">Fill in the weekly record for each subject, then click <strong>Submit</strong> to send to the director.</div>}
          {directorPerSubjectObs.length > 0 && (
            <div className="mt-2 space-y-1">
              <strong>Director's observations per subject:</strong>
              {directorPerSubjectObs.map((obs, i) => (
                <div key={i} className="pl-2 border-l-2 border-current/30">
                  <strong>{obs.domain}:</strong> <span dangerouslySetInnerHTML={{ __html: obs.content }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* No subjects */}
      {subjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-amber-200 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <p className="font-medium text-slate-700">No subjects assigned</p>
          <p className="text-sm text-slate-500 mt-1">This class has no English-track subjects assigned yet.</p>
        </div>
      ) : (
        <>
          {/* ⭐ Weekly Record of Work — grid: subjects (rows) × 12 weeks (columns)
              V2 : colonnes DOUBLÉES (minWidth 2800px) + dates sous chaque colonne */}
          <div className="bg-white rounded-xl border-2 border-slate-800 overflow-hidden shadow-sm">
            {/* Title bar */}
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn2("px-2 py-1 rounded text-xs font-bold", TERMS.find(t => t.value === selectedTerm)?.color)}>
                  {TERMS.find(t => t.value === selectedTerm)?.short}
                </span>
                <span className="text-base font-bold tracking-wide">WEEKLY RECORD OF WORK</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* ⭐ Sélecteur de date de fin de la 1ère semaine (pattern cahier journal) */}
                <div className="flex items-center gap-2 bg-slate-700/60 rounded-lg px-3 py-1.5">
                  <CalendarDays className="h-4 w-4 text-amber-300" />
                  <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wide">
                    1st week ends on
                  </label>
                  <input
                    type="date"
                    value={weekDates[0] || ""}
                    onChange={(e) => handleFirstWeekChange(e.target.value)}
                    disabled={isReadOnly}
                    className="px-2 py-1 rounded text-xs font-bold text-slate-800 bg-white border border-slate-300 disabled:opacity-60"
                  />
                </div>
                <span className="text-sm font-semibold text-right">
                  {selectedClass?.label || '—'}
                </span>
              </div>
            </div>

            {/* Grid table — colonnes doublées */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: "2800px" }}>
                <colgroup>
                  <col style={{ width: "10%" }} />
                  {WEEK_LABELS.map((_, i) => <col key={i} style={{ width: `${90 / WEEKS_PER_TERM}%` }} />)}
                </colgroup>
                <thead>
                  {/* Rangée 1 : libellés des semaines */}
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="p-2 border border-slate-300 text-center font-bold text-slate-700 uppercase sticky left-0 bg-slate-100 z-10">
                      SUBJECTS
                    </th>
                    {WEEK_LABELS.map((label, i) => (
                      <th key={i} className="px-2 py-2 border border-slate-300 text-center font-bold text-slate-700 uppercase text-[10px]">
                        {label}
                      </th>
                    ))}
                  </tr>
                  {/* ⭐ Rangée 2 : dates de fin de semaine (pattern cahier journal) */}
                  <tr className="bg-amber-50">
                    {WEEK_LABELS.map((_, i) => (
                      <th key={i} className="px-2 py-1 border border-slate-300 text-center font-bold text-amber-800 text-[10px] tabular-nums">
                        {weekDates[i] ? formatDateEN(weekDates[i]) : "— / — / —"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject, subjIdx) => (
                    <tr key={subject.id || subjIdx} className={cn2("hover:bg-purple-50/30", subjIdx % 2 === 1 && "bg-slate-50/50")}>
                      <td className="p-2 border border-slate-300 font-bold text-slate-800 bg-slate-100 sticky left-0 z-10" style={{ minWidth: "280px" }}>
                        {subject.name}
                      </td>
                      {WEEK_LABELS.map((_, weekIdx) => {
                        const week = weekIdx + 1;
                        const cell = findCell(cells, subject.name, week);
                        const content = cell?.content || "";
                        return (
                          <td key={weekIdx} className="p-0 border border-slate-200 align-top">
                            <RichTextEditor
                              value={content}
                              onChange={(html) => updateCellLocal(subject.name, week, html)}
                              disabled={isReadOnly}
                              placeholder="—"
                              minHeight="100px"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <p className="text-xs font-semibold text-slate-500 italic">
                NOTE: WHEN THE SCHOOL IS SHUT DURING A COMPLETE WEEK NO ENTRY SHOULD BE MADE
              </p>
            </div>

            {/* ⭐ Head Teacher's Initial and Date — vrais champs persistés */}
            <div className="p-4 bg-white border-t-2 border-slate-300">
              <div className="flex items-center gap-2 mb-3">
                <PenLine className="h-4 w-4 text-slate-600" />
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Head Teacher&apos;s Initial and Date
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Initials</label>
                  <input
                    type="text"
                    value={headTeacherInitials}
                    onChange={(e) => { setHeadTeacherInitials(e.target.value); markDirty(); }}
                    disabled={isReadOnly}
                    placeholder="e.g. J.K."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Date</label>
                  <input
                    type="date"
                    value={headTeacherDate}
                    onChange={(e) => { setHeadTeacherDate(e.target.value); markDirty(); }}
                    disabled={isReadOnly}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Signature</label>
                  {headTeacherSignature ? (
                    <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-lg p-1 flex items-center gap-2">
                      <img src={headTeacherSignature} alt="Head teacher signature" className="max-h-14 mx-auto" />
                      {!isReadOnly && (
                        <button onClick={() => { setHeadTeacherSignature(null); markDirty(); }}
                          className="text-[10px] text-red-500 hover:underline flex-shrink-0 pr-1">
                          Clear
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-14">
                      {!isReadOnly ? (
                        <button
                          onClick={() => setShowHeadTeacherSignPad(true)}
                          className="w-full h-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-xs font-semibold text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
                        >
                          ✍️ Draw signature
                        </button>
                      ) : (
                        <div className="w-full h-full px-3 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 flex items-center justify-center">
                          Not signed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Signatures and validation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Class Teacher</div>
                    <div className="text-xs text-slate-500">{teacherName || 'Teacher\'s name'} — Signature</div>
                  </div>
                  {teacherSignature && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signed
                    </span>
                  )}
                </div>
                {teacherSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={teacherSignature} alt="Teacher signature" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                    The signature will be requested when submitting to the director.
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Director</div>
                    <div className="text-xs text-slate-500">{planStatus === "VALIDATED" ? "Signature and stamp" : "Signature available after validation"}</div>
                  </div>
                  {planStatus === "VALIDATED" && directorSignature && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signed
                    </span>
                  )}
                  {planStatus !== "VALIDATED" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
                {planStatus === "VALIDATED" && directorSignature ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={directorSignature} alt="Director signature" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                    {planStatus === "SUBMITTED" ? "Submitted — pending director validation" : "The director's signature will appear after validation"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Signature modal (submit) */}
      {showSignatureModal && (
        <SubmissionSignatureModal
          onCancel={() => { setShowSignatureModal(false); setPendingSignature(null); }}
          onConfirm={handleSubmit}
          onSign={(dataUrl) => setPendingSignature(dataUrl)}
          signature={pendingSignature}
          submitting={submitting}
          classLabel={selectedClass?.label || ''}
          termLabel={selectedTerm}
        />
      )}

      {/* ⭐ Head Teacher signature pad */}
      {showHeadTeacherSignPad && (
        <HeadTeacherSignaturePad
          onCancel={() => setShowHeadTeacherSignPad(false)}
          onConfirm={(dataUrl) => {
            setHeadTeacherSignature(dataUrl);
            setShowHeadTeacherSignPad(false);
            markDirty();
          }}
        />
      )}

      {confirmDialog}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Submission signature modal (same as Scheme of Work)
// ─────────────────────────────────────────────────────────────────────────
function SubmissionSignatureModal({
  onCancel, onConfirm, onSign, signature, submitting, classLabel, termLabel,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  onSign: (dataUrl: string | null) => void;
  signature: string | null;
  submitting: boolean;
  classLabel: string;
  termLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); onSign(null);
  };
  const saveCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    onSign(canvas.toDataURL('image/png'));
  };
  const getPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };
  const handlePointerDown = (e: React.PointerEvent) => { e.preventDefault(); setIsDrawing(true); lastPoint.current = getPoint(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return; e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const point = getPoint(e); if (!point || !lastPoint.current) return;
    ctx.beginPath(); ctx.moveTo(lastPoint.current.x, lastPoint.current.y); ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    lastPoint.current = point;
  };
  const handlePointerUp = () => { setIsDrawing(false); lastPoint.current = null; saveCanvas(); };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Teacher&apos;s signature</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">
            By signing below, you confirm that the Weekly Record of Work for <strong>{classLabel}</strong> for <strong>{termLabel}</strong> is complete and ready to be submitted to the director for validation.
          </div>
          <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
            <canvas ref={canvasRef} width={400} height={150} className="w-full h-[150px] touch-none cursor-crosshair"
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={clearCanvas} className="text-xs text-red-500 hover:underline">Clear signature</button>
            {signature && <span className="text-xs text-emerald-600 font-semibold">✓ Signature captured</span>}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onCancel} disabled={submitting} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={submitting || !signature} className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit to director'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ⭐ Head Teacher signature pad — signature persistée en base
// ─────────────────────────────────────────────────────────────────────────
function HeadTeacherSignaturePad({
  onCancel, onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };
  const getPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };
  const handlePointerDown = (e: React.PointerEvent) => { e.preventDefault(); setIsDrawing(true); setHasInk(true); lastPoint.current = getPoint(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return; e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const point = getPoint(e); if (!point || !lastPoint.current) return;
    ctx.beginPath(); ctx.moveTo(lastPoint.current.x, lastPoint.current.y); ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    lastPoint.current = point;
  };
  const handlePointerUp = () => { setIsDrawing(false); lastPoint.current = null; };
  const handleConfirm = () => {
    const canvas = canvasRef.current; if (!canvas || !hasInk) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Head Teacher&apos;s signature</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">
            Draw the Head Teacher&apos;s signature. It will be saved with the Weekly Record of Work and included in the PDF export.
          </div>
          <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
            <canvas ref={canvasRef} width={360} height={120} className="w-full h-[120px] touch-none cursor-crosshair"
              onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={clearCanvas} className="text-xs text-red-500 hover:underline">Clear</button>
            {hasInk && <span className="text-xs text-emerald-600 font-semibold">✓ Signature ready</span>}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">Cancel</button>
          <button onClick={handleConfirm} disabled={!hasInk} className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50">
            Save signature
          </button>
        </div>
      </div>
    </div>
  );
}
