"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL — Grille hebdomadaire (5 jours × matières dynamiques)
 * ============================================================================
 *
 * Template officiel du primaire/maternelle.
 * Format paysage : 2 pages (recto + verso).
 * Les matières sont récupérées DYNAMIQUEMENT depuis la base de données
 * selon ce que l'école a configuré (table class_subjects / subjects).
 * Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  NotebookPen, Loader2, Save, RefreshCw, Send, Lock, Calendar,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock,
  FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";

interface CahierJournalTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// === CONSTANTES DU TEMPLATE OFFICIEL ===

const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

// Helper pour parser les entries JSON
function parseEntries(entries: any): Record<string, Record<string, string>> {
  if (!entries) return {};
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return {}; }
  }
  return entries as Record<string, Record<string, string>>;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Calcul du lundi de la semaine pour une date donnée
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = day === 0 ? -6 : 1 - day; // reculer au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ⭐ Format LOCAL (YYYY-MM-DD) — évite le bug de timezone de toISOString()
// qui convertit en UTC et décale la date d'un jour en arrière quand on est en
// UTC+1 (ex: lundi 20 juillet 00:00 local → dimanche 19 juillet 23:00 UTC).
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  // Parser comme date locale (YYYY-MM-DD) pour éviter le bug UTC
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CahierJournalTab({ tenantId, academicYearId, teacherId }: CahierJournalTabProps) {
  const { academicYear } = useModuleContext();
  const { user } = useAppSession();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfWeek(new Date()));
  const [journal, setJournal] = useState<any>(null);
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>({});
  const [observations, setObservations] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [directorNameState, setDirectorNameState] = useState("");
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Matières dynamiques chargées depuis la base de données
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);

  // === Chargement des classes + matières ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].classId);
        }
      } catch {
        setClasses([]);
      }
    })();
  }, [teacherId, academicYearId]);

  // === Chargement des matières disponibles pour la classe sélectionnée ===
  useEffect(() => {
    if (!selectedClassId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${selectedClassId}&teacherId=${teacherId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setDynamicSubjects(Array.isArray(data) ? data : []);
      } catch {
        setDynamicSubjects([]);
      }
    })();
  }, [selectedClassId, academicYearId, teacherId]);

  // ⭐ REGROUPEMENT DES MATIÈRES (cahier journal)
  // Certaines matières sont regroupées sous un seul nom de colonne :
  //   - FRANÇAIS : Dictée, Grammaire, Exercices structuraux, Conjugaison,
  //     Communication orale, Orthographe, Lecture, Vocabulaire, Expression écrite,
  //     Graphisme, Écriture, Combinatoire
  //   - ÉDUCATION SOCIALE : Morale, Civisme, Histoire, Géographie
  //   - ÉDUCATION ARTISTIQUE : Chant, Poésie, Dessin, Compte, Couture, Atelier,
  //     Art dramatique, Éducation artistique plastique, Éducation artistique vivante
  // Les matières non listées dans un groupe restent individuelles.
  const SUBJECT_GROUPS: { groupName: string; subjects: string[] }[] = [
    {
      groupName: "Français",
      subjects: [
        "Dictée", "Grammaire", "Exercices structuraux", "Conjugaison",
        "Communication orale", "Orthographe", "Lecture", "Vocabulaire",
        "Expression écrite", "Graphisme", "Écriture", "Combinatoire",
        "Dictee", "Exercices Structuraux", "Communication Orale",
        "Expression Ecrite",
      ],
    },
    {
      groupName: "Éducation sociale",
      subjects: [
        "Morale", "Civisme", "Histoire", "Géographie", "Geographie",
        "Education sociale", "Éducation sociale",
      ],
    },
    {
      groupName: "Éducation artistique",
      subjects: [
        "Chant", "Poésie", "Dessin", "Compte", "Couture", "Atelier",
        "Art dramatique", "Éducation artistique plastique",
        "Éducation artistique vivante", "Education artistique plastique",
        "Education artistique vivante", "Poesie",
      ],
    },
  ];

  // Type pour une colonne du tableau (groupée ou individuelle)
  type TableColumn =
    | { type: "group"; groupName: string; subjects: any[] }
    | { type: "single"; subject: any };

  // Transformer la liste plate de matières en colonnes (groupées ou individuelles)
  const groupedColumns: TableColumn[] = (() => {
    const used = new Set<string>(); // subjectIds déjà placés dans un groupe
    const result: TableColumn[] = [];

    // 1. Parcourir les groupes définis
    for (const group of SUBJECT_GROUPS) {
      const matchingSubjects = dynamicSubjects.filter((s: any) => {
        const name = (s.subjectName || "").trim().toLowerCase();
        return group.subjects.some(g => g.trim().toLowerCase() === name);
      });
      if (matchingSubjects.length > 0) {
        result.push({ type: "group", groupName: group.groupName, subjects: matchingSubjects });
        matchingSubjects.forEach((s: any) => used.add(s.subjectId));
      }
    }

    // 2. Ajouter les matières non groupées (individuelles)
    for (const s of dynamicSubjects) {
      if (!used.has(s.subjectId)) {
        result.push({ type: "single", subject: s });
      }
    }

    return result;
  })();

  // Répartir les colonnes en 2 pages (recto = première moitié, verso = seconde moitié)
  const RECTO_COLUMNS = groupedColumns.slice(0, Math.ceil(groupedColumns.length / 2));
  const VERSO_COLUMNS = groupedColumns.slice(Math.ceil(groupedColumns.length / 2));

  // ⭐ Obtenir la clé d'entrée pour une colonne (nom du groupe ou nom de la matière)
  const getColumnKey = (col: TableColumn): string => {
    if (col.type === "group") return col.groupName;
    return col.subject.subjectName;
  };

  // ⭐ Obtenir la liste des noms de matières pour l'affichage sous l'en-tête de groupe
  const getColumnSubLabels = (col: TableColumn): string[] => {
    if (col.type === "group") {
      return col.subjects.map((s: any) => s.subjectName);
    }
    return [];
  };

  // === Chargement du cahier journal ===
  const loadJournal = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pedagogy-space/cahier-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, teacherId, classId: selectedClassId,
          weekStartDate: formatDate(weekStart),
          className: classes.find(c => c.classId === selectedClassId)?.className || "",
        }),
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setJournal(data);
      setEntries(parseEntries(data.entries));
      setObservations(data.observations || "");
      setDirectorName(data.directorName || "");
      // ⭐ Charger les signatures existantes
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
    } catch (e: any) {
      toast.error("Erreur lors du chargement", { description: e.message });
      setJournal(null);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, selectedClassId, weekStart, classes]);

  useEffect(() => {
    if (selectedClassId) loadJournal();
  }, [loadJournal, selectedClassId]);

  // ⭐ Charger le nom du directeur depuis les settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setDirectorNameState(data.directorName || data.director_name || '');
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ⭐ Export Excel / PDF
  const handleExport = async (format: "excel" | "pdf") => {
    if (!journal || exporting) return;
    setExporting(format);
    try {
      const res = await fetch(
        `/api/pedagogy-space/cahier-journal/${journal.id}/export?format=${format}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "csv" : "pdf";
      a.download = `Cahier_Journal_${formatDate(weekStart)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`✅ ${format === "excel" ? "Excel" : "PDF"} exporté`);
    } catch (e: any) {
      toast.error("Erreur d'export", { description: e.message });
    } finally {
      setExporting(null);
    }
  };

  // === Sauvegarde ===
  const handleSave = async () => {
    if (!journal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries,
          observations,
          directorName,
          teacherSignature,
          directorSignature,
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success("✅ Cahier journal enregistré");
      loadJournal();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Soumission au directeur ===
  // ⭐ La soumission du cahier journal est désormais gérée par le bouton unifié
  //    dans l'en-tête du registre d'appel (qui soumet registre + évaluation
  //    mensuelle + cahier journal en une seule transaction).
  //    Ancien handleSubmit supprimé.

  // === Navigation entre semaines ===
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const thisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  // === Mise à jour d'une case (day × subject) ===
  const updateEntry = (dayKey: string, subjectKey: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || {}),
        [subjectKey]: value,
      },
    }));
  };

  const getEntry = (dayKey: string, subjectKey: string): string => {
    return entries[dayKey]?.[subjectKey] || "";
  };

  const selectedClass = classes.find(c => c.classId === selectedClassId);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const isReadOnly = journal && (journal.status === "SUBMITTED" || journal.status === "VALIDATED");
  const statusConfig = journal ? STATUS_CONFIG[journal.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="space-y-4">
      {/* === En-tête : classe + semaine + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
            disabled={loading}
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId} ({c.totalStudents || 0} élèves)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Semaine</label>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[180px] text-center">
              du {formatDateFR(formatDate(weekStart))} au {formatDateFR(formatDate(weekEnd))}
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={thisWeek} className="ml-1 p-2 hover:bg-blue-100 text-blue-600 rounded-lg" title="Cette semaine">
              <Calendar className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {statusConfig && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide", statusConfig.color)}>
            <statusConfig.icon className="h-4 w-4" />
            {statusConfig.label}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading || !journal || isReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {/* ⭐ Bouton Soumettre SUPPRIMÉ — désormais géré par le bouton unifié
              dans l'en-tête du registre d'appel (qui soumet registre + évaluation
              mensuelle + cahier journal en une fois). */}
          {journal && journal.status === "DRAFT" && (
            <span className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg font-semibold">
              ✓ Prêt pour soumission (bouton unifié en haut du registre d'appel)
            </span>
          )}
          {journal && journal.status !== "DRAFT" && (
            <span className="text-xs text-emerald-700 bg-emerald-100 px-3 py-2 rounded-lg font-semibold">
              {journal.status === 'SUBMITTED' ? '✓ Soumis au directeur' : journal.status === 'VALIDATED' ? '✓ Validé' : journal.status}
            </span>
          )}
          {/* ⭐ Boutons Export */}
          {journal && (
            <>
              <button onClick={() => handleExport("excel")} disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Export Excel
              </button>
              <button onClick={() => handleExport("pdf")} disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {journal?.status === "REJECTED" && journal.rejectionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>Motif du rejet :</strong> {journal.rejectionReason}
        </div>
      )}

      {/* === En-tête du document === */}
      {!loading && journal && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 print:shadow-none">
          {dynamicSubjects.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <strong>Aucune matière configurée pour cette classe.</strong> L'administration de l'école
              doit d'abord configurer les matières dans le module Matières (table class_subjects).
            </div>
          )}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">CAHIER JOURNAL</h2>
              <div className="text-sm text-slate-600">
                Nom de la classe : <span className="font-semibold">{selectedClass?.className || "—"}</span>
              </div>
              <div className="text-sm text-slate-600">
                Effectif : {selectedClass?.totalStudents || 0} élèves
                ({selectedClass?.boys || 0} G, {selectedClass?.girls || 0} F)
              </div>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div>Semaine du <span className="font-semibold">{formatDateFR(formatDate(weekStart))}</span></div>
              <div>au <span className="font-semibold">{formatDateFR(formatDate(weekEnd))}</span></div>
              <div className="text-xs text-slate-400 mt-1">
                Année académique {academicYear?.label || academicYear?.name || ""}
              </div>
            </div>
          </div>

          {/* === PAGE 1 (RECTO) === JOURS | COLONNES GROUPÉES | OBSERVATIONS */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 1 — Recto</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {RECTO_COLUMNS.map((col) => {
                    const key = getColumnKey(col);
                    const subLabels = getColumnSubLabels(col);
                    return (
                      <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "180px" }}>
                        <div className="font-bold">{key}</div>
                        {subLabels.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                            {subLabels.map((label, i) => (
                              <span key={i}>
                                {i > 0 && <span className="text-slate-300"> · </span>}
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                    OBSERVATIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                      <div className="text-[10px] text-slate-400 mt-1 font-normal">
                        {formatDateFR(formatDate(new Date(weekStart.getTime() + (day.id - 1) * 86400000)))}
                      </div>
                    </td>
                    {RECTO_COLUMNS.map((col) => {
                      const key = getColumnKey(col);
                      return (
                        <td key={key} className="border border-slate-300 p-0">
                          <RichTextEditor
                            value={getEntry(day.key, key)}
                            onChange={(html) => updateEntry(day.key, key, html)}
                            disabled={isReadOnly}
                            placeholder="—"
                            minHeight="96px"
                          />
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 p-0">
                      <RichTextEditor
                        value={getEntry(day.key, "observations")}
                        onChange={(html) => updateEntry(day.key, "observations", html)}
                        disabled={isReadOnly}
                        placeholder="—"
                        minHeight="96px"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === PAGE 2 (VERSO) === COLONNES GROUPÉES (suite) */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 2 — Verso</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {VERSO_COLUMNS.map((col) => {
                    const key = getColumnKey(col);
                    const subLabels = getColumnSubLabels(col);
                    return (
                      <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                        <div className="font-bold">{key}</div>
                        {subLabels.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                            {subLabels.map((label, i) => (
                              <span key={i}>
                                {i > 0 && <span className="text-slate-300"> · </span>}
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                    </td>
                    {VERSO_COLUMNS.map((col) => {
                      const key = getColumnKey(col);
                      return (
                        <td key={key} className="border border-slate-300 p-0">
                          <RichTextEditor
                            value={getEntry(day.key, key)}
                            onChange={(html) => updateEntry(day.key, key, html)}
                            disabled={isReadOnly}
                            placeholder="—"
                            minHeight="96px"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === OBSERVATIONS GLOBALES (bas de page) === */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Observations générales de la semaine
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              disabled={isReadOnly}
              rows={3}
              placeholder="Observations générales sur la semaine..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50"
            />
          </div>

          {/* === PIED DE PAGE — Signatures (comme Registre d'appel) === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
            {/* Signature Directeur */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Visa du Directeur / de la Directrice</div>
                  <div className="text-xs text-slate-500">{directorNameState || 'Nom du directeur'} — Signature et cachet</div>
                </div>
                {directorSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
              </div>
              {directorSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={directorSignature} alt="Signature Directeur" className="max-h-24 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={120}
                  disabled={isReadOnly}
                  placeholder="Signature du Directeur"
                  onSignatureChange={(data) => setDirectorSignature(data)}
                />
              )}
              {directorSignature && !isReadOnly && (
                <button type="button" onClick={() => setDirectorSignature(null)} className="text-xs text-red-500 hover:underline">
                  Effacer la signature
                </button>
              )}
            </div>

            {/* Signature Titulaire */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Visa du Titulaire</div>
                  <div className="text-xs text-slate-500">{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Nom du titulaire'} — Signature</div>
                </div>
                {teacherSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
              </div>
              {teacherSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={teacherSignature} alt="Signature Titulaire" className="max-h-24 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={120}
                  disabled={isReadOnly}
                  placeholder="Signature du Titulaire"
                  onSignatureChange={(data) => setTeacherSignature(data)}
                />
              )}
              {teacherSignature && !isReadOnly && (
                <button type="button" onClick={() => setTeacherSignature(null)} className="text-xs text-red-500 hover:underline">
                  Effacer la signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === États de chargement === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement du cahier journal…
        </div>
      )}

      {!loading && !selectedClassId && classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <NotebookPen className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune classe assignée</p>
          <p className="text-sm text-slate-500 mt-1">Vous n'avez pas de classe assignée pour cette année.</p>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          Ce cahier journal est verrouillé (statut: {journal?.status}). Vous ne pouvez plus le modifier.
        </div>
      )}
    </div>
  );
}
