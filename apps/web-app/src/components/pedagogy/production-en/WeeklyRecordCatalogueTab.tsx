"use client";

/**
 * ============================================================================
 * CATALOGUE — Weekly Records of Work des années antérieures (EN track)
 * ============================================================================
 *
 * ⭐ V2 — même pattern que le Catalogue cahier journal + fiches pédagogiques
 *    (explorateur Windows) pour que les Weekly Records soient sauvegardés
 *    et retrouvés d'année en année.
 *
 * Hiérarchie :
 *   Classe → Année (ex: 2025-2026) → Terme (First/Second/Third Term)
 *     └── Weekly Record (carte avec statut + boutons Voir / PDF / Réutiliser)
 *
 * Boutons :
 *   - Voir → affichage inline de la grille 13 colonnes (read-only, avec dates)
 *   - PDF → export client-side (jsPDF — pages de 3 semaines, même lib que
 *     l'onglet principal)
 *   - Réutiliser → duplication vers l'année courante (DRAFT)
 *
 * Backend :
 *   - GET  /api/pedagogy-space/weekly-record-catalogue?teacherId=
 *   - GET  /api/pedagogy/monthly-plans?...&documentType=WEEKLY_RECORD
 *   - POST /api/pedagogy/monthly-plans/duplicate-to-year
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  FolderOpen, ChevronRight, Loader2, CalendarDays, CalendarRange,
  Eye, Download, Copy, ArrowLeft, Users, Clock, Send,
  CheckCircle2, XCircle, FileSpreadsheet, Search,
} from "lucide-react";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  WEEKS_PER_TERM, WEEK_LABELS,
  parseWeekDatesJson, formatDateEN,
  exportWeeklyRecordPdf, type WeeklyRecordCellData,
} from "@/lib/pedagogy/weekly-record-pdf";

interface WeeklyRecordCatalogueTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// ⭐ Type du chemin de navigation dans l'arbre : class → year → term
type NavLevel = "class" | "year" | "term";
type NavStep = { type: NavLevel; id: string; label: string };

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",     color: "bg-slate-100 text-slate-700",  icon: Clock },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700",    icon: Send },
  VALIDATED: { label: "Validated", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",  color: "bg-red-100 text-red-700",     icon: XCircle },
};

const TERM_ICONS: Record<string, { icon: any; color: string }> = {
  'First Term':  { icon: CalendarRange, color: "bg-blue-100 text-blue-700" },
  'Second Term': { icon: CalendarRange, color: "bg-emerald-100 text-emerald-700" },
  'Third Term':  { icon: CalendarRange, color: "bg-amber-100 text-amber-700" },
};

function cn2(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ============================================================================
// COMPOSANT PRINCIPAL — WeeklyRecordCatalogueTab
// ============================================================================

export function WeeklyRecordCatalogueTab({ tenantId, academicYearId, teacherId }: WeeklyRecordCatalogueTabProps) {
  const [data, setData] = useState<{ classes: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<NavStep[]>([]);
  const [viewedRecord, setViewedRecord] = useState<any>(null);
  const [viewedCells, setViewedCells] = useState<any[] | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [duplicatingKey, setDuplicatingKey] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { tenant, academicYear } = useModuleContext();

  // === CHARGEMENT DU CATALOGUE ===
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId });
      const res = await fetch(`/api/pedagogy-space/weekly-record-catalogue?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast.error("Error loading catalogue", { description: e.message || "Unable to load the Weekly Record catalogue." });
      setData({ classes: [] });
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  // === NAVIGATION ===
  const typeOrder: Record<NavLevel, number> = { class: 0, year: 1, term: 2 };
  const navigateTo = (folder: NavStep) => {
    const newLevel = typeOrder[folder.type];
    const truncated = path.filter(p => typeOrder[p.type] < newLevel);
    setPath([...truncated, folder]);
    setViewedRecord(null);
    setViewedCells(null);
  };
  const navigateUp = (level: NavLevel | "root") => {
    if (level === "root") { setPath([]); setViewedRecord(null); setViewedCells(null); return; }
    setPath(path.filter(p => typeOrder[p.type] <= typeOrder[level]));
    setViewedRecord(null);
    setViewedCells(null);
  };

  // === VOIR UN RECORD (inline) ===
  const handleViewRecord = async (record: any) => {
    setViewedRecord(record);
    setViewedCells(null);
    setViewLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy/monthly-plans?academicYearId=${encodeURIComponent(record.academicYearId)}&classLevel=${encodeURIComponent(record.classLevel)}&month=${encodeURIComponent(record.term)}&teacherId=${encodeURIComponent(record.teacherId || '')}&documentType=WEEKLY_RECORD`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setViewedCells(json.cells || []);
    } catch (e: any) {
      toast.error("Error loading record", { description: e.message });
      setViewedCells([]);
    } finally {
      setViewLoading(false);
    }
  };

  // === PDF (même lib que l'onglet principal — pages de 3 semaines) ===
  const handleExportPdf = async (record: any) => {
    const key = `${record.academicYearId}|${record.classLevel}|${record.term}`;
    setExportingKey(key);
    try {
      // Charger les cellules du record
      const res = await fetch(
        `/api/pedagogy/monthly-plans?academicYearId=${encodeURIComponent(record.academicYearId)}&classLevel=${encodeURIComponent(record.classLevel)}&month=${encodeURIComponent(record.term)}&teacherId=${encodeURIComponent(record.teacherId || '')}&documentType=WEEKLY_RECORD`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const cells: WeeklyRecordCellData[] = (json.cells || [])
        .filter((c: any) => (c.subDomain || '') !== 'DIRECTOR_OBS')
        .map((c: any) => ({ domain: c.domain, subDomain: c.subDomain, content: c.content }));
      const subjectNames = [...new Set(cells.map(c => c.domain))];
      const weekDates = parseWeekDatesJson(json.weekDates);

      let schoolInfo: any = {};
      try {
        const idRes = await fetch('/api/settings/identity', { credentials: 'include' });
        if (idRes.ok) schoolInfo = await idRes.json();
      } catch {}

      await exportWeeklyRecordPdf({
        subjectNames,
        cells,
        weekDates,
        termLabel: record.term,
        classLabel: record.className || record.classLevel,
        academicYearLabel: record.yearLabel,
        teacherName: record.teacherName || undefined,
        teacherSignature: json.teacherSignature || null,
        directorSignature: json.directorSignature || null,
        headTeacherInitials: record.headTeacherInitials || json.headTeacherInitials || null,
        headTeacherDate: record.headTeacherDate || json.headTeacherDate || null,
        headTeacherSignature: json.headTeacherSignature || null,
        header: {
          schoolName: schoolInfo.schoolName || schoolInfo.name || tenant?.name || 'School',
          schoolLogoUrl: schoolInfo.logoUrl || schoolInfo.logo || (tenant?.id ? `/api/tenants/${tenant.id}/logo` : null),
          schoolAddress: schoolInfo.address || schoolInfo.schoolAddress || null,
          schoolPhone: schoolInfo.phone || schoolInfo.schoolPhone || null,
          schoolEmail: schoolInfo.email || schoolInfo.schoolEmail || null,
          schoolLevel: 'PRIMAIRE',
        },
        filename: `Weekly_Record_${(record.className || record.classLevel).replace(/\s+/g, '_')}_${record.term}_${record.yearLabel || ''}.pdf`,
      });
      toast.success('✅ PDF exported successfully');
    } catch (e: any) {
      toast.error("Export error", { description: e.message });
    } finally {
      setExportingKey(null);
    }
  };

  // === RÉUTILISER (duplication vers l'année courante) ===
  const handleReuse = async (record: any) => {
    const key = `${record.academicYearId}|${record.classLevel}|${record.term}`;
    const ok = window.confirm(
      `Reuse this Weekly Record for the current year?\n\nA copy will be created as a Draft for ${record.term} — ${record.className || record.classLevel}. You can then edit it and submit it to the director.`
    );
    if (!ok) return;
    setDuplicatingKey(key);
    try {
      const res = await fetch(`/api/pedagogy/monthly-plans/duplicate-to-year`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId: record.academicYearId,
          classLevel: record.classLevel,
          month: record.term,
          teacherId: record.teacherId || teacherId,
          targetAcademicYearId: academicYearId,
          targetTeacherId: teacherId,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const result = await res.json();
      toast.success("✅ Weekly Record reused", {
        description: `A copy has been created for the current year (${result.copied} cells). Status: Draft. Edit it in the "Weekly Record of Work" tab.`,
      });
    } catch (e: any) {
      toast.error("Error while reusing", { description: e.message });
    } finally {
      setDuplicatingKey(null);
    }
  };

  // === RENDU ===

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="font-medium">Loading Weekly Record catalogue…</p>
        <p className="text-xs text-slate-400 mt-1">Fetching Weekly Records of Work from all academic years</p>
      </div>
    );
  }

  if (!data || !data.classes || data.classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <FolderOpen className="h-12 w-12 text-slate-300 mb-3" />
        <p className="font-medium">Catalogue empty</p>
        <p className="text-sm text-slate-400 mt-1">
          No Weekly Record of Work found for your account yet.
          Start by saving a Weekly Record in the main tab.
        </p>
      </div>
    );
  }

  // ⭐ Viewer inline d'un record
  if (viewedRecord) {
    return (
      <WeeklyRecordViewer
        record={viewedRecord}
        cells={viewedCells}
        loading={viewLoading}
        onBack={() => { setViewedRecord(null); setViewedCells(null); }}
        onExportPDF={() => handleExportPdf(viewedRecord)}
        exporting={exportingKey === `${viewedRecord.academicYearId}|${viewedRecord.classLevel}|${viewedRecord.term}`}
      />
    );
  }

  // ⭐ Trouver le niveau courant dans l'arbre
  const currentClass = path.find(p => p.type === "class");
  const currentYear = path.find(p => p.type === "year");
  const currentTerm = path.find(p => p.type === "term");

  const classData = currentClass ? data.classes.find((c: any) => c.id === currentClass.id) : null;
  const effectiveClass = currentClass ? classData : (data.classes.length === 1 ? data.classes[0] : null);
  const yearData = currentYear && effectiveClass
    ? effectiveClass.academicYears.find((y: any) => y.id === currentYear.id)
    : null;

  // Recherche (filtre les classes à la racine)
  const filteredClasses = searchQuery
    ? data.classes.filter((c: any) => String(c.name || c.classLevel).toLowerCase().includes(searchQuery.toLowerCase()))
    : data.classes;

  return (
    <div className="space-y-4">
      {/* === BREADCRUMB === */}
      <div className="flex items-center gap-1 text-xs flex-wrap bg-slate-50 border border-slate-200 rounded-lg p-2.5">
        <button onClick={() => navigateUp("root")}
          className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded">
          <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
          Catalogue
        </button>
        {effectiveClass && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button onClick={() => navigateUp("class")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              {effectiveClass.name || effectiveClass.classLevel}
            </button>
          </>
        )}
        {currentYear && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <button onClick={() => navigateUp("year")}
              className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-200 rounded">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
              {currentYear.label}
            </button>
          </>
        )}
        {currentTerm && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-900 bg-slate-200 rounded">
              <CalendarRange className="h-3.5 w-3.5 text-purple-600" />
              {currentTerm.label}
            </span>
          </>
        )}
      </div>

      {/* === NIVEAU RACINE : liste des CLASSES === */}
      {!effectiveClass && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search a class…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          {filteredClasses.length === 0 ? (
            <p className="text-center py-8 text-sm text-slate-400">No class matches your search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredClasses.map((cls: any) => (
                <button key={cls.id}
                  onClick={() => navigateTo({ type: "class", id: cls.id, label: cls.name || cls.classLevel })}
                  className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{cls.name || cls.classLevel}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {cls.academicYears.filter((y: any) => y.terms.length > 0).length} year(s) with records
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === NIVEAU CLASSE : liste des ANNÉES === */}
      {effectiveClass && !currentYear && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {effectiveClass.academicYears.map((year: any) => {
            const totalRecords = year.terms.length;
            const activeBadge = year.isActive ? (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">CURRENT</span>
            ) : null;
            return (
              <button key={year.id}
                onClick={() => navigateTo({ type: "year", id: year.id, label: year.label })}
                className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 flex items-center">
                    {year.label || year.name}
                    {activeBadge}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {totalRecords} term(s) — {year.startDate ? formatDateFR(year.startDate) : ''} → {year.endDate ? formatDateFR(year.endDate) : ''}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* === NIVEAU ANNÉE : liste des TERMES avec records === */}
      {effectiveClass && currentYear && yearData && (
        <div className="space-y-3">
          {yearData.terms.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-200">
              <CalendarRange className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Weekly Record for this academic year.</p>
            </div>
          ) : (
            yearData.terms.map((record: any) => {
              const key = `${record.academicYearId}|${record.classLevel}|${record.term}`;
              const badge = STATUS_BADGES[record.status] || STATUS_BADGES.DRAFT;
              const BadgeIcon = badge.icon;
              const termIcon = TERM_ICONS[record.term] || TERM_ICONS['First Term'];
              const TermIcon = termIcon.icon;
              const weekDates = parseWeekDatesJson(record.weekDates);
              const isCurrentYear = record.academicYearId === academicYearId;
              return (
                <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-blue-300 transition-all">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn2("p-2 rounded-lg", termIcon.color)}>
                        <TermIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                          {record.term}
                          <span className={cn2("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", badge.color)}>
                            <BadgeIcon className="h-3 w-3" /> {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                          <span>{record.cellCount} entries</span>
                          {record.teacherName && <span>Teacher: {record.teacherName}</span>}
                          {record.submittedAt && <span>Submitted: {formatDateFR(record.submittedAt)}</span>}
                          {weekDates.length > 0 && <span>Weeks: {formatDateEN(weekDates[0])} → {formatDateEN(weekDates[weekDates.length - 1])}</span>}
                          {record.headTeacherInitials && <span>Head Teacher: {record.headTeacherInitials}{record.headTeacherDate ? ` (${formatDateFR(record.headTeacherDate)})` : ''}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleViewRecord(record)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => handleExportPdf(record)} disabled={exportingKey === key}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
                        {exportingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
                      </button>
                      {!isCurrentYear && (
                        <button onClick={() => handleReuse(record)} disabled={duplicatingKey === key}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
                          {duplicatingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Reuse
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ⭐ VIEWER INLINE — grille 13 colonnes read-only (avec dates de semaines)
// ============================================================================
function WeeklyRecordViewer({
  record, cells, loading, onBack, onExportPDF, exporting,
}: {
  record: any;
  cells: any[] | null;
  loading: boolean;
  onBack: () => void;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const weekDates = useMemo(() => parseWeekDatesJson(record.weekDates), [record.weekDates]);

  // Matières = domaines uniques des cellules (hors observations directeur)
  const subjects = useMemo(() => {
    if (!cells) return [];
    return [...new Set(cells.filter((c: any) => (c.subDomain || '') !== 'DIRECTOR_OBS').map((c: any) => c.domain))];
  }, [cells]);

  // Observations du directeur par matière
  const directorObs = useMemo(() => {
    if (!cells) return [];
    return cells.filter((c: any) => (c.subDomain || '') === 'DIRECTOR_OBS');
  }, [cells]);

  const getCellHtml = (subject: string, week: number) => {
    const c = cells?.find((x: any) => x.domain === subject && (x.subDomain || '') === String(week));
    return c?.content || '';
  };

  const badge = STATUS_BADGES[record.status] || STATUS_BADGES.DRAFT;
  const BadgeIcon = badge.icon;

  return (
    <div className="space-y-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to catalogue
        </button>
        <button onClick={onExportPDF} disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
        </button>
      </div>

      {/* Info du record */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-purple-50 rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              Weekly Record of Work — {record.term}
              <span className={cn2("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", badge.color)}>
                <BadgeIcon className="h-3 w-3" /> {badge.label}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
              <span>Class: {record.className || record.classLevel}</span>
              <span>Year: {record.yearLabel}</span>
              {record.teacherName && <span>Teacher: {record.teacherName}</span>}
              {record.submittedAt && <span>Submitted: {formatDateFR(record.submittedAt)}</span>}
              {record.validatedAt && <span>Validated: {formatDateFR(record.validatedAt)}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Grille read-only */}
      {loading ? (
        <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-200">
          No entries found in this record.
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-slate-800 overflow-hidden shadow-sm">
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-base font-bold tracking-wide">WEEKLY RECORD OF WORK</span>
            <span className="text-sm font-semibold">{record.className || record.classLevel} — {record.term}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: "2800px" }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                {WEEK_LABELS.map((_, i) => <col key={i} style={{ width: `${90 / WEEKS_PER_TERM}%` }} />)}
              </colgroup>
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="p-2 border border-slate-300 text-center font-bold text-slate-700 uppercase">
                    SUBJECTS
                  </th>
                  {WEEK_LABELS.map((label, i) => (
                    <th key={i} className="px-2 py-2 border border-slate-300 text-center font-bold text-slate-700 uppercase text-[10px]">
                      {label}
                    </th>
                  ))}
                </tr>
                <tr className="bg-amber-50">
                  {WEEK_LABELS.map((_, i) => (
                    <th key={i} className="px-2 py-1 border border-slate-300 text-center font-bold text-amber-800 text-[10px] tabular-nums">
                      {weekDates[i] ? formatDateEN(weekDates[i]) : "—"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject: string, subjIdx: number) => (
                  <tr key={subjIdx} className={cn2(subjIdx % 2 === 1 && "bg-slate-50/50")}>
                    <td className="p-2 border border-slate-300 font-bold text-slate-800 bg-slate-100">
                      {subject}
                    </td>
                    {WEEK_LABELS.map((_, weekIdx) => (
                      <td key={weekIdx} className="p-2 border border-slate-200 align-top text-slate-700">
                        <div dangerouslySetInnerHTML={{ __html: getCellHtml(subject, weekIdx + 1) || '—' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
            <p className="text-xs font-semibold text-slate-500 italic">
              NOTE: WHEN THE SCHOOL IS SHUT DURING A COMPLETE WEEK NO ENTRY SHOULD BE MADE
            </p>
          </div>
          {/* Head Teacher block (read-only) */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold text-slate-700">
              Head Teacher&apos;s Initial and Date: {record.headTeacherInitials || '—'}
              {record.headTeacherDate ? ` — ${formatDateFR(record.headTeacherDate)}` : ''}
            </div>
            {record.teacherSignature && (
              <img src={record.teacherSignature} alt="Teacher signature" className="max-h-14" />
            )}
          </div>
        </div>
      )}

      {/* Observations du directeur (si présentes) */}
      {directorObs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Director&apos;s observations</h4>
          <div className="space-y-1.5">
            {directorObs.map((obs: any, i: number) => (
              <div key={i} className="text-xs text-slate-600 pl-2 border-l-2 border-blue-300">
                <strong>{obs.domain}:</strong> <span dangerouslySetInnerHTML={{ __html: obs.content }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
