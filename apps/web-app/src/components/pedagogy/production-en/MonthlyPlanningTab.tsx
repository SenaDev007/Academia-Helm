"use client";

/**
 * ============================================================================
 * PLANIFICATION MENSUELLE — Sous-onglet Espace Pédagogique
 * ============================================================================
 *
 * ⭐ STRUCTURE CONFORME AUX DOCUMENTS OFFICIELS + ALIGNÉE SUR CAHIER JOURNAL :
 *
 *   - Dates dynamiques automatiques (Du [date] au [date]) dans l'en-tête de
 *     chaque semaine — comme Cahier Journal utilise weekStartDate/weekEndDate
 *   - Section SIGNATURE dédiée (séparée du tableau) avec :
 *     • Visa du Directeur (image de signature, visible seulement après VALIDATED)
 *     • Visa du Titulaire (SignatureCanvas pour signer)
 *   - Workflow de soumission : DRAFT → SUBMITTED → VALIDATED / REJECTED
 *   - Soumission au directeur (validation direction)
 *   - Responsive mobile : tableau scrollable + layout en cartes pour sm
 *
 * 1. CE1-CM2 : 1 fiche standard (5 semaines × champs de formation)
 * 2. CI-CP IMMERSION (T1 : Septembre → Décembre) — focus accueil/exploration
 * 3. CI-CP SYSTÉMATIQUE (T2+T3 : Janvier → Juin) — leçons structurées
 * 4. MATERNELLE : 5 domaines (D1-D5) × activités × 4 semaines
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Sparkles, Pencil, Check, X,
  BookOpen, AlertCircle, Info, Send, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Download, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolLevel } from "@/hooks/useSchoolLevel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface MonthlyPlanCell {
  id?: string;
  weekNumber: number;
  domain: string;
  subDomain?: string;
  activityType?: "SA" | "SEQUENCE" | "U" | "D" | null;
  activityNumber?: number | null;
  sequenceNumber?: number | null;
  content: string;
  isAutoProposed: boolean;
  isCustom: boolean;
  annualPlanId?: string | null;
}

interface MonthlyPlanResponse {
  cells: MonthlyPlanCell[];
  isAutoProposed: boolean;
  hasExistingCustom: boolean;
  status?: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED";
  teacherSignature?: string | null;
  directorSignature?: string | null;
  directorObservation?: string | null;
}

interface AvailableClass {
  value: string;
  label: string;
}

interface MonthlyPlanningTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  availableClasses?: AvailableClass[];
  isDirector?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de dates (alignés sur Cahier Journal)
// ─────────────────────────────────────────────────────────────────────────

// ⭐ Format LOCAL (YYYY-MM-DD) — évite le bug UTC de toISOString()
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateFRShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/**
 * ⭐ Compute the 5 week ranges for a given month/year.
 *    Each week starts on Monday and ends on Friday (NOT Sunday).
 *    This matches the Cahier Journal + Fiche Pédagogique convention:
 *      school week = Lundi → Vendredi (Monday → Friday).
 *
 *    Week 1 = the week containing the 1st day of the month
 *      (if the 1st is not a Monday, the week starts from the Monday before/after).
 *    Returns array of { start: Date, end: Date } for 5 weeks.
 */
function computeWeekRangesForMonth(monthName: string, year: number): { start: Date; end: Date }[] {
  // Map month name → month index (0-based)
  const monthIdx = MONTH_NAMES.indexOf(monthName); // 0 = Janvier, 9 = Septembre
  if (monthIdx === -1) return [];

  const weeks: { start: Date; end: Date }[] = [];
  let weekStart: Date;

  if (monthName === "Septembre") {
    // ⭐ RENTRÉE SCOLAIRE : la pré-rentrée = 2e lundi de septembre
    //    La rentrée proprement dite (cours) = 3e lundi de septembre
    //    Les planifications commencent à la semaine du 2e lundi (pré-rentrée)
    //    Exemple 2026 : pré-rentrée = 7 sept (2e lundi), rentrée = 14 sept (3e lundi)
    //    Week 1 = semaine du 2e lundi = 7-11 sept (pour 2026)
    weekStart = getNthMondayOfMonth(year, monthIdx, 2); // 2nd Monday = pre-rentrée week
  } else {
    // Other months : Week 1 = Monday of the week containing the 1st
    const firstDay = new Date(year, monthIdx, 1);
    const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ...
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart = new Date(firstDay);
    weekStart.setDate(weekStart.getDate() + offsetToMonday);
  }

  for (let i = 0; i < 5; i++) {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 4); // +4 days = Friday (Lundi→Vendredi)
    weeks.push({ start, end });
    weekStart = new Date(end);
    weekStart.setDate(weekStart.getDate() + 3); // Friday + 3 = next Monday
  }
  return weeks;
}

/**
 * ⭐ Returns the Nth Monday of the given month.
 *    e.g., getNthMondayOfMonth(2026, 8, 2) = 2nd Monday of September 2026 = Sept 7, 2026
 */
