"use client";

/**
 * ============================================================================
 * SCHEME OF WORK — English pedagogical track (replaces Monthly Planning)
 * ============================================================================
 *
 * ⭐ STRUCTURE — conforms to the official Nigerian/Benin "Scheme of Work"
 *    template attached by the user:
 *
 *   - A "Scheme of Work" is organized by TERM (First / Second / Third Term).
 *   - For each term, the teacher fills in the scheme for ALL subjects assigned
 *     to their class.
 *   - The same scheme-of-work structure is used for all classes (Nursery 1
 *     through Primary 6) — only the subjects differ (loaded dynamically).
 *
 * ⭐ LAYOUT (per subject) — inspired by the printed PDF template:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [1ST TERM]   SCHEME OF WORK   [SUBJECT NAME]                │
 *   ├──────┬─────────┬──────────────┬────────────┬──────────┬─────┤
 *   │ Week │ Topic   │ Objectives   │ Activities │ Resources│ Eval│
 *   │  1   │ editable│ editable     │ editable   │ editable │ ed. │
 *   │  2   │ ...     │ ...          │ ...        │ ...      │ ... │
 *   │ ...  │ ...     │ ...          │ ...        │ ...      │ ... │
 *   └──────┴─────────┴──────────────┴────────────┴──────────┴─────┘
 *
 * ⭐ SUBMISSION WORKFLOW — same as Monthly Planning / Cahier Journal:
 *   DRAFT → SUBMITTED (sent to director) → VALIDATED / REJECTED
 *   - Save button: persists all rows silently
 *   - Submit button: opens signature modal → teacher signs → sends to director
 *   - Notify button: relaunches email/WhatsApp/SMS notification to director
 *   - Export PDF button: generates a PDF with the official header
 *   - Signatures: Teacher + Director (shown after VALIDATED)
 *
 * ⭐ SUBJECTS — fetched dynamically from /api/pedagogy-space/my-classes
 *    with `language=EN` filter (same as MyClassesTab). Each class has a
 *    list of English-track subjects, and the teacher fills in the scheme
 *    for each.
 *
 * ⭐ STORAGE — reuses the existing /api/pedagogy/monthly-plans backend:
 *   - `month` field stores the term label ("First Term" / "Second Term" / "Third Term")
 *   - `classLevel` stores the class level code (CI, CP, CE1, ..., MATERNELLE_GRANDS, ...)
 *   - Each cell: { weekNumber, domain (subject name), subDomain (column), content (HTML) }
 *   - Signatures + status stored at the plan level (same as before)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Send, Bell,
  BookOpen, AlertCircle, Info, CheckCircle2, XCircle, Clock,
  Download, X, Check, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { translateClassName } from "@/lib/pedagogy/class-name-en";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface SchemeCell {
  id?: string;
  weekNumber: number;
  domain: string;          // subject name (e.g. "RELIGION AND NATIONAL VALUES")
  subDomain?: string;      // column name: "Topic" | "Objectives" | "Activities" | "Resources" | "Evaluation"
  content: string;
  isAutoProposed: boolean;
  isCustom: boolean;
}

interface SchemePlanResponse {
  cells: SchemeCell[];
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
  subjects?: Array<{ id: string; name: string; language?: string }>;
  totalStudents?: number;
}

interface SchemeOfWorkTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  availableClasses?: AvailableClass[];
  isDirector?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants — Terms + Columns
// ─────────────────────────────────────────────────────────────────────────

type TermKey = "First Term" | "Second Term" | "Third Term";

const TERMS: Array<{ value: TermKey; label: string; short: string; color: string }> = [
  { value: "First Term",  label: "First Term",  short: "1ST TERM", color: "bg-blue-600" },
  { value: "Second Term", label: "Second Term", short: "2ND TERM", color: "bg-emerald-600" },
  { value: "Third Term",  label: "Third Term",  short: "3RD TERM", color: "bg-amber-600" },
];

// ⭐ 12 weeks per term (standard Nigerian/Benin school term length)
const WEEKS_PER_TERM = 12;
const WEEK_NUMBERS = Array.from({ length: WEEKS_PER_TERM }, (_, i) => i + 1);

// ⭐ Columns for each subject's scheme of work table
//    Each row = 1 week. Columns are the standard scheme-of-work fields.
const SCHEME_COLUMNS = [
  { key: "Topic",       label: "Topic",       width: "20%" },
  { key: "Objectives",  label: "Objectives",  width: "22%" },
  { key: "Activities",  label: "Activities",  width: "22%" },
  { key: "Resources",   label: "Resources",   width: "18%" },
  { key: "Evaluation",  label: "Evaluation",  width: "18%" },
] as const;

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",     color: "bg-slate-100 text-slate-700",  icon: BookOpen },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700",    icon: Send },
  VALIDATED: { label: "Validated", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",  color: "bg-red-100 text-red-700",     icon: XCircle },
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

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

function cn2(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export function SchemeOfWorkTab({
  tenantId, academicYearId, teacherId,
  availableClasses, isDirector = false,
}: SchemeOfWorkTabProps) {
  const { user } = useAppSession();
  const { tenant } = useModuleContext();
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifyingDirector, setNotifyingDirector] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [cells, setCells] = useState<SchemeCell[]>([]);
  const [hasExistingCustom, setHasExistingCustom] = useState(false);
  const [planStatus, setPlanStatus] = useState<"DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED">("DRAFT");
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [directorObservation, setDirectorObservation] = useState<string | null>(null);
  const [directorName, setDirectorName] = useState<string>("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  // ⭐ Ref to track if user is currently editing — prevents auto-refresh from
  //    overwriting unsaved edits. Updated whenever editingCellKey changes.
  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = editingCellKey !== null;
  }, [editingCellKey]);

  // ⭐ Loaded classes (with subjects) from /api/pedagogy-space/my-classes
  const [loadedClasses, setLoadedClasses] = useState<AvailableClass[]>([]);
  const [selectedClassValue, setSelectedClassValue] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<TermKey>("First Term");
  // ⭐ Currently displayed subject index (for the subject switcher)
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);

  const teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  const isReadOnly = planStatus === "SUBMITTED" || planStatus === "VALIDATED";
  const StatusBadge = STATUS_BADGES[planStatus] || STATUS_BADGES.DRAFT;
  const StatusIcon = StatusBadge.icon;

  const saveRef = useRef<() => Promise<void>>(async () => {});

  // ───────────────────────────────────────────────────────────────────
  // Load classes (and their subjects) from my-classes endpoint
  // ⭐ ALWAYS fetch from /api/pedagogy-space/my-classes?language=EN to get
  //    the full class data INCLUDING subjects. The `availableClasses` prop
  //    from the parent only has {value, label} — no subjects — so we can't
  //    use it directly. We need the API response to get subjects per class.
  // ───────────────────────────────────────────────────────────────────
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
            weeklyHours: s.weeklyHours,
            coefficient: s.coefficient,
          })),
          totalStudents: c.totalStudents,
        }));

        // ⭐ If availableClasses is provided (director view with pre-selected
        //    class codes like P1, P2...), use it to filter the API results
        //    to only show classes the director has access to.
        if (availableClasses && availableClasses.length > 0) {
          const allowedValues = new Set(availableClasses.map(c => c.value));
          const filtered = list.filter(c => allowedValues.has(c.value) || allowedValues.has(c.className));
          setLoadedClasses(filtered.length > 0 ? filtered : list);
        } else {
          setLoadedClasses(list);
        }

        if (list.length > 0) setSelectedClassValue(list[0].value);
      } catch (e: any) {
        console.error("Failed to load classes:", e);
        // ⭐ Fallback: if API fails, use availableClasses if provided
        if (availableClasses && availableClasses.length > 0) {
          setLoadedClasses(availableClasses);
          if (availableClasses[0]) setSelectedClassValue(availableClasses[0].value);
        } else {
          setLoadedClasses([]);
        }
      }
    })();
  }, [teacherId, academicYearId, availableClasses]);

  // ⭐ Get the currently selected class object (with subjects)
  const selectedClass = useMemo(
    () => loadedClasses.find(c => c.value === selectedClassValue) || null,
    [loadedClasses, selectedClassValue]
  );
  const subjects = selectedClass?.subjects || [];

  // ⭐ Reset subject index when class changes (avoid index out of bounds)
  useEffect(() => {
    setCurrentSubjectIndex(0);
  }, [selectedClassValue]);

  // ───────────────────────────────────────────────────────────────────
  // Load scheme-of-work cells for the selected class + term
  //    Reuses the /api/pedagogy/monthly-plans endpoint with `month` = term label
  // ───────────────────────────────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    if (!academicYearId || !selectedClassValue || !selectedClass) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await pedagogyFetch<SchemePlanResponse>(
        `/api/pedagogy/monthly-plans?academicYearId=${academicYearId}&classLevel=${encodeURIComponent(selectedClassValue)}&month=${encodeURIComponent(selectedTerm)}&teacherId=${teacherId}`
      );
      setCells(data.cells || []);
      setHasExistingCustom(data.hasExistingCustom || false);
      setPlanStatus(data.status || "DRAFT");
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      setDirectorObservation(data.directorObservation || null);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("Failed to fetch monthly plans")) {
        console.warn("monthly_plans table not available:", msg);
        setCells([]);
      } else {
        console.error("Failed to load scheme of work:", e);
        toast.error("Failed to load: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ⭐ Auto-refresh every 60s for status updates (director validation)
  //    Only if the user is NOT currently editing (cells not dirty) to avoid
  //    overwriting unsaved edits. Also disabled during loading/saving.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isEditingRef.current && !saving && !loading) {
        loadPlan();
      }
    }, 60000); // 60 seconds (was 30s — too frequent caused flicker)
    return () => clearInterval(interval);
  }, [loadPlan, saving, loading]);

  // ⭐ Load director name from settings/identity
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setDirectorName(data.directorName || data.director_name || '');
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ───────────────────────────────────────────────────────────────────
  // Save (silent — no toast on success, no reload to preserve user edits)
  // ───────────────────────────────────────────────────────────────────
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
        },
      });
      setHasExistingCustom(true);
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, cells]);

  saveRef.current = handleSave;

  // ⭐ Auto-save every 5 seconds if cells have changed (same as Cahier Journal)
  const isDirtyRef = useRef(false);
  const prevCellsRef = useRef<SchemeCell[]>(cells);
  useEffect(() => {
    // Mark dirty whenever cells change
    if (prevCellsRef.current !== cells) {
      isDirtyRef.current = true;
      prevCellsRef.current = cells;
    }
  }, [cells]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isDirtyRef.current && !isEditingRef.current && !saving && !loading && !submitting && cells.length > 0) {
        isDirtyRef.current = false;
        await saveRef.current();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [saving, loading, submitting, cells]);

  // ───────────────────────────────────────────────────────────────────
  // Submit to director (with teacher signature)
  // ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!academicYearId || !pendingSignature) {
      toast.error("Teacher signature required to submit.");
      return;
    }
    if (!selectedClassValue) {
      toast.error("Class required.");
      return;
    }
    setSubmitting(true);
    try {
      // ⭐ Save silently before submitting
      await saveRef.current();

      const params = new URLSearchParams({
        academicYearId,
        classLevel: selectedClassValue,
        month: selectedTerm,
        teacherId: teacherId || 'unknown',
      });

      const res = await fetch(
        `/api/pedagogy/monthly-plans/submit?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherSignature: pendingSignature }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as any)?.backendError?.message
          || (errData as any)?.message
          || (errData as any)?.error
          || `Error ${res.status}`;
        throw new Error(msg);
      }
      toast.success("Scheme of work submitted to director");
      setShowSignatureModal(false);
      setPendingSignature(null);
      await loadPlan();
    } catch (e: any) {
      toast.error("Submission failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }, [academicYearId, selectedClassValue, selectedTerm, teacherId, pendingSignature, loadPlan]);

  // ───────────────────────────────────────────────────────────────────
  // Notify director (relaunch email/WhatsApp/SMS)
  // ───────────────────────────────────────────────────────────────────
  const handleNotifyDirector = useCallback(async () => {
    if (!selectedClassValue) return;
    const ok = await confirmWarning(
      `Notify the director?`,
      'Manual notification',
      `The director will receive a notification by:\n` +
      `• Email\n` +
      `• WhatsApp\n` +
      `• SMS\n\n` +
      `Class: ${selectedClass?.label || '—'}\n` +
      `Term: ${selectedTerm}`
    );
    if (!ok) return;
    setNotifyingDirector(true);
    try {
      const res = await fetch('/api/pedagogy-space/notify-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: selectedClass?.classId || selectedClassValue,
          month: selectedTerm, // ⭐ reuse month param for term label
          year: new Date().getFullYear(),
          teacherId,
          channels: ['email', 'whatsapp', 'sms'],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      toast.success('✅ Director notified', {
        description: `Notification sent to ${data.notifiedDirectors || 'the director'}.`,
      });
    } catch (e: any) {
      toast.error('Notification error', { description: e.message });
    } finally {
      setNotifyingDirector(false);
    }
  }, [selectedClassValue, selectedClass, selectedTerm, teacherId, confirmWarning]);

  // ───────────────────────────────────────────────────────────────────
  // Export PDF
  // ───────────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      // ⭐ Build a printable HTML document and open it in a new window for PDF
      //    We use the browser's native print-to-PDF to avoid backend dependency.
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) {
        toast.error("Please allow pop-ups to export the PDF.");
        return;
      }

      const subjectsHtml = subjects.map((subj) => {
        const rowsHtml = WEEK_NUMBERS.map((week) => {
          const topicCell = findCell(cells, week, subj.name, "Topic");
          const objCell = findCell(cells, week, subj.name, "Objectives");
          const actCell = findCell(cells, week, subj.name, "Activities");
          const resCell = findCell(cells, week, subj.name, "Resources");
          const evalCell = findCell(cells, week, subj.name, "Evaluation");
          return `<tr>
            <td style="text-align:center;font-weight:bold;">${week}</td>
            <td>${topicCell?.content || ''}</td>
            <td>${objCell?.content || ''}</td>
            <td>${actCell?.content || ''}</td>
            <td>${resCell?.content || ''}</td>
            <td>${evalCell?.content || ''}</td>
          </tr>`;
        }).join('');
        return `
          <div style="page-break-after: always; margin-bottom: 20px;">
            <table style="width:100%;border-collapse:collapse;border:2px solid #000;font-size:11px;">
              <thead>
                <tr style="background:#1e293b;color:#fff;">
                  <th colspan="6" style="padding:8px;border:1px solid #000;text-align:center;font-size:14px;">
                    ${String(selectedTerm || '').toUpperCase()} &nbsp;|&nbsp; SCHEME OF WORK &nbsp;|&nbsp; ${String(subj?.name || '').toUpperCase()}
                  </th>
                </tr>
                <tr style="background:#e2e8f0;">
                  <th style="padding:6px;border:1px solid #000;width:5%;">Week</th>
                  <th style="padding:6px;border:1px solid #000;width:20%;">Topic</th>
                  <th style="padding:6px;border:1px solid #000;width:22%;">Objectives</th>
                  <th style="padding:6px;border:1px solid #000;width:22%;">Activities</th>
                  <th style="padding:6px;border:1px solid #000;width:16%;">Resources</th>
                  <th style="padding:6px;border:1px solid #000;width:15%;">Evaluation</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Scheme of Work — ${selectedClass?.label || ''} — ${selectedTerm}</title>
          <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { font-family: 'Times New Roman', serif; color: #000; }
            .header { text-align: center; margin-bottom: 16px; }
            .header h1 { font-size: 18px; margin: 4px 0; }
            .header p { font-size: 12px; margin: 2px 0; }
            .signatures { margin-top: 30px; display: flex; justify-content: space-around; }
            .sig-block { text-align: center; }
            .sig-line { margin-top: 60px; border-top: 1px solid #000; padding-top: 4px; font-size: 11px; }
            ${teacherSignature ? `.teacher-sig img, .director-sig img { max-height: 60px; }` : ''}
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${tenant?.name || 'School'}</h1>
            <p>SCHEME OF WORK — ${String(selectedTerm || '').toUpperCase()}</p>
            <p>Class: <strong>${selectedClass?.label || ''}</strong> — Academic Year: ${new Date().getFullYear()}</p>
          </div>
          ${subjectsHtml}
          <div class="signatures">
            <div class="sig-block">
              ${teacherSignature ? `<img src="${teacherSignature}" style="max-height:60px;" />` : ''}
              <div class="sig-line">Class Teacher: ${teacherName || ''}</div>
            </div>
            <div class="sig-block">
              ${directorSignature ? `<img src="${directorSignature}" style="max-height:60px;" />` : ''}
              <div class="sig-line">Director: ${directorName || ''}</div>
            </div>
          </div>
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 300); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      toast.success("PDF export ready — use your browser's print dialog to save as PDF.");
    } catch (e: any) {
      console.error('PDF export error:', e);
      toast.error("Export error", { description: e.message });
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, subjects, cells, selectedTerm, selectedClass, tenant, teacherName, directorName, teacherSignature, directorSignature]);

  // ───────────────────────────────────────────────────────────────────
  // Cell helpers
  // ───────────────────────────────────────────────────────────────────
  function findCell(cellsArr: SchemeCell[], week: number, subject: string, column: string): SchemeCell | undefined {
    return cellsArr.find(c =>
      c.weekNumber === week &&
      c.domain === subject &&
      (c.subDomain || "") === column
    );
  }

  const updateCellLocal = (week: number, subject: string, column: string, content: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c =>
        c.weekNumber === week &&
        c.domain === subject &&
        (c.subDomain || "") === column
      );
      if (idx === -1) {
        return [...prev, {
          weekNumber: week, domain: subject, subDomain: column, content,
          isAutoProposed: false, isCustom: true,
        }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], content, isCustom: true, isAutoProposed: false };
      return next;
    });
  };

  // ───────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Loading scheme of work…</span>
      </div>
    );
  }

  if (loadedClasses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-600">No class assigned</p>
        <p className="text-sm text-slate-500 mt-1">You have no class assigned for this year.</p>
      </div>
    );
  }

  // ⭐ Render an editable cell using RichTextEditor (same as Cahier Journal)
  //    The RichTextEditor is always visible (no click-to-edit toggle) — the
  //    teacher can directly type and format text (bold, italic, underline,
  //    lists, etc.) just like in the Cahier Journal.
  //    Content is saved to local state on every change, and persisted to DB
  //    when the user clicks "Save" or auto-saved every 5 seconds.
  const renderCell = (week: number, subjectName: string, column: string) => {
    const cell = findCell(cells, week, subjectName, column);
    const content = cell?.content || "";

    return (
      <td key={`${subjectName}-${column}-${week}`} className="p-0 border border-slate-200 align-top">
        <RichTextEditor
          value={content}
          onChange={(html) => updateCellLocal(week, subjectName, column, html)}
          disabled={isReadOnly}
          placeholder="—"
          minHeight="60px"
        />
      </td>
    );
  };

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
              Scheme of Work
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
          {/* Class selector */}
          {loadedClasses.length > 1 ? (
            <select
              value={selectedClassValue}
              onChange={(e) => setSelectedClassValue(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white"
            >
              {loadedClasses.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
              {loadedClasses[0]?.label}
            </span>
          )}
          {/* Term selector */}
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value as TermKey)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white"
          >
            {TERMS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || isReadOnly}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            title="Save all changes"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          {/* Submit (only in DRAFT) */}
          {planStatus === "DRAFT" && (
            <button
              onClick={() => setShowSignatureModal(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              title="Submit to director for validation"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit
            </button>
          )}
          {/* Notify director */}
          <button
            onClick={handleNotifyDirector}
            disabled={notifyingDirector || !selectedClassValue}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            title="Notify the director by email, WhatsApp and SMS"
          >
            {notifyingDirector ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Notify
          </button>
          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            title="Export to PDF"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
          {/* Refresh */}
          <button
            onClick={loadPlan}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className={cn2(
        "rounded-lg p-3 text-xs flex items-start gap-2",
        planStatus === "VALIDATED" ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
          : planStatus === "SUBMITTED" ? "bg-blue-50 border border-blue-200 text-blue-700"
          : planStatus === "REJECTED" ? "bg-red-50 border border-red-200 text-red-700"
          : "bg-amber-50 border border-amber-200 text-amber-700"
      )}>
        {planStatus === "VALIDATED" ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : planStatus === "SUBMITTED" ? <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : planStatus === "REJECTED" ? <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <div>
          <strong>{selectedTerm}</strong> — Scheme of Work for <strong>{selectedClass?.label}</strong>
          <span className="ml-2">
            ({subjects.length} subject{subjects.length !== 1 ? 's' : ''} — {WEEKS_PER_TERM} weeks each)
          </span>
          {planStatus === "SUBMITTED" && (
            <div className="mt-1 font-semibold">📋 Submitted to director — pending validation.</div>
          )}
          {planStatus === "VALIDATED" && (
            <div className="mt-1 font-semibold">✅ Validated by the director.</div>
          )}
          {planStatus === "REJECTED" && directorObservation && (
            <div className="mt-1"><strong>Rejected:</strong> {directorObservation}</div>
          )}
          {planStatus === "DRAFT" && (
            <div className="mt-1">Fill in the scheme for each subject, then click <strong>Submit</strong> to send to the director.</div>
          )}
        </div>
      </div>

      {/* ⭐ No subjects assigned */}
      {subjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-amber-200 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <p className="font-medium text-slate-700">No subjects assigned</p>
          <p className="text-sm text-slate-500 mt-1">
            This class has no English-track subjects assigned yet. Please contact the administration to assign subjects.
          </p>
        </div>
      ) : (
        <>
          {/* ⭐ Subject switcher — dropdown + chevrons for fast navigation */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentSubjectIndex(Math.max(0, currentSubjectIndex - 1))}
                  disabled={currentSubjectIndex === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous subject"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700">
                  {currentSubjectIndex + 1} / {subjects.length}
                </span>
                <button
                  onClick={() => setCurrentSubjectIndex(Math.min(subjects.length - 1, currentSubjectIndex + 1))}
                  disabled={currentSubjectIndex === subjects.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next subject"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* ⭐ Subject selector dropdown — for fast switching between subjects */}
              <select
                value={currentSubjectIndex}
                onChange={(e) => setCurrentSubjectIndex(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium bg-white min-w-[280px]"
              >
                {subjects.map((subj, idx) => (
                  <option key={subj.id || idx} value={idx}>
                    {subj.name || `Subject ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ⭐ Scheme of Work — ONE table for the currently selected subject */}
          {(() => {
            const subject = subjects[currentSubjectIndex];
            if (!subject) return null;
            return (
              <div className="bg-white rounded-xl border-2 border-slate-800 overflow-hidden shadow-sm">
                {/* Title bar — TERM | SCHEME OF WORK | SUBJECT */}
                <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn2("px-2 py-1 rounded text-xs font-bold", TERMS.find(t => t.value === selectedTerm)?.color)}>
                      {TERMS.find(t => t.value === selectedTerm)?.short}
                    </span>
                    <span className="text-base font-bold tracking-wide">SCHEME OF WORK</span>
                  </div>
                  <div className="text-sm font-semibold text-right">
                    {String(subject?.name || '').toUpperCase()}
                  </div>
                </div>

                {/* Editable table — Week | Topic | Objectives | Activities | Resources | Evaluation */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs" style={{ minWidth: "1000px" }}>
                    <colgroup>
                      <col style={{ width: "5%" }} />
                      {SCHEME_COLUMNS.map(col => (
                        <col key={col.key} style={{ width: col.width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-300 text-center font-bold text-slate-700 uppercase">Week</th>
                        {SCHEME_COLUMNS.map(col => (
                          <th key={col.key} className="p-2 border border-slate-300 text-center font-bold text-slate-700 uppercase">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEK_NUMBERS.map(week => (
                        <tr key={week} className={cn2("hover:bg-purple-50/30", week % 2 === 0 && "bg-slate-50/50")}>
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-700 bg-slate-100">
                            {week}
                          </td>
                          {SCHEME_COLUMNS.map(col => renderCell(week, subject.name, col.key))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ⭐ Signatures section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Signatures and validation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Teacher signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Class Teacher</div>
                    <div className="text-xs text-slate-500">
                      {teacherName || 'Teacher\'s name'} — Signature
                    </div>
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
                ) : planStatus === "DRAFT" ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                    The signature will be requested when submitting to the director.
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-xl p-2 h-[120px] flex items-center justify-center text-amber-600 text-xs font-medium">
                    {planStatus === "SUBMITTED" ? "Submitted — pending director validation" : ""}
                    {planStatus === "VALIDATED" ? "Signed and validated" : ""}
                    {planStatus === "REJECTED" ? "Rejected — to correct and resubmit" : ""}
                  </div>
                )}
                {teacherSignature && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setTeacherSignature(null)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear signature
                  </button>
                )}
              </div>

              {/* Director signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Director</div>
                    <div className="text-xs text-slate-500">
                      {planStatus === "VALIDATED"
                        ? "Signature and stamp"
                        : "Signature available after validation"}
                    </div>
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
                    {planStatus === "SUBMITTED"
                      ? "Submitted — pending director validation"
                      : "The director's signature will appear after validation"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ⭐ Signature modal for submission */}
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
// Submission signature modal
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSign(null);
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSign(dataUrl);
  };

  const getPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getPoint(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getPoint(e);
    if (!point || !lastPoint.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPoint.current = point;
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPoint.current = null;
    saveCanvas();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Teacher's signature</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">
            By signing below, you confirm that the Scheme of Work for
            <strong> {classLabel}</strong> for <strong>{termLabel}</strong> is complete
            and ready to be submitted to the director for validation.
          </div>
          <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full h-[150px] touch-none cursor-crosshair"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={clearCanvas}
              className="text-xs text-red-500 hover:underline"
            >
              Clear signature
            </button>
            {signature && (
              <span className="text-xs text-emerald-600 font-semibold">✓ Signature captured</span>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !signature}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit to director'}
          </button>
        </div>
      </div>
    </div>
  );
}
