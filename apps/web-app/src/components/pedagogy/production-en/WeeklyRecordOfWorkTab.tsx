"use client";

/**
 * ============================================================================
 * WEEKLY RECORD OF WORK — EN track
 * ============================================================================
 *
 * Grid: subjects (rows) × 12 weeks (columns) per term.
 * Each cell is a RichTextEditor where the teacher records what was done
 * that week for that subject.
 *
 * Structure (per the official PDF template):
 *   - Column 1: "SUBJECTS" (dynamically fetched from /api/pedagogy-space/my-classes)
 *   - Columns 2-13: "1ST WEEK ENDING" → "12TH WEEK ENDING" (12 weeks per term)
 *   - Term selector: First Term / Second Term / Third Term
 *   - Footer note: "WHEN THE SCHOOL IS SHUT DURING A COMPLETE WEEK NO ENTRY
 *     SHOULD BE MADE"
 *   - Signature: "HEAD TEACHER'S INITIAL AND DATE"
 *
 * ⭐ Reuses the same backend as Scheme of Work (/api/pedagogy/monthly-plans)
 *    with month = term label, but with a different cell structure:
 *    - domain = subject name
 *    - subDomain = week number (1-12)
 *    - weekNumber = 0 (not used, kept for compatibility)
 *
 * ⭐ Same submission workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
 * ⭐ Same RichTextEditor, auto-save, PDF export, signature modal
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Send, Bell,
  AlertCircle, Info, CheckCircle2, XCircle, Clock,
  Download, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { translateClassName } from "@/lib/pedagogy/class-name-en";
import { loadPdfLibs } from "@/lib/exports/pdf-loader";
import { drawOfficialHeader, drawFooter, type SchoolHeader } from "@/lib/exports/finance-exports";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface WeeklyCell {
  id?: string;
  weekNumber: number;   // Always 0 (not used for weekly record — weeks are in subDomain)
  domain: string;       // subject name
  subDomain?: string;   // week number as string: "1", "2", ..., "12"
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

const WEEKS_PER_TERM = 12;
const WEEK_LABELS = Array.from({ length: WEEKS_PER_TERM }, (_, i) => {
  const n = i + 1;
  // 1st, 2nd, 3rd, 4th... 12th
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix.toUpperCase()} WEEK ENDING`;
});

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
  const { tenant } = useModuleContext();
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

  // ─── Load plan ───
  const loadPlan = useCallback(async () => {
    if (!academicYearId || !selectedClassValue) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await pedagogyFetch<WeeklyPlanResponse>(
        `/api/pedagogy/monthly-plans?academicYearId=${academicYearId}&classLevel=${encodeURIComponent(selectedClassValue)}&month=${encodeURIComponent(selectedTerm)}&teacherId=${teacherId}`
      );
      setCells(data.cells || []);
      setPlanStatus(data.status || "DRAFT");
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      setDirectorObservation(data.directorObservation || null);
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

  // ─── Save ───
  const handleSave = useCallback(async () => {
    if (!academicYearId || !selectedClassValue) return;
    setSaving(true);
    try {
      await pedagogyFetch("/api/pedagogy/monthly-plans/save", {
        method: "POST",
        body: { academicYearId, classLevel: selectedClassValue, month: selectedTerm, teacherId, cells },
      });
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, cells]);
  saveRef.current = handleSave;

  // ─── Auto-save 5s ───
  const isDirtyRef = useRef(false);
  const prevCellsRef = useRef<WeeklyCell[]>(cells);
  useEffect(() => {
    if (prevCellsRef.current !== cells) {
      isDirtyRef.current = true;
      prevCellsRef.current = cells;
    }
  }, [cells]);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isDirtyRef.current && !saving && !loading && !submitting && cells.length > 0) {
        isDirtyRef.current = false;
        await saveRef.current();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [saving, loading, submitting, cells]);

  // ─── Submit ───
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
      });
      const res = await fetch(`/api/pedagogy/monthly-plans/submit?${params.toString()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherSignature: pendingSignature }),
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
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, pendingSignature, loadPlan]);

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

  // ─── PDF export ───
  const handleExportPDF = useCallback(async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      let schoolInfo: any = {};
      try {
        const idRes = await fetch('/api/settings/identity', { credentials: 'include' });
        if (idRes.ok) schoolInfo = await idRes.json();
      } catch {}

      const header: SchoolHeader = {
        schoolName: schoolInfo.schoolName || schoolInfo.name || tenant?.name || 'School',
        schoolLogoUrl: schoolInfo.logoUrl || schoolInfo.logo || (tenant?.id ? `/api/tenants/${tenant.id}/logo` : null),
        schoolAddress: schoolInfo.address || schoolInfo.schoolAddress || null,
        schoolPhone: schoolInfo.phone || schoolInfo.schoolPhone || null,
        schoolEmail: schoolInfo.email || schoolInfo.schoolEmail || null,
        schoolLevel: 'PRIMAIRE',
      };

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const stripHtml = (html: string) => (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

      drawOfficialHeader(doc, header, pageWidth);
      doc.setFont('times', 'bold');
      doc.setFontSize(13);
      doc.text(`WEEKLY RECORD OF WORK — ${String(selectedTerm || '').toUpperCase()}`, pageWidth / 2, 48, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.text(`Class: ${selectedClass?.label || ''}   |   Academic Year: ${new Date().getFullYear()}`, pageWidth / 2, 54, { align: 'center' });

      // Table: Subject + 12 weeks
      const head = [['Subject', ...WEEK_LABELS.map(w => w.replace(' WEEK ENDING', ''))]];
      const body = subjects.map(subj => {
        return [subj.name, ...WEEK_LABELS.map((_, weekIdx) => {
          const c = cells.find(x => x.domain === subj.name && (x.subDomain || '') === String(weekIdx + 1));
          return stripHtml(c?.content || '');
        })];
      });

      autoTable(doc, {
        head, body, startY: 60,
        margin: { left: 10, right: 10 },
        styles: { fontSize: 5, cellPadding: 1, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 5 },
        columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' } },
        didDrawPage: () => { drawFooter(doc, pageWidth, pageHeight, doc.internal.getNumberOfPages()); },
      });

      // Footer note
      const finalY = (doc as any).lastAutoTable?.finalY || 200;
      doc.setFont('times', 'italic');
      doc.setFontSize(7);
      doc.text('NOTE: WHEN THE SCHOOL IS SHUT DURING A COMPLETE WEEK NO ENTRY SHOULD BE MADE', pageWidth / 2, finalY + 8, { align: 'center' });

      // Signatures
      doc.setFontSize(9);
      doc.text(`Class Teacher: ${teacherName || ''}`, 30, finalY + 18);
      doc.text(`Head Teacher's Initial & Date: ____________________`, pageWidth - 80, finalY + 18);

      doc.save(`Weekly_Record_of_Work_${selectedClass?.label || ''}_${selectedTerm}.pdf`);
      toast.success('✅ PDF exported successfully');
    } catch (e: any) {
      console.error('PDF export error:', e);
      toast.error("Export error", { description: e.message });
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, subjects, cells, selectedClassValue, selectedClass, selectedTerm, teacherId, academicYearId, tenant, teacherName]);

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
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4">
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
          {/* ⭐ Weekly Record of Work — grid: subjects (rows) × 12 weeks (columns) */}
          <div className="bg-white rounded-xl border-2 border-slate-800 overflow-hidden shadow-sm">
            {/* Title bar */}
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn2("px-2 py-1 rounded text-xs font-bold", TERMS.find(t => t.value === selectedTerm)?.color)}>
                  {TERMS.find(t => t.value === selectedTerm)?.short}
                </span>
                <span className="text-base font-bold tracking-wide">WEEKLY RECORD OF WORK</span>
              </div>
              <div className="text-sm font-semibold text-right">
                {selectedClass?.label || '—'}
              </div>
            </div>

            {/* Grid table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: "1400px" }}>
                <colgroup>
                  <col style={{ width: "15%" }} />
                  {WEEK_LABELS.map((_, i) => <col key={i} style={{ width: `${85 / WEEKS_PER_TERM}%` }} />)}
                </colgroup>
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 border border-slate-300 text-center font-bold text-slate-700 uppercase sticky left-0 bg-slate-100 z-10">
                      SUBJECTS
                    </th>
                    {WEEK_LABELS.map((label, i) => (
                      <th key={i} className="p-1 border border-slate-300 text-center font-bold text-slate-700 uppercase text-[8px]">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject, subjIdx) => (
                    <tr key={subject.id || subjIdx} className={cn2("hover:bg-purple-50/30", subjIdx % 2 === 1 && "bg-slate-50/50")}>
                      <td className="p-2 border border-slate-300 font-bold text-slate-800 bg-slate-100 sticky left-0 z-10" style={{ minWidth: "150px" }}>
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
                              minHeight="50px"
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

            {/* Head Teacher's initial & date */}
            <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
              <div className="text-sm font-semibold text-slate-700">
                Head Teacher's Initial &amp; Date: ____________________
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

      {/* Signature modal */}
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
          <h3 className="text-base font-bold text-slate-900">Teacher's signature</h3>
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