function getNthMondayOfMonth(year: number, monthIdx: number, n: number): Date {
  const firstDay = new Date(year, monthIdx, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ...
  // Find the first Monday of the month
  let firstMonday = new Date(firstDay);
  if (dayOfWeek === 1) {
    // 1st is already Monday
    // firstMonday is the 1st
  } else {
    // Find next Monday after the 1st
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    firstMonday.setDate(firstMonday.getDate() + daysUntilMonday);
  }
  // Add (n-1) weeks to get the Nth Monday
  const nthMonday = new Date(firstMonday);
  nthMonday.setDate(nthMonday.getDate() + (n - 1) * 7);
  return nthMonday;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers structure
// ─────────────────────────────────────────────────────────────────────────

function isImmersionClass(classLevel: string): boolean {
  return classLevel === "CI" || classLevel === "CP";
}
function isImmersionPeriod(month: string): boolean {
  return ["Septembre", "Octobre", "Novembre", "Décembre"].includes(month);
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
    throw new Error((err as any)?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────
// Constantes — Structure des fiches (conforme PDFs officiels)
// ─────────────────────────────────────────────────────────────────────────

interface FicheChamp {
  code: string;
  label: string;
  color: string;
  subRows: string[]; // empty = single row (one cell per week), non-empty = one row per sub-row
  cellTemplate?: string; // pre-filled text for cells when subRows is empty
  subRowTemplates?: Record<string, string>; // pre-filled text per sub-row
}

const FICHE_STANDARD: FicheChamp[] = [
  {
    code: "FRANÇAIS", label: "FRANÇAIS", color: "bg-blue-600",
    subRows: ["Vocab théma", "Comm Orale", "Lecture", "Expression Écrite", "Dictée", "Vocab", "Grammaire", "Orthographe", "Écriture", "Conjugaison"],
  },
  { code: "MATH", label: "MATH", color: "bg-emerald-600", subRows: ["Arithmétique", "Mesure", "Géométrie"] },
  { code: "EST", label: "EST", color: "bg-amber-600", subRows: [] },
  { code: "EA", label: "ÉA", color: "bg-purple-600", subRows: ["Chant", "Atelier", "Dessin", "Contes", "Poésie"] },
  { code: "ES", label: "ÉS", color: "bg-indigo-600", subRows: ["Morale", "Civisme", "Compétence 2 (Histoire)", "Compétence 3 (Géographie)"] },
  { code: "EPS", label: "EPS", color: "bg-rose-600", subRows: [] },
  { code: "PETIT_PROJET", label: "Petit Projet", color: "bg-slate-600", subRows: [] },
];

const FICHE_IMMERSION: FicheChamp[] = [
  {
    code: "FRANÇAIS", label: "Français", color: "bg-blue-600",
    subRows: [], // ⭐ Single cell per week — NO sub-rows
    cellTemplate: "Thème : <br><br>Communication orale : Acquisition et utilisation des mots : <br><br><br>Initiation à la lecture : <br>Graphisme : <br>Lecture récréative : ",
  },
  {
    code: "MATHEMATIQUE", label: "Mathématique", color: "bg-emerald-600",
    subRows: [], // ⭐ Single cell per week — NO sub-rows
    cellTemplate: "SA N° <br><br>Fiche N°1 : <br><br>Fiche N°2 : <br><br>Fiche N°3 : <br><br>Fiche N°4 : <br><br>Fiche N°5 : ",
  },
  { code: "INITIATION_EST", label: "Initiation à l'EST", color: "bg-amber-600", subRows: [] },
  { code: "INITIATION_ES", label: "Initiation à l'ES", color: "bg-indigo-600", subRows: [] },
  {
    code: "EA", label: "EA", color: "bg-purple-600",
    subRows: ["Chant", "Comptine", "Dessin"], // ⭐ HAS sub-rows
  },
  { code: "EPS", label: "EPS", color: "bg-rose-600", subRows: [] },
  { code: "PETIT_PROJET", label: "Petit Projet", color: "bg-slate-600", subRows: [] },
];

const FICHE_SYSTEMATIQUE: FicheChamp[] = [
  {
    code: "FRANÇAIS", label: "Français", color: "bg-blue-600",
    subRows: ["Communication orale", "Lecture – écriture"],
    subRowTemplates: {
      "Communication orale": "Thème/Sous-thème : <br><br>",
      "Lecture – écriture": "LECTURE-ECRITURE : Leçon <br>Titre : Etude de <br><br>STRUCTURE DE LANGUE : Leçon <br>Titre : <br><br>LECTURE-ECRITURE : Leçon <br>Titre : Etude de ",
    },
  },
  {
    code: "MATHEMATIQUE", label: "Mathématique", color: "bg-emerald-600",
    subRows: [], // ⭐ Single cell per week
    cellTemplate: "SA N° <br><br>Fiche N°1 : <br><br>Fiche N°2 : <br><br>Fiche N°3 : <br><br>Fiche N°4 : <br><br>Fiche N°5 : ",
  },
  { code: "EST", label: "EST", color: "bg-amber-600", subRows: [] },
  {
    code: "ES", label: "ES", color: "bg-indigo-600",
    subRows: ["Morale", "Civisme", "Compétence"],
  },
  {
    code: "EA", label: "EA", color: "bg-purple-600",
    subRows: ["Chant", "Poésie", "Dessin", "Conte"],
  },
  { code: "EPS", label: "EPS", color: "bg-rose-600", subRows: [] },
  { code: "PETIT_PROJET", label: "Petit Projet", color: "bg-slate-600", subRows: [] },
];

// ⭐ FICHE MATERNELLE — Planification des activités pédagogiques
//    5 Domaines (D1-D5) × activités × 4 semaines (1ère → 4ème)
//    Conforme au PDF officiel "Planification mensuelle maternelle"
//    Les codes correspondent aux domaines du annual-plan-seed-data.ts (I, II, III, IV, V)
const FICHE_MATERNELLE: FicheChamp[] = [
  {
    code: "I", label: "D1 : Santé et environnement", color: "bg-emerald-600",
    subRows: ["Education pour la santé", "Passage aux toilettes", "Lavage des mains", "Goûter"],
  },
  {
    code: "II", label: "D2 : Expression corporelle", color: "bg-rose-600",
    subRows: ["Expression corporelle"],
  },
  {
    code: "III", label: "D3 : Pré-apprentissages", color: "bg-blue-600",
    subRows: ["Pré-lecture", "Pré-écriture", "Pré-mathématique", "Observation", "Education sensorielle", "Travaux manuels", "Expression plastique"],
  },
  {
    code: "IV", label: "D4 : Santé Emotionnelle", color: "bg-purple-600",
    subRows: ["Expression émotionnelle"],
  },
  {
    code: "V", label: "D5 : Relations et de l'Interaction Sociale et socio-affective", color: "bg-indigo-600",
    subRows: ["Poésie", "Chant", "Devinette", "Comptine", "Conte", "Langage"],
  },
];

// ⭐ 4 semaines pour la maternelle (conforme au document officiel)
const WEEK_LABELS_MATERNELLE = ["1ère semaine", "2ème semaine", "3ème semaine", "4ème semaine"];

const WEEK_LABELS = ["Première Semaine", "Deuxième Semaine", "Troisième Semaine", "Quatrième Semaine", "Cinquième Semaine"];
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const ALL_CLASSES: AvailableClass[] = [
  { value: "MATERNELLE_GRANDS", label: "Maternelle" },
  { value: "CI", label: "CI" }, { value: "CP", label: "CP" },
  { value: "CE1", label: "CE1" }, { value: "CE2", label: "CE2" },
  { value: "CM1", label: "CM1" }, { value: "CM2", label: "CM2" },
];

const MONTHS = [
  { value: "Septembre", trimester: 1 }, { value: "Octobre", trimester: 1 },
  { value: "Novembre", trimester: 1 }, { value: "Décembre", trimester: 1 },
  { value: "Janvier", trimester: 2 }, { value: "Février", trimester: 2 },
  { value: "Mars", trimester: 2 }, { value: "Avril", trimester: 3 },
  { value: "Mai", trimester: 3 }, { value: "Juin", trimester: 3 },
];

const TRIMESTER_COLORS: Record<number, string> = { 1: "bg-blue-500", 2: "bg-emerald-500", 3: "bg-amber-500" };
const TRIMESTER_LABELS: Record<number, string> = { 1: "1er Trim.", 2: "2e Trim.", 3: "3e Trim." };

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: BookOpen },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
};

// ─────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────

export function MonthlyPlanningTab({
  tenantId, academicYearId, teacherId,
  availableClasses, isDirector = false,
}: MonthlyPlanningTabProps) {
  const { currentLevel } = useAppSession();
  const { user } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoProposing, setAutoProposing] = useState(false);
  const [cells, setCells] = useState<MonthlyPlanCell[]>([]);
  const [hasExistingCustom, setHasExistingCustom] = useState(false);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [planStatus, setPlanStatus] = useState<"DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED">("DRAFT");
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [directorObservation, setDirectorObservation] = useState<string | null>(null);
  // ⭐ Signature canvas en local — pour signature titulaire (signée à la soumission)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const classesToShow = availableClasses && availableClasses.length > 0
    ? availableClasses : ALL_CLASSES;

  const [selectedClass, setSelectedClass] = useState<string>(classesToShow[0]?.value || "CI");
  const [selectedMonth, setSelectedMonth] = useState<string>("Septembre");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const trimester = MONTHS.find(m => m.value === selectedMonth)?.trimester || 1;
  const isMaternelle = selectedClass === "MATERNELLE_GRANDS";
  const showImmersionSheet = isImmersionClass(selectedClass) && isImmersionPeriod(selectedMonth);
  const showSystematicSheet = isImmersionClass(selectedClass) && !isImmersionPeriod(selectedMonth);

  // ⭐ Compute dynamic week date ranges
  const weekRanges = useMemo(
    () => computeWeekRangesForMonth(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  const ficheStructure = isMaternelle
    ? FICHE_MATERNELLE
    : showImmersionSheet ? FICHE_IMMERSION
    : showSystematicSheet ? FICHE_SYSTEMATIQUE
    : FICHE_STANDARD;

  // ⭐ La maternelle utilise 4 semaines, les autres 5 semaines
  const activeWeekLabels = isMaternelle ? WEEK_LABELS_MATERNELLE : WEEK_LABELS;
  const activeWeekRanges = isMaternelle ? weekRanges.slice(0, 4) : weekRanges;

  const sheetLabel = isMaternelle
    ? "Maternelle (5 domaines × 4 semaines)"
    : showImmersionSheet
      ? "Période d'immersion (T1 — Septembre → Décembre)"
      : showSystematicSheet
        ? "Période systématique (T2+T3 — Janvier → Juin)"
        : "Fiche standard (CE1 → CM2)";

  const isReadOnly = planStatus === "SUBMITTED" || planStatus === "VALIDATED";
  const StatusBadge = STATUS_BADGES[planStatus] || STATUS_BADGES.DRAFT;
  const StatusIcon = StatusBadge.icon;

  const autoProposeRef = useRef<() => Promise<void>>(async () => {});
  // ⭐ FIX ANOMALIE 3 : saveRef accepts an explicit cell list (overrideCells).
  //    Same fix as the FR MonthlyPlanningTab — after updateCellLocal() the
  //    old saveRef closure still captured the PREVIOUS state, so the POST
  //    /save went out WITHOUT the just-entered cell ("saved" shown, data lost).
  const saveRef = useRef<(overrideCells?: MonthlyPlanCell[]) => Promise<unknown>>(async () => {});
  // ⭐ FIX ANOMALIE 2 : anti-overwrite guard — while a cell is being edited,
  //    a load (even a silent one) must NEVER overwrite the local state.
  const editingCellKeyRef = useRef<string | null>(null);
  useEffect(() => { editingCellKeyRef.current = editingCellKey; }, [editingCellKey]);

  // ───────────────────────────────────────────────────────────────────
  // Auto-proposition
  // ───────────────────────────────────────────────────────────────────
  const autoPropose = useCallback(async () => {
    if (!academicYearId) return;
    setAutoProposing(true);
    try {
      const result = await pedagogyFetch<{ cells: MonthlyPlanCell[]; count: number }>(
        "/api/pedagogy/monthly-plans/auto-propose",
        { method: "POST", body: { academicYearId, classLevel: selectedClass, month: selectedMonth } }
      );
      if (result.cells.length === 0) {
        toast.info("Aucune planification annuelle disponible pour ce mois. Initialisez d'abord la planification annuelle.");
      } else {
        toast.success(`Proposition automatique : ${result.count} cellules importées`);
      }
      setCells(result.cells);
      setHasExistingCustom(false);
    } catch (e: any) {
      console.error("Auto-propose failed:", e);
      toast.error("Échec de l'auto-proposition: " + e.message);
    } finally {
      setAutoProposing(false);
    }
  }, [academicYearId, selectedClass, selectedMonth]);

  autoProposeRef.current = autoPropose;

  // ───────────────────────────────────────────────────────────────────
  // Load plan
  // ───────────────────────────────────────────────────────────────────
  // ⭐ silent=true : refresh WITHOUT flashing the loading spinner.
  //    ⭐ FIX ANOMALIE 3 : if a cell is being edited, local state is NOT replaced.
  const loadPlan = useCallback(async (silent = false) => {
    if (!academicYearId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const data = await pedagogyFetch<MonthlyPlanResponse>(
        `/api/pedagogy/monthly-plans?academicYearId=${academicYearId}&classLevel=${selectedClass}&month=${selectedMonth}&teacherId=${teacherId}`
      );
      // ⭐ Anti-overwrite guard: never replace state during an active edit
      if (editingCellKeyRef.current) return;
      if (data.cells.length === 0) {
        // ⭐ FIX: NEVER auto-propose in loadPlan. Auto-propose overwrites user edits
        //    every time the plan reloads (save → loadPlan → 0 cells → auto-propose → edits lost).
        //    Instead: show empty cells with templates. User clicks "Importer" button manually.
        setCells([]);
        setHasExistingCustom(false);
      } else {
        setCells(data.cells);
        setHasExistingCustom(data.hasExistingCustom);
      }
      // ⭐ Status + signatures
      setPlanStatus(data.status || "DRAFT");
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      setDirectorObservation(data.directorObservation || null);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("Failed to fetch monthly plans")) {
        console.warn("Table monthly_plans non disponible:", msg);
        setCells([]);
      } else {
        console.error("Failed to load monthly plan:", e);
        if (!silent) toast.error("Erreur lors du chargement: " + msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ⭐ FIX ANOMALIE 2 : the 30-second auto-refresh polling is REMOVED.
  //    Previously the whole grid re-rendered (spinner + table redraw) every
  //    30 seconds, preventing any stable work — especially on mobile.
  //    Refresh remains available via the manual button and after submit.

  // ───────────────────────────────────────────────────────────────────
  // Save
  // ───────────────────────────────────────────────────────────────────
  // ⭐ FIX ANOMALIE 3 : handleSave accepts an explicit list (overrideCells) —
  //    same fix as the FR tab: a just-created cell is saved with the UPDATED
  //    list, never with the stale previous state.
  const handleSave = useCallback(async (overrideCells?: MonthlyPlanCell[]) => {
    if (!academicYearId) return;
    const cellsToSave = overrideCells ?? cells;
    setSaving(true);
    try {
      await pedagogyFetch<{ saved: number; updated: number; skipped: number }>(
        "/api/pedagogy/monthly-plans/save",
        {
          method: "POST",
          body: {
            academicYearId, classLevel: selectedClass, month: selectedMonth, teacherId,
            schoolLevelId: currentLevel?.schoolLevelId || currentLevel?.id,
            cells: cellsToSave,
          },
        }
      );
      setHasExistingCustom(true);
      // ⭐ SILENT reload after a successful save — resynchronizes persisted ids
      //    without flashing a spinner and without overwriting an active edit.
      await loadPlan(true);
    } catch (e: any) {
      toast.error("Échec de la sauvegarde: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId, currentLevel, cells, loadPlan]);

  saveRef.current = handleSave;

  // ───────────────────────────────────────────────────────────────────
  // Submit to director (with signature)
  // ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!academicYearId || !pendingSignature) {
      toast.error("Signature du titulaire requise pour soumettre.");
      return;
    }
    // ⭐ Validate ALL required params BEFORE making the request
    if (!selectedClass || !selectedMonth) {
      toast.error("Classe et mois requis.");
      return;
    }
    setSubmitting(true);
    try {
      // ⭐ Save all cells BEFORE submitting (silently — no toast)
      await saveRef.current();

      // ⭐ Build URL with explicit validation
      const params = new URLSearchParams({
        academicYearId,
        classLevel: selectedClass,
        month: selectedMonth,
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
          || `Erreur ${res.status}`;
        throw new Error(msg);
      }
      // ⭐ Single success toast (not multiple)
      toast.success("Planification soumise au directeur");
      setShowSignatureModal(false);
      setPendingSignature(null);
      await loadPlan();
    } catch (e: any) {
      toast.error("Échec de la soumission: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId, pendingSignature, loadPlan]);

  // ───────────────────────────────────────────────────────────────────
  // Helpers d'édition
  // ───────────────────────────────────────────────────────────────────
  const findCell = (weekNumber: number, domain: string, subDomain?: string): MonthlyPlanCell | undefined => {
    return cells.find(c =>
      c.weekNumber === weekNumber &&
      c.domain === domain &&
      (c.subDomain || "") === (subDomain || "")
    );
  };

  const updateCellLocal = (weekNumber: number, domain: string, subDomain: string | undefined, content: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c =>
        c.weekNumber === weekNumber &&
        c.domain === domain &&
        (c.subDomain || "") === (subDomain || "")
      );
      if (idx === -1) {
        return [...prev, {
          weekNumber, domain, subDomain, content,
          activityType: null, activityNumber: null, sequenceNumber: null,
          isAutoProposed: false, isCustom: true,
        }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], content, isCustom: true, isAutoProposed: false };
      return next;
    });
  };

  const saveCellInline = async (cell: MonthlyPlanCell) => {
    if (!cell.id) {
      // ⭐ FIX ANOMALIE 3 (mobile path): apply the edited content to the list
      //    BEFORE saving, and pass the updated list to the bulk save.
      const idx = cells.findIndex(c =>
        c.weekNumber === cell.weekNumber && c.domain === cell.domain &&
        (c.subDomain || "") === (cell.subDomain || "")
      );
      const nextCells = idx === -1 ? cells : cells.map((c, i) =>
        i === idx ? { ...c, content: editContent, isCustom: true, isAutoProposed: false } : c
      );
      setCells(nextCells);
      await saveRef.current(nextCells);
      setEditingCellKey(null);
      return;
    }
    try {
      await pedagogyFetch(`/api/pedagogy/monthly-plans/${cell.id}`, {
        method: "PUT", body: { content: editContent },
      });
      toast.success("Cellule mise à jour");
      setEditingCellKey(null);
      updateCellLocal(cell.weekNumber, cell.domain, cell.subDomain, editContent);
    } catch (e: any) {
      toast.error("Échec: " + e.message);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Chargement de la planification mensuelle…</span>
      </div>
    );
  }

  // Render an editable cell (shared by desktop + mobile layouts)
  const renderCell = (weekNum: number, champCode: string, subRow: string | undefined, cellKey: string) => {
    const cell = findCell(weekNum, champCode, subRow || undefined);
    const isEditing = editingCellKey === cellKey;

    // ⭐ Get template text for this cell
    const champ = ficheStructure?.find(c => c.code === champCode);
    let template = "";
    if (champ) {
      if (subRow && champ.subRowTemplates && champ.subRowTemplates[subRow]) {
        template = champ.subRowTemplates[subRow];
      } else if (!subRow && champ.cellTemplate) {
        template = champ.cellTemplate;
      }
    }

    // ⭐ Save handler that works for BOTH existing cells AND new empty cells
    const handleSave = async () => {
      if (cell && cell.id) {
        // Existing cell — use PUT
        try {
          await pedagogyFetch(`/api/pedagogy/monthly-plans/${cell.id}`, {
            method: "PUT", body: { content: editContent },
          });
          toast.success("Cellule mise à jour");
        } catch (e: any) {
          toast.error("Échec: " + e.message);
        }
        return;
      }
      // ⭐ FIX ANOMALIE 3 (new cell): build the updated list LOCALLY and pass
      //    it explicitly to the bulk save — the old code called updateCellLocal()
      //    then saveRef.current() which captured the PREVIOUS state, so the
      //    entry was never persisted despite the success toast.
      const idx = cells.findIndex(c =>
        c.weekNumber === weekNum && c.domain === champCode &&
        (c.subDomain || "") === (subRow || "")
      );
      const nextCells = idx === -1
        ? [...cells, {
            weekNumber: weekNum, domain: champCode, subDomain: subRow || undefined,
            content: editContent, activityType: null, activityNumber: null,
            sequenceNumber: null, isAutoProposed: false, isCustom: true,
          }]
        : cells.map((c, i) => i === idx ? { ...c, content: editContent, isCustom: true, isAutoProposed: false } : c);
      setCells(nextCells);
      setEditingCellKey(null);
      toast.success("Cellule enregistrée");
      await saveRef.current(nextCells);
    };

    return (
      <td key={cellKey} className="p-1 border border-slate-200 align-top">
        {isEditing ? (
          // ⭐ Editing mode — use RichTextEditor (same as Cahier Journal)
          //    Bold/Italic/Underline via contentEditable + execCommand
          //    Content stored as HTML — persisted in DB, visible by director
          <div className="space-y-1">
            <RichTextEditor
              value={editContent}
              onChange={(html) => setEditContent(html)}
              minHeight="80px"
            />
            <div className="flex gap-0.5">
              <button onClick={handleSave} className="p-0.5 bg-emerald-600 text-white rounded" title="Enregistrer">
                <Check className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => setEditingCellKey(null)} className="p-0.5 bg-slate-200 rounded" title="Annuler">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        ) : cell ? (
          // ⭐ Existing cell — render HTML content (click to edit)
          <div
            className={cn(
              "text-[9px] leading-tight cursor-pointer p-1 rounded min-h-[60px]",
              cell.isCustom ? "bg-amber-50 text-amber-900 border border-amber-200"
                : cell.isAutoProposed ? "bg-purple-50 text-purple-900 border border-purple-100"
                : "text-slate-700"
            )}
            onClick={() => {
              if (isReadOnly) return;
              setEditingCellKey(cellKey);
              setEditContent(cell.content);
            }}
            title={cell.isCustom ? "Modifié" : cell.isAutoProposed ? "Auto-proposé" : "Contenu"}
            dangerouslySetInnerHTML={{ __html: cell.content }}
          />
        ) : (
          // ⭐ Empty cell — show template text as HTML (click to edit)
          <div
            onClick={() => {
              if (isReadOnly) return;
              setEditingCellKey(cellKey);
              setEditContent(template);
            }}
            className={cn(
              "text-[9px] leading-tight cursor-pointer p-1 rounded min-h-[60px]",
              isReadOnly ? "cursor-not-allowed text-slate-300" : "text-slate-500 hover:bg-purple-50 hover:text-purple-700 border border-dashed border-slate-200"
            )}
            title={isReadOnly ? "Planification verrouillée" : "Cliquer pour remplir"}
            dangerouslySetInnerHTML={isReadOnly ? undefined : { __html: template || "…" }}
          >
          </div>
        )}
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
              Planification mensuelle
              {/* ⭐ Badge de statut */}
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", StatusBadge.color)}>
                <StatusIcon className="h-3 w-3" /> {StatusBadge.label}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {classesToShow.find(c => c.value === selectedClass)?.label} — {selectedMonth} — {sheetLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {classesToShow.length > 1 ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white"
            >
              {classesToShow.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
              {classesToShow[0]?.label}
            </span>
          )}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.value}</option>
            ))}
          </select>
          {(
            <>
              <button
                onClick={autoPropose}
                disabled={autoProposing || isReadOnly}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
                title="Régénère la proposition depuis la planification annuelle"
              >
                {autoProposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Proposer
              </button>
              <button
                onClick={handleSave}
                disabled={saving || isReadOnly}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
              {/* ⭐ Bouton PDF — génère un PDF de la planification mensuelle */}
              <button
                onClick={async () => {
                  try {
                    toast.info("Génération du PDF en cours...");
                    const params = new URLSearchParams({
                      academicYearId: academicYearId || '',
                      classLevel: selectedClass,
                      month: selectedMonth,
                      teacherId: teacherId || '',
                    });
                    const res = await fetch(`/api/pedagogy/monthly-plans/export-pdf?${params.toString()}`, {
                      credentials: 'include',
                    });
                    if (!res.ok) throw new Error(`Erreur ${res.status}`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `planification_${selectedClass}_${selectedMonth}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success("PDF téléchargé");
                  } catch (e: any) {
                    toast.error("Échec PDF: " + e.message);
                  }
                }}
                disabled={saving || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
                title="Télécharger la planification en PDF"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              {/* ⭐ Bouton Soumettre (visible seulement si DRAFT) */}
              {planStatus === "DRAFT" && (
                <button
                  onClick={() => setShowSignatureModal(true)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Soumettre
                </button>
              )}
              <button
                onClick={() => loadPlan()}
                className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
                title="Rafraîchir"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bannière informative */}
      <div className={cn(
        "rounded-lg p-3 text-xs flex items-start gap-2",
        isMaternelle ? "bg-slate-100 border border-slate-300 text-slate-700"
          : showImmersionSheet ? "bg-blue-50 border border-blue-200 text-blue-700"
          : showSystematicSheet ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
          : "bg-amber-50 border border-amber-200 text-amber-700"
      )}>
        {isMaternelle ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : showImmersionSheet ? <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : showSystematicSheet ? <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0" />
          : <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <div>
          <strong>{sheetLabel}</strong>
          {showImmersionSheet && <span className="ml-2">— Fiche d'immersion CI/CP pour le 1er trimestre (accueil, exploration, initiation).</span>}
          {showSystematicSheet && <span className="ml-2">— Fiche systématique CI/CP pour les 2e et 3e trimestres (leçons structurées).</span>}
          {!isMaternelle && !showImmersionSheet && !showSystematicSheet && <span className="ml-2">— Fiche standard CE1-CM2.</span>}
          {isMaternelle && <span className="ml-2">— Planification des activités pédagogiques (5 domaines × 4 semaines).</span>}
          {/* ⭐ Message si soumis/validé */}
          {planStatus === "SUBMITTED" && (
            <div className="mt-1 text-blue-700 font-semibold">📋 Planification soumise au directeur — en attente de validation.</div>
          )}
          {planStatus === "VALIDATED" && (
            <div className="mt-1 text-emerald-700 font-semibold">✅ Planification validée par le directeur.</div>
          )}
          {planStatus === "REJECTED" && directorObservation && (
            <div className="mt-1 text-red-700">
              <strong>Rejetée :</strong> {directorObservation}
            </div>
          )}
        </div>
      </div>

      {/* ⭐ V3-6: TABLEAU (desktop + mobile) — rendered for ALL class levels including Maternelle */}
      {ficheStructure && (
        <>
          {/* ⭐ TABLEAU DESKTOP (md+) — scrollable horizontalement */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="text-xs border-collapse w-full" style={{ minWidth: isMaternelle ? '900px' : '1100px' }}>
              <colgroup>
                <col style={{ width: "15%" }} />
                {activeWeekLabels.map((_, i) => (
                  <col key={i} style={{ width: isMaternelle ? "21%" : "17%" }} />
                ))}
              </colgroup>
              <thead>
                {/* Ligne 1 : header semaines */}
                <tr className="bg-slate-700 text-white">
                  <th className="p-2 border border-slate-400 text-center" rowSpan={2} style={{ width: "15%" }}>
                    {isMaternelle ? "Domaines" : "Champ de Formation"}
                  </th>
                  {activeWeekLabels.map((wk, i) => (
                    <th key={wk} className="p-2 border border-slate-400 text-center">
                      {wk}
                    </th>
                  ))}
                </tr>
                {/* Ligne 2 : date ranges dynamiques */}
                <tr className="bg-slate-600 text-white text-[9px]">
                  {activeWeekRanges.map((range, i) => (
                    <th key={i} className="p-1 border border-slate-400 text-center font-medium whitespace-nowrap">
                      Du {formatDateFRShort(range.start)} au {formatDateFRShort(range.end)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ficheStructure.map(champ => {
                  const rows = champ.subRows.length > 0 ? champ.subRows : [null];
                  return rows.map((subRow, subIdx) => {
                    const cellKeyBase = `${selectedClass}|${selectedMonth}|${champ.code}|${subRow || ''}`;
                    return (
                      <tr key={`${champ.code}-${subIdx}`} className="hover:bg-purple-50/30">
                        {/* ⭐ Column 1 : DOMAINE / CHAMP DE FORMATION */}
                        <td
                          className={cn(
                            "p-2 border border-slate-300 align-middle",
                            subIdx === 0 ? cn(champ.color, "text-white text-center") : "bg-slate-50 text-slate-600 text-left pl-3"
                          )}
                          style={{ width: "15%" }}
                        >
                          {subIdx === 0 ? (
                            <div>
                              <div className="font-bold text-sm">{champ.label}</div>
                              {subRow && (
                                <div className="text-[10px] opacity-90 mt-0.5">{subRow}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] font-medium pl-4">↳ {subRow}</div>
                          )}
                        </td>
                        {activeWeekLabels.map((wk, weekIdx) => {
                          const cellKey = `${cellKeyBase}|${weekIdx + 1}`;
                          return renderCell(weekIdx + 1, champ.code, subRow || undefined, cellKey);
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* ⭐ MOBILE LAYOUT (sm et moins) — Layout en cartes empilées par semaine */}
          <div className="md:hidden space-y-4">
            {activeWeekRanges.map((range, weekIdx) => (
              <div key={weekIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* En-tête semaine + dates dynamiques */}
                <div className={cn("p-3 text-white font-bold", TRIMESTER_COLORS[trimester])}>
                  <div className="text-sm">{activeWeekLabels[weekIdx]}</div>
                  <div className="text-[10px] opacity-90 mt-0.5">
                    Du {formatDateFRShort(range.start)} au {formatDateFRShort(range.end)}
                  </div>
                </div>
                {/* Corps : un bloc par champ de formation */}
                <div className="divide-y divide-slate-100">
                  {ficheStructure.map(champ => {
                    const rows = champ.subRows.length > 0 ? champ.subRows : [null];
                    return (
                      <div key={champ.code} className="p-3">
                        {/* Titre du champ */}
                        <div className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-2", champ.color)}>
                          {champ.label}
                        </div>
                        {/* Sous-rows */}
                        <div className="space-y-2">
                          {rows.map((subRow, subIdx) => {
                            const cellKeyBase = `${selectedClass}|${selectedMonth}|${champ.code}|${subRow || ''}`;
                            const cellKey = `${cellKeyBase}|${weekIdx + 1}`;
                            const cell = findCell(weekIdx + 1, champ.code, subRow || undefined);
                            const isEditing = editingCellKey === cellKey;
                            return (
                              <div key={subIdx} className="border-l-2 border-slate-200 pl-2">
                                <div className="text-[10px] font-semibold text-slate-700 mb-0.5">
                                  {subRow || <span className="italic text-slate-400">{champ.label}</span>}
                                </div>
                                {cell && isEditing ? (
                                  <div className="space-y-1">
                                    <textarea
                                      value={editContent}
                                      onChange={e => setEditContent(e.target.value)}
                                      className="w-full px-1 py-0.5 border border-purple-300 rounded text-xs bg-white"
                                      rows={3}
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={() => saveCellInline(cell)} className="p-1 bg-emerald-600 text-white rounded text-xs">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingCellKey(null)} className="p-1 bg-slate-200 rounded text-xs">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ) : cell ? (
                                  <div
                                    className={cn(
                                      "text-xs leading-tight cursor-pointer p-2 rounded min-h-[40px]",
                                      cell.isCustom ? "bg-amber-50 text-amber-900 border border-amber-200"
                                        : cell.isAutoProposed ? "bg-purple-50 text-purple-900 border border-purple-100"
                                        : "text-slate-700 bg-slate-50"
                                    )}
                                    onClick={() => {
                                      if (isReadOnly) return;
                                      setEditingCellKey(cellKey);
                                      setEditContent(cell.content);
                                    }}
                                  >
                                    {cell.content}
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => {
                                      if (isReadOnly) return;
                                      setEditingCellKey(cellKey);
                                      let template = "";
                                      if (subRow && champ.subRowTemplates && champ.subRowTemplates[subRow]) {
                                        template = champ.subRowTemplates[subRow];
                                      } else if (!subRow && champ.cellTemplate) {
                                        template = champ.cellTemplate;
                                      }
                                      setEditContent(template);
                                    }}
                                    className={cn(
                                      "text-xs leading-tight cursor-pointer p-2 rounded min-h-[40px] whitespace-pre-wrap",
                                      isReadOnly
                                        ? "cursor-not-allowed text-slate-300"
                                        : "text-slate-500 hover:bg-purple-50 hover:text-purple-700 border border-dashed border-slate-200"
                                    )}
                                  >
                                    {isReadOnly ? "—" : (() => {
                                      let template = "";
                                      if (subRow && champ.subRowTemplates && champ.subRowTemplates[subRow]) {
                                        template = champ.subRowTemplates[subRow];
                                      } else if (!subRow && champ.cellTemplate) {
                                        template = champ.cellTemplate;
                                      }
                                      return template || "+ ajouter";
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ⭐ SECTION SIGNATURE (séparée du tableau, comme Cahier Journal) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Signatures et validation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Visa du Titulaire */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Visa du Titulaire</div>
                      <div className="text-xs text-slate-500">
                        {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Titulaire'} — Signature
                      </div>
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
                  ) : planStatus === "DRAFT" ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                      La signature sera demandée lors de la soumission au directeur.
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-xl p-2 h-[120px] flex items-center justify-center text-amber-600 text-xs font-medium">
                      {planStatus === "SUBMITTED" ? "Soumis — en attente de validation du directeur" : ""}
                      {planStatus === "VALIDATED" ? "Signé et validé" : ""}
                      {planStatus === "REJECTED" ? "Rejeté — à corriger et resoumettre" : ""}
                    </div>
                  )}
                </div>

                {/* Visa du Directeur */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Visa du Directeur</div>
                      <div className="text-xs text-slate-500">
                        {planStatus === "VALIDATED"
                          ? "Signature et cachet"
                          : "Signature disponible après validation"}
                      </div>
                    </div>
                    {planStatus === "VALIDATED" && directorSignature && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Signé
                      </span>
                    )}
                    {planStatus !== "VALIDATED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                        En attente
                      </span>
                    )}
                  </div>
                  {planStatus === "VALIDATED" && directorSignature ? (
                    <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                      <img src={directorSignature} alt="Signature Directeur" className="max-h-24 mx-auto" />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                      {planStatus === "SUBMITTED" ? "Cahier soumis — en attente de validation du directeur" : "La signature du directeur apparaîtra après validation"}
                    </div>
                  )}
                </div>
              </div>
            </div>
        </>
      )}

      {/* ⭐ MODAL SIGNATURE pour soumission */}
      {showSignatureModal && (
        <SignatureModal
          onCancel={() => { setShowSignatureModal(false); setPendingSignature(null); }}
          onConfirm={handleSubmit}
          onSign={(dataUrl) => setPendingSignature(dataUrl)}
          signature={pendingSignature}
          submitting={submitting}
          className={`${classesToShow.find(c => c.value === selectedClass)?.label || ''} — ${selectedMonth}`}
          month={selectedMonth}
          classLabel={classesToShow.find(c => c.value === selectedClass)?.label || ''}
        />
      )}

      {/* Légende */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-700">Légende :</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 bg-purple-50 border border-purple-100 rounded"></span>
            <span className="text-slate-600">Auto-proposé</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 bg-amber-50 border border-amber-200 rounded"></span>
            <span className="text-slate-600">Personnalisé</span>
          </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal Signature (simplifiée — utilisée pour la soumission au directeur)
// ─────────────────────────────────────────────────────────────────────────

function SignatureModal({
  onCancel, onConfirm, onSign, signature, submitting, className, month, classLabel,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  onSign: (dataUrl: string | null) => void;
  signature: string | null;
  submitting: boolean;
  className: string;
  month: string;
  classLabel: string;
}) {
  // ⭐ SignatureCanvas inline (simplified) — use a basic canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSign(null);
  };

  // Convert canvas to data URL
  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSign(dataUrl);
  };

  // Pointer events for canvas drawing
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

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDrawing(false);
    lastPoint.current = null;
    saveCanvas();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Signature du Titulaire</h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">
            En signant ci-dessous, vous confirmez que la planification mensuelle de
            <strong> {classLabel}</strong> pour le mois de <strong>{month}</strong> est complète
            et prête à être soumise au directeur pour validation.
          </div>
          {/* Canvas signature */}
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
              Effacer la signature
            </button>
            {signature && (
              <span className="text-xs text-emerald-600 font-semibold">✓ Signature capturée</span>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !signature}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Soumettre au directeur'}
          </button>
        </div>
      </div>
    </div>
  );
}
