"use client";

/**
 * ============================================================================
 * REGISTRE D'APPEL — Registre mensuel + Evaluation certificative + Relevés
 * ============================================================================
 *
 * Implémentation conforme au template officiel du registre d'appel mensuel
 * pour le primaire (maternelle/primaire).
 *
 * Structure :
 *   PAGE 1 — Registre d'appel mensuel
 *     - Tableau principal : 1 ligne par élève, 25 cases (5 semaines × 5 jours)
 *       + Motif des absences + Totaux (possibles, absences, effectif)
 *       + Observation + Namebre de demi-journées de classe
 *     - Section récapitulative bas : Demi-journée du mois, Présence possible,
 *       Total absences, Total présences effectives, % présences, % absences
 *     - Phrase d'arrêt : "Arrêté ce registre d'appel ce jour..."
 *       avec date, heure, effectif du jour (Girls/Boys)
 *     - Signatures : Directeur + Titulaire
 *
 *   PAGE 2 — Evaluation certificative mensuelle
 *     - En-tête : No. d'évaluation + mois + étape
 *     - Tableau : matières dynamiques × sous-colonnes CM (/18), CP (/2), Total
 *     - Section récapitulative : effectif total, ayant composé (G/F/Total),
 *       ayant atteint le seuil de réussite (G/F/Total), n'ayant pas atteint (G/F/Total),
 *       % de réussite (G/F/Total)
 *     - Signatures : Titulaire + Directeur
 *
 *   PAGE 3 — Tableau de relevés mensuels pour l'année scolaire
 *     - Synthèse annuelle : Sept → June × Renseignements généraux + Renseignements spéciaux
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList, Loader2, Save, RefreshCw, Send, Lock,
  FileText, BookOpen, BarChart3,
  CheckCircle2, XCircle, Clock, Settings, AlertCircle,
  X, CalendarCheck, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useMyClasses } from "@/lib/query/pedagogy-hooks";
import { MonthlyEvaluationTab } from "./MonthlyEvaluationTab";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModuleContext } from "@/hooks/useModuleContext";
import { exportAttendanceRegisterToPdf } from "@/lib/exports/pedagogy-exports";
import { translateClassName, translateLevelCode } from "@/lib/pedagogy/class-name-en";

interface AttendanceRegisterTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// ⭐ TOUS les 12 mois sont désormais disponibles (y compris July et August)
// pour permettre la saisie même pendant l'été (cours de rattrapage, etc.).
// Le mois courant est auto-sélectionné et verrouillé (voir selectedMonth state).
const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

const WEEKS = [1, 2, 3, 4, 5]; // 5 weeks per month
const DAYS = [
  { num: 1, label: "M" }, { num: 2, label: "T" }, { num: 3, label: "W" },
  { num: 4, label: "T" }, { num: 5, label: "F" },
]; // Monday to Friday (initials)

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validated", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ⭐ Calculer le nombre total de demi-jours d'un mois
// Monday=2, Tuesday=2, Wednesday=1, Thursday=2, Friday=2 (total/semaine=9)
// On parcourt tous les jours du mois et on somme les demi-jours.
// ⭐ Si des jours fériés sont spécifiés, on déduit leurs demi-jours du total.
function calculateDemiJourneesMois(month: number, year: number, holidays: string[] = []): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  const DEMI_JOURS: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2 };
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay(); // 0=dim, 1=lun, ..., 5=ven, 6=sam
    // Skip weekends (not counted)
    if (dow < 1 || dow > 5) continue;
    // ⭐ Vérifier si ce jour est un jour férié
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (holidays.includes(dateStr)) continue; // Skip holiday
    total += DEMI_JOURS[dow] || 0;
  }
  return total;
}

// ⭐ Calculer la date réelle pour une cellule (semaine, jour) du registre
// Retourne { date: Date | null, inMonth: boolean, dateStr: string }
// inMonth = false si le jour est hors du mois (à griser)
function getCellDate(week: number, dayNum: number, month: number, year: number): { date: Date | null; inMonth: boolean; dateStr: string } {
  // dayNum: 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi
  // Semaine 1 = commence au 1er du mois (même si c'est un mercredi)
  // On parcourt les jours du mois en groupes lundi-vendredi
  const daysInMonth = new Date(year, month, 0).getDate();
  let currentWeek = 1;
  let lastDow = -1;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();
    if (dow < 1 || dow > 5) continue; // Skip weekends
    if (lastDow === 5 && dow === 1) currentWeek++;
    if (currentWeek > 5) continue;
    if (currentWeek === week && dow === dayNum) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { date: d, inMonth: true, dateStr };
    }
    lastDow = dow;
  }
  // Si on n'a pas trouvé, c'est que cette cellule est hors du mois
  return { date: null, inMonth: false, dateStr: '' };
}

// ⭐ Calculer la plage de dates d'une semaine (pour l'en-tête)
function getWeekDateRanke(week: number, month: number, year: number): string {
  const days: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  let currentWeek = 1;
  let lastDow = -1;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();
    if (dow < 1 || dow > 5) continue;
    if (lastDow === 5 && dow === 1) currentWeek++;
    if (currentWeek > 5) continue;
    if (currentWeek === week) days.push(day);
    lastDow = dow;
  }
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  return `${first}/${String(month).padStart(2, '0')} → ${last}/${String(month).padStart(2, '0')}`;
}

function formatDateEN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Marqueurs d'absence possibles
const ABSENCE_MARKS = [
  { value: "", label: "Present", short: "" },
  { value: "A", label: "Absent", short: "A" },
  { value: "R", label: "Late", short: "R" },
  { value: "E", label: "Excused", short: "E" },
];

export function AttendanceRegisterTab({ tenantId, academicYearId, teacherId }: AttendanceRegisterTabProps) {
  const { user } = useAppSession();
  // ⭐ Contexte module (pour tenant + schoolLevel dans le PDF)
  const { tenant, schoolLevel } = useModuleContext();
  // ⭐ Names pour les signatures (auto-récupérés depuis la session)
  const teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  // Le nom du directeur sera récupéré depuis le tenant/settings
  const [directorName, setDirectorName] = useState<string>('');

  const [classes, setClasss] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  // ⭐ Mois et année SÉLECTIONNABLES (dégrisés) — par défaut sur le mois courant.
  // L'enseignant peut switcher vers un mois passé pour consulter un registre
  // précédent (ex: corriger une mauvaise saisie, ou vérifier les absences
  // d'un élève sur un mois antérieur).
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  const [register, setRegister] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  // ⭐ Signatures (comme dans le module RH — contrats)
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null); // null | 'pdf'
  const [showAppelModal, setShowAppelModal] = useState(false);
  const [appelDate, setAppelDate] = useState(new Date().toISOString().split("T")[0]);
  const [appelSaving, setAppelSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "evaluation" | "summary" | "settings">("register");
  // ⭐ Modal de confirmation professionnel (remplace window.confirm)
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();

  // ⭐ Days fériés du mois (paramétrables par l'enseignant)
  // Stockés sous forme de dates ISO (YYYY-MM-DD)
  const [holidays, setHolidays] = useState<string[]>([]);


  // === Loading des classes ===
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const { data: classesData = [] } = useMyClasses(teacherId, academicYearId);
  useEffect(() => {
    const list = Array.isArray(classesData) ? classesData : [];
    setClasss(list);
    if (list.length > 0 && !selectedClassId) {
      setSelectedClassId(list[0].classId);
    } else if (list.length === 0) {
      // ⭐ Pas de classes → arrêter le loading pour afficher "No class assigned"
      setLoading(false);
    }
  }, [classesData, selectedClassId]);

  // === Loading du registre ===
  const loadRegister = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      // ⭐ cache: 'no-store' pour éviter le stale read après une sauvegarde d'appel.
      //    Le backend syncAttendanceToRegister met à jour studentsData dans la table
      //    attendance_registers, mais si le BFF cache la réponse pendant 60s, le
      //    frontend ne verrait pas les changements immédiatement.
      const res = await fetch("/api/pedagogy-space/attendance-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          academicYearId, teacherId, classId: selectedClassId,
          month: selectedMonth, year: selectedYear,
        }),
      });
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setRegister(data);
      // ⭐ Charger les signatures + jours fériés existants depuis le registre
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      // holidays sont stockés dans le registre (champ JSON ou séparé)
      // Pour l'instant on les stocke dans un champ `holidays` du registre
      let loadedHolidays: string[] = [];
      if (data.holidays) {
        try {
          loadedHolidays = typeof data.holidays === 'string' ? JSON.parse(data.holidays) : data.holidays;
          if (!Array.isArray(loadedHolidays)) loadedHolidays = [];
        } catch { loadedHolidays = []; }
      }
      setHolidays(loadedHolidays);
      const studentsData = typeof data.studentsData === "string"
        ? JSON.parse(data.studentsData || "[]")
        : (data.studentsData || []);
      // Si pas d'élèves, on charge depuis la classe
      if (studentsData.length === 0) {
        const cls = classes.find(c => c.classId === selectedClassId);
        // ⭐ Calculer le nombre de demi-jours du mois (MÊME pour tous les élèves)
        // Monday=2, Tuesday=2, Wednesday=1, Thursday=2, Friday=2 (total/semaine=9)
        const totalDemiJourneesMois = calculateDemiJourneesMois(selectedMonth, selectedYear, holidays);
        const initStudents = (cls?.students || []).map((s: any, idx: number) => ({
          studentId: s.studentId,
          numero: idx + 1,
          nom: s.lastName || "",
          prenom: s.firstName || "",
          sexe: (s.gender || "").toUpperCase() === "FEMALE" ? "F" :
                (s.gender || "").toUpperCase() === "MALE" ? "M" : (s.gender || "M"),
          absences: [],
          motif: "",
          totalPresencesPossibles: totalDemiJourneesMois,
          totalAbsences: 0,
          totalPresenceHeadcount: totalDemiJourneesMois,
          observation: "",
          nbDemiJournees: totalDemiJourneesMois,
        }));
        setStudents(initStudents);
      } else {
        // ⭐ Mettre à jour le nbDemiJournees pour tous les élèves si vide
        const totalDemiJourneesMois = calculateDemiJourneesMois(selectedMonth, selectedYear, holidays);
        const updatedStudents = studentsData.map((s: any) => ({
          ...s,
          nbDemiJournees: s.nbDemiJournees || totalDemiJourneesMois,
          totalPresencesPossibles: s.totalPresencesPossibles || totalDemiJourneesMois,
        }));
        setStudents(updatedStudents);
      }
      // Charger l'évaluation associée
      const evalRes = await fetch("/api/pedagogy-space/monthly-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, classId: selectedClassId,
          attendanceRegisterId: data.id, month: selectedMonth, year: selectedYear,
        }),
      });
      if (evalRes.ok) setEvaluation(await evalRes.json());
      else setEvaluation(null);
      // Charger le tableau de relevés annuel
      const sumRes = await fetch(
        `/api/pedagogy-space/monthly-summaries?academicYearId=${academicYearId}&classId=${selectedClassId}`,
        { credentials: "include" }
      );
      if (sumRes.ok) setSummary(await sumRes.json());
      else setSummary(null);
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, selectedClassId, selectedMonth, selectedYear, classes]);

  useEffect(() => {
    if (selectedClassId) loadRegister();
  }, [loadRegister, selectedClassId]);

  // ⭐ Écouter l'event 'attendance:saved' émis par AttendanceTab (onglet Appels)
  //    et par AppelModal (modal d'appel dans Registre) pour recharger automatiquement
  //    le tableau du registre. Sans ça, l'enseignant doit manuellement changer de
  //    mois ou recharger la page pour voir les absences apparaître.
  useEffect(() => {
    const handleAttendanceSaved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Recharger si l'appel concerne la même classe + année
      if (detail?.classId === selectedClassId && detail?.academicYearId === academicYearId) {
        // ⭐ Petit délai (300ms) pour laisser le backend syncAttendanceToRegister
        //    terminer la mise à jour de studentsData avant qu'on recharge.
        setTimeout(() => loadRegister(), 300);
      }
    };
    window.addEventListener('attendance:saved', handleAttendanceSaved);
    return () => window.removeEventListener('attendance:saved', handleAttendanceSaved);
  }, [loadRegister, selectedClassId, academicYearId]);

  // ⭐ Charger le nom du directeur depuis les settings/identity de l'école
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

  // ⭐ Quand les jours fériés changent, recalculer totalPresencesPossibles
  // et totalPresenceHeadcount pour TOUS les élèves.
  // Le nombre de demi-jours du mois change quand on ajoute/retire des jours fériés,
  // donc totalPresencesPossibles doit être mis à jour pour chaque élève.
  useEffect(() => {
    if (students.length === 0) return;
    const newDemiJournees = calculateDemiJourneesMois(selectedMonth, selectedYear, holidays);
    setStudents(prev => prev.map(s => {
      const totalAbsences = (s.absences || []).reduce((sum: number, a: any) => {
        if (a.marked === "+") return sum + 2;
        if (a.marked === "-" || a.marked === "|") return sum + 1;
        return sum;
      }, 0);
      return {
        ...s,
        nbDemiJournees: newDemiJournees,
        totalPresencesPossibles: newDemiJournees,
        totalPresenceHeadcount: newDemiJournees - totalAbsences,
      };
    }));
  }, [holidays, selectedMonth, selectedYear]);

  // === Mise à jour d'une case d'absence ===
  // ⭐ FIX CRITIQUE : utiliser studentId (pas idx) pour identifier l'élève.
  // Avant : on utilisait studentIdx (index du tableau TRIÉ) mais setStudents
  // utilisait l'index du tableau ORIGINAL → mauvais élève mis à jour !
  const updateAbsence = (studentId: string, week: number, day: number, marked: string) => {
    setStudents(prev => prev.map((s) => {
      if (s.studentId !== studentId) return s;
      const newAbsences = [...(s.absences || [])];
      // Trouver ou créer l'entrée pour (week, day)
      const existingIdx = newAbsences.findIndex(a => a.week === week && a.day === day);
      if (marked === "") {
        // Si on efface la marque, retirer l'entrée
        if (existingIdx >= 0) newAbsences.splice(existingIdx, 1);
      } else if (existingIdx >= 0) {
        newAbsences[existingIdx] = { week, day, marked };
      } else {
        newAbsences.push({ week, day, marked });
      }

      // ⭐ Recalculer les totaux selon le système demi-jours :
      //   "-" = absent matin → 1 absence
      //   "|" = absent après-midi → 1 absence
      //   "+" = absent toute la journée → 2 absences
      let totalAbsences = 0;
      for (const a of newAbsences) {
        if (a.marked === "+") totalAbsences += 2;
        else if (a.marked === "-" || a.marked === "|") totalAbsences += 1;
      }

      // nbDemiJournees = nombre de demi-jours du mois (MÊME pour tous les élèves)
      const demiJournees = s.nbDemiJournees || 0;
      const totalPresencesPossibles = demiJournees;
      const totalPresenceHeadcount = totalPresencesPossibles - totalAbsences;
      return {
        ...s,
        absences: newAbsences,
        totalAbsences,
        totalPresencesPossibles,
        totalPresenceHeadcount,
      };
    }));
  };

  const getAbsence = (student: any, week: number, day: number): string => {
    const a = (student.absences || []).find((x: any) => x.week === week && x.day === day);
    return a?.marked || "";
  };

  // === Sauvegarde ===
  const handleSave = async () => {
    if (!register) return;
    setSaving(true);
    try {
      // Recalculer les stats globales
      const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
      const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
      const totalEff = students.reduce((sum, s) => sum + (s.totalPresenceHeadcount || 0), 0);
      const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
      const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;

      const res = await fetch(`/api/pedagogy-space/attendance-registers/${register.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentsData: students,
          demiJourneeMois: register.demiJourneeMois || 0,
          presencePossibleMois: totalPoss,
          totalAbsencesMois: totalAbs,
          totalPresencesEffectivesMois: totalEff,
          pourcentagePresences: pctP,
          pourcentageAbsences: pctA,
          // ⭐ Signatures (comme dans le module RH — contrats)
          teacherSignature: teacherSignature,
          directorSignature: directorSignature,
          // ⭐ Days fériés du mois (stockés dans le registre)
          holidays: holidays,
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("✅ Register saved", {
        description: "Changes have been saved. The status remains 'Draft' until submission to the director.",
      });
      // ⭐ Reload the register to update the display
      await loadRegister();
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ L'ancien handleSubmit a été remplacé par handleUnifiedSubmit (soumission
  //    unifiée : registre + évaluation mensuelle + cahier journal en une fois).










  // ⭐ Soumission UNIFIÉE — soumet registre + évaluation mensuelle + cahier journal
  //    en une seule transaction via POST /pedagogy-space/submit-unified
  //    Le backend notifie automatiquement le directeur (email + WhatsApp + SMS).
  const [submittingUnified, setSubmittingUnified] = useState(false);
  const [notifyingDirector, setNotifyingDirector] = useState(false);
  const handleUnifiedSubmit = async () => {
    if (!register || !selectedClassId) return;
    // ⭐ Professional modal
    const ok = await confirmWarning(
      `Do you want to submit to the director?`,
      'Unified submission',
      `Class: ${selectedClass?.className || '—'}\n` +
      `Month: ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n\n` +
      `This action submits in one go:\n` +
      `• The attendance register\n` +
      `• The monthly evaluation\n\n` +
      `This action is irreversible. The director will be notified automatically.\n` +
      `(The journal notebook is submitted separately from its dedicated tab.)`
    );
    if (!ok) return;
    setSubmittingUnified(true);
    try {
      const res = await fetch('/api/pedagogy-space/submit-unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          academicYearId,
          teacherId,
          classId: selectedClassId,
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      toast.success('✅ Submission successful', {
        description: `The director has been notified by email, WhatsApp and SMS.`,
      });
      // ⭐ Reload the register to update the status (DRAFT → SUBMITTED)
      await loadRegister();
    } catch (e: any) {
      toast.error('Submission error', { description: e.message });
    } finally {
      setSubmittingUnified(false);
    }
  };

  // ⭐ Notifier manuellement le directeur (relance email + WhatsApp + SMS)
  //    Visible même après soumission (permet de relancer le directeur).
  const handleNotifyDirector = async () => {
    if (!register || !selectedClassId) return;
    const ok = await confirmWarning(
      `Notify the director?`,
      'Manual notification',
      `The director will receive a notification by:\n` +
      `• Email\n` +
      `• WhatsApp\n` +
      `• SMS\n\n` +
      `Class: ${selectedClass?.className || '—'}\n` +
      `Month: ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
    );
    if (!ok) return;
    setNotifyingDirector(true);
    try {
      const res = await fetch('/api/pedagogy-space/notify-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId: selectedClassId,
          month: selectedMonth,
          year: selectedYear,
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
  };

  // === Maj du registre : motif, observation ===
  // ⭐ FIX : utiliser studentId (pas idx) — même raison que updateAbsence
  const updateStudentField = (studentId: string, field: string, value: any) => {
    setStudents(prev => prev.map((s) => {
      if (s.studentId !== studentId) return s;
      const updated = { ...s, [field]: value };
      return updated;
    }));
  };

  const updateRegisterField = (field: string, value: any) => {
    setRegister({ ...register, [field]: value });
  };

  const refreshSummary = async () => {
    if (!selectedClassId) return;
    try {
      const res = await fetch("/api/pedagogy-space/monthly-summaries/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academicYearId, classId: selectedClassId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data);
      toast.success("✅ Summary table refreshed");
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    }
  };

  const selectedClass = classes.find(c => c.classId === selectedClassId);
  const statusConfig = register ? STATUS_CONFIG[register.status as keyof typeof STATUS_CONFIG] : null;
  const isReadOnly = register && (register.status === "SUBMITTED" || register.status === "VALIDATED");

  const monthlyData: any[] = summary
    ? (typeof summary.monthlyData === "string"
        ? JSON.parse(summary.monthlyData)
        : (summary.monthlyData || []))
    : [];

  // ⭐ Calculs pour l'affichage du récapitulatif
  // totalAbs = somme des absences de TOUS les élèves (colonne absences)
  // totalPoss = somme des présences possibles de TOUS les élèves (colonne) = demi-jours × nb élèves
  // totalEff = totalPoss - totalAbs (somme de la colonne présence effective)
  // ⭐ demiJourneeMois = nombre de demi-jours du mois (SANS multiplication par élèves)
  const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
  const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
  const totalEff = totalPoss - totalAbs;
  const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
  const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;
  // ⭐ demi-jours du mois = valeur individuelle (pas × nb élèves)
  const demiJourneeMois = calculateDemiJourneesMois(selectedMonth, selectedYear, holidays);

  // ⭐ Export PDF professionnel (même template que module Finance)
  //    Utilise jsPDF + autotable + drawOfficialHeader (drapeau Bénin + République
  //    + Ministère + école + logo) + drawFooter + pagination automatique.
  const handleExport = async (format: "pdf") => {
    if (!register || exporting) return;
    setExporting(format);
    try {
      // ⭐ Header école (même structure que module Finance)
      const header = {
        schoolName: tenant?.name || 'School establishment',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
        schoolLevel: schoolLevel?.code || (register.schoolLevelCode as string) || 'PRIMAIRE',
      };

      // ⭐ Stats récapitulatives
      const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
      const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
      const totalEff = students.reduce((sum, s) => sum + (s.totalPresenceHeadcount || 0), 0);
      const recap = {
        demiJourneeMois,
        totalEleves: students.length,
        totalPresencesPossibles: totalPoss,
        totalAbsences: totalAbs,
        totalPresencesEffectives: totalEff,
        pourcentagePresences: totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0,
        pourcentageAbsences: totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0,
      };

      // ⭐ Lignes d'élèves au format attendu par le PDF
      const studentRows = students.map((s: any, idx: number) => ({
        numero: s.numero || idx + 1,
        nom: s.nom || '',
        prenom: s.prenom || '',
        sexe: s.sexe || 'M',
        absences: s.absences || [],
        motif: s.motif || '',
        totalPresencesPossibles: s.totalPresencesPossibles || 0,
        totalAbsences: s.totalAbsences || 0,
        totalPresenceHeadcount: s.totalPresenceHeadcount || 0,
        observation: s.observation || '',
      }));

      const boysCount = students.filter((s: any) => (s.sexe || '').toUpperCase() === 'M').length;
      const girlsCount = students.filter((s: any) => (s.sexe || '').toUpperCase() === 'F').length;

      await exportAttendanceRegisterToPdf({
        header,
        className: selectedClass?.className || '',
        monthLabel: MONTH_NAMES[selectedMonth],
        year: selectedYear,
        students: studentRows,
        recap,
        signatures: {
          teacherName,
          directorName,
          teacherSignature,
          directorSignature,
        },
        holidays,
        boysCount,
        girlsCount,
      });

      toast.success('✅ PDF exported with official header');
    } catch (e: any) {
      console.error('PDF export error:', e);
      toast.error("Export error", { description: e.message });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* === Header: class + month + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</label>
          <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
            disabled={loading}>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {translateClassName(c.className) || c.classId} ({c.totalStudents || 0} students)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold min-w-[150px] text-slate-700 flex items-center gap-2 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold w-[110px] text-slate-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
          >
            {/* ⭐ Year list: current year -2 to +1 (allows consultation of past registers) */}
            {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {statusConfig && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide", statusConfig.color)}>
            <statusConfig.icon className="h-4 w-4" />
            {statusConfig.label}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* ⭐ Attendance button — opens a modal to mark presences/absences */}
          {activeTab === "register" && register && (
            <button onClick={() => setShowAppelModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
              <CalendarCheck className="h-4 w-4" />
              Take attendance
            </button>
          )}
          {/* ⭐ Save button — always active (except loading/saving/!register)
              to allow saving while waiting for submission to the director */}
          <button onClick={handleSave} disabled={saving || loading || !register}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          {/* ⭐ Unified submit button — submits register + monthly evaluation + journal notebook
              in a single transaction, then automatically notifies the director
              (email + WhatsApp + SMS) */}
          <button onClick={handleUnifiedSubmit} disabled={loading || !register || register?.status !== "DRAFT" || submittingUnified}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {submittingUnified ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submittingUnified ? 'Submitting...' : 'Submit to director'}
          </button>
          {/* ⭐ Notify director button — relaunch email/WhatsApp/SMS (visible even after submission) */}
          <button onClick={handleNotifyDirector} disabled={notifyingDirector || !register}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            title="Notify the director by email, WhatsApp and SMS">
            {notifyingDirector ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Notify
          </button>
          {/* ⭐ PDF Export button only (Excel removed) */}
          {register && (
            <button onClick={() => handleExport("pdf")} disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* === Sub-tabs: Register / Evaluation / Summary / Settings === */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
        <button onClick={() => setActiveTab("register")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "register" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <ClipboardList className="h-4 w-4" />
          Attendance Register
        </button>
        <button onClick={() => setActiveTab("evaluation")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "evaluation" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <FileText className="h-4 w-4" />
          Monthly Evaluation
        </button>
        <button onClick={() => setActiveTab("summary")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "summary" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <BarChart3 className="h-4 w-4" />
          Annual Summary Table
        </button>
        <button onClick={() => setActiveTab("settings")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "settings" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>

      {/* === PAGE 1 — Attendance Register === */}
      {activeTab === "register" && register && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          {/* Header */}
          <div className="text-center border-b border-slate-300 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              ATTENDANCE REGISTER{register.schoolLevelCode === "MATERNELLE" ? " — NURSERY" : register.schoolLevelCode === "PRIMAIRE" ? "" : ` ${translateLevelCode(register.schoolLevelCode)}`}
            </h2>
            <div className="text-sm text-slate-600 mt-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Month of <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear}</span>
                <span className="text-slate-300">|</span>
                <span>Number of half-days: <strong className="text-blue-600">{demiJourneeMois}</strong></span>
              </div>
              <div className="text-slate-700">
                Class: <strong>{translateClassName(register.classNameResolved) || translateClassName(selectedClass?.className) || "—"}</strong> — Headcount: {selectedClass?.totalStudents || 0} students
                ({selectedClass?.boys || 0} B, {selectedClass?.girls || 0} G)
              </div>
            </div>
          </div>

          {/* Main table: 1 student = 1 row */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: "1600px" }}>
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">No.</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Full name</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Gender</th>
                  <th colSpan={25} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">
                    Absence indication for each class day (5 weeks × 5 days)
                  </th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "120px" }}>Absence reason</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total possible presences</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total absences</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total actual presence</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "100px" }}>Observation</th>
                </tr>
                <tr className="bg-slate-50">
                  {/* ⭐ Widen day sub-columns: from px-1 to px-2,
                      minWidth 45px per cell (instead of default ~28px).
                      Allows seeing marks (-, |, +) clearly. */}
                  {WEEKS.map(w => {
                    const range = getWeekDateRanke(w, selectedMonth, selectedYear);
                    return (
                      <th key={w} colSpan={5} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] uppercase" style={{ minWidth: "225px" }}>
                        W{w} {range && <span className="font-normal text-slate-400 normal-case text-[9px] block">{range}</span>}
                      </th>
                    );
                  })}
                </tr>
                {/* ⭐ Row of day initials (M T W T F) with dates for each week */}
                <tr className="bg-slate-50">
                  {WEEKS.map(w => DAYS.map(d => {
                    const cell = getCellDate(w, d.num, selectedMonth, selectedYear);
                    return (
                      <th key={`${w}-${d.num}`} className={cn(
                        "border border-slate-300 px-1 py-1 font-bold text-[10px] uppercase",
                        cell.inMonth ? "text-slate-500" : "text-slate-300 bg-slate-100"
                      )} style={{ minWidth: "45px", width: "45px" }}>
                        {d.label}
                        {cell.inMonth && cell.date && (
                          <div className="text-[8px] font-normal text-slate-400">{cell.date.getDate()}</div>
                        )}
                      </th>
                    );
                  }))}
                </tr>
              </thead>
              <tbody>
                {[...students].sort((a, b) => {
                  const aName = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
                  const bName = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
                  return aName.localeCompare(bName, 'en');
                }).map((student, idx) => (
                  <tr key={student.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                    {/* ⭐ Sequential No. after alphabetical sort (1, 2, 3...) */}
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-medium">
                      {student.nom} {student.prenom}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                    {/* 25 absence cells — half-day system: -, |, + */}
                    {WEEKS.map(w => DAYS.map(d => {
                      const marked = getAbsence(student, w, d.num);
                      const cell = getCellDate(w, d.num, selectedMonth, selectedYear);
                      // ⭐ Grey out cells outside the month
                      if (!cell.inMonth) {
                        return (
                          <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-slate-100" style={{ minWidth: "45px", width: "45px" }}>
                            <div className="w-full h-9 flex items-center justify-center text-slate-300 text-xs">—</div>
                          </td>
                        );
                      }
                      // ⭐ If public holiday → emoji 🎉 in read-only
                      const isHoliday = holidays.includes(cell.dateStr);
                      if (isHoliday) {
                        return (
                          <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-red-50" style={{ minWidth: "45px", width: "45px" }}>
                            <div className="w-full h-9 flex items-center justify-center text-base" title="Public holiday">🎉</div>
                          </td>
                        );
                      }
                      return (
                        <td key={`${w}-${d.num}`} className="border border-slate-300 p-0" style={{ minWidth: "45px", width: "45px" }}>
                          {/* ⭐ Read-only display: only the symbol is shown, no select/arrow */}
                          <div className={cn(
                            "w-full h-9 flex items-center justify-center text-base font-bold",
                            marked === "-" && "bg-amber-100 text-amber-700",
                            marked === "|" && "bg-amber-100 text-amber-700",
                            marked === "+" && "bg-red-100 text-red-700",
                            !marked && "bg-transparent text-slate-300"
                          )}>
                            {marked === "-" ? "−" : marked === "|" ? "│" : marked === "+" ? "+" : "·"}
                          </div>
                        </td>
                      );
                    }))}
                    <td className="border border-slate-300 p-0">
                      <input type="text" value={student.motif || ""}
                        onChange={(e) => updateStudentField(student.studentId, "motif", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-1 py-1 text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold bg-slate-50">{student.totalPresencesPossibles || 0}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-red-600">{student.totalAbsences || 0}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-600">{student.totalPresenceHeadcount || 0}</td>
                    <td className="border border-slate-300 p-0">
                      <input type="text" value={student.observation || ""}
                        onChange={(e) => updateStudentField(student.studentId, "observation", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-1 py-1 text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={33} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">
                      No students enrolled in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ⭐ Public holidays section (dynamic under the table) */}
          {holidays.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <div className="text-xs font-bold text-red-700 uppercase flex items-center gap-1">
                <span>🎉</span> Public holidays of the month
              </div>
              <div className="flex flex-wrap gap-2">
                {holidays.map(h => (
                  <span key={h} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-red-200 rounded text-xs text-red-700">
                    🎉 {formatDateEN(h)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* === Symbol legend === */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-bold text-slate-600 uppercase mb-2">Legend</div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-transparent text-slate-400 font-bold rounded">·</span> Present</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-700 font-bold rounded">−</span> Absent morning (1 half-day)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-700 font-bold rounded">│</span> Absent afternoon (1 half-day)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 font-bold rounded">+</span> Absent all day (2 half-days)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-400 font-bold rounded">—</span> Out of month</span>
              <span className="flex items-center gap-1"><span className="text-base">🎉</span> Public holiday</span>
            </div>
          </div>

          {/* === Summary section (bottom of register) === */}
          <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">
              Monthly summary — {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Half-days of the month</label>
                {/* ⭐ Auto-calculated (read-only): number of half-days of the month, WITHOUT × number of students */}
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold bg-slate-100 text-slate-700">{demiJourneeMois}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Possible presence</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold bg-white">{totalPoss}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total absences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-red-600 bg-white">{totalAbs}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total actual presences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-emerald-600 bg-white">{totalEff}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">% presences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-emerald-700 bg-emerald-50">{pctP}%</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">% absences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-red-700 bg-red-50">{pctA}%</div>
              </div>
            </div>
          </div>

          {/* === Closing statement === */}
          <div className="border border-slate-300 rounded-lg p-4 bg-amber-50/30">
            <p className="text-sm font-medium text-slate-800 mb-3">
              Closed this attendance register this day:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Closing date</label>
                <input type="date" value={register.arreteDate ? formatDateEN(register.arreteDate) : ""}
                  onChange={(e) => updateRegisterField("arreteDate", e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                <input type="time" value={register.arreteHeure || ""}
                  onChange={(e) => updateRegisterField("arreteHeure", e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Girls headcount of the day</label>
                <input type="number" min={0} value={register.effectifJourGirls || 0}
                  onChange={(e) => updateRegisterField("effectifJourGirls", parseInt(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Boys headcount of the day</label>
                <input type="number" min={0} value={register.effectifJourGarcons || 0}
                  onChange={(e) => updateRegisterField("effectifJourGarcons", parseInt(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
            </div>
          </div>

          {/* === Signatures (as in the HR module — contracts) === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            {/* Director signature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">The Director</div>
                  <div className="text-xs text-slate-500">{directorName || 'Director\'s name'} — Signature and stamp</div>
                </div>
                {directorSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signed
                  </span>
                )}
              </div>
              {directorSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={directorSignature} alt="Director signature" className="max-h-32 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={140}
                  disabled={isReadOnly}
                  placeholder="Director's signature"
                  onSignatureChange={(data) => setDirectorSignature(data)}
                />
              )}
              {directorSignature && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setDirectorSignature(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear signature
                </button>
              )}
            </div>

            {/* Class teacher signature */}
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
                  <img src={teacherSignature} alt="Teacher signature" className="max-h-32 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={140}
                  disabled={isReadOnly}
                  placeholder="Teacher's signature"
                  onSignatureChange={(data) => setTeacherSignature(data)}
                />
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
          </div>
        </div>
      )}

      {/* === PAGE 2 — Evaluation mensuelle (dynamic from Module Examen) === */}
      {activeTab === "evaluation" && selectedClassId && (
        <MonthlyEvaluationTab
          tenantId={tenantId}
          academicYearId={academicYearId}
          teacherId={teacherId}
          classId={selectedClassId}
          className={selectedClass?.className || ''}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          teacherName={teacherName}
          directorName={directorName}
          isMaternelle={(register?.schoolLevelCode || '').toUpperCase() === 'MATERNELLE'}
          isReadOnly={!!isReadOnly}
        />
      )}

      {/* === PAGE 3 — Annual monthly summary table === */}
      {activeTab === "summary" && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ANNUAL MONTHLY SUMMARY TABLE
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Class: <strong>{translateClassName(selectedClass?.className) || "—"}</strong>
              </p>
            </div>
            <button onClick={refreshSummary}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: "1400px" }}>
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Month</th>
                  <th colSpan={6} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-blue-50">
                    GENERAL INFORMATION
                  </th>
                  <th colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-amber-50">
                    SPECIAL INFORMATION
                  </th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "150px" }}>Observations</th>
                </tr>
                <tr className="bg-slate-50 text-[10px]">
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Class half-days</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total students attended</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total possible presences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total absences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Number of presences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">% actual presences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Students never absent / ≤ 4 classes</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Students absent &gt; 4 classes</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total attributable absences</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map(m => {
                  const data = monthlyData.find(d => d.month === m.value);
                  return (
                    <tr key={m.value} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase">{m.label}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.demiDaysClass ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.totalElevesFrequentes ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.totalPresencesPossibles ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center text-red-600">{data?.totalAbsences ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center text-emerald-600">{data?.nombrePresences ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center font-bold text-emerald-700">{data?.pourcentagePresences !== undefined ? `${data.pourcentagePresences}%` : "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.nombreElevesJamaisManque ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.nombreElevesManquePlusDe4 ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.totalAbsencesImputables ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-2 text-[10px] text-slate-500">{data?.observations || "—"}</td>
                    </tr>
                  );
                })}
                {/* General average row */}
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 px-2 py-2 uppercase">General average</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.length > 0 ? (monthlyData.reduce((s, d) => s + (d.demiDaysClass || 0), 0) / monthlyData.length).toFixed(1) : "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.length > 0 ? (monthlyData.reduce((s, d) => s + (d.totalElevesFrequentes || 0), 0) / monthlyData.length).toFixed(0) : "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.reduce((s, d) => s + (d.totalPresencesPossibles || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-red-600">{monthlyData.reduce((s, d) => s + (d.totalAbsences || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-emerald-600">{monthlyData.reduce((s, d) => s + (d.nombrePresences || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center text-emerald-700">
                    {monthlyData.length > 0 ? (monthlyData.reduce((s, d) => s + (d.pourcentagePresences || 0), 0) / monthlyData.length).toFixed(2) : "—"}%
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.reduce((s, d) => s + (d.nombreElevesJamaisManque || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.reduce((s, d) => s + (d.nombreElevesManquePlusDe4 || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.reduce((s, d) => s + (d.totalAbsencesImputables || 0), 0) || "—"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-[10px] text-slate-500">Annual totals</td>
                </tr>
              </tbody>
            </table>
          </div>

          {monthlyData.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-6 italic">
              No monthly data available. Click "Refresh" to recalculate from existing attendance registers.
            </div>
          )}
        </div>
      )}

      {/* === PAGE 4 — Settings (public holidays) === */}
      {activeTab === "settings" && register && (
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-900">Month settings</h2>
            <p className="text-sm text-slate-500">
              {MONTH_NAMES[selectedMonth]} {selectedYear} — Public holidays configuration
            </p>
          </div>

          {/* === Public holidays === */}
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Settings className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-800">
                <strong>Public holidays:</strong> Specify the public holidays of the month.
                Each public holiday deducts its half-days from the total (Monday/Tuesday/Thursday/Friday = 2 half-days,
                Wednesday = 1 half-day). The total half-days is updated automatically.
              </div>
            </div>

            {/* List of month days (Monday-Friday only) */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">Working days of the month:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {(() => {
                  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const items = [];
                  for (let day = 1; day <= daysInMonth; day++) {
                    const d = new Date(selectedYear, selectedMonth - 1, day);
                    const dow = d.getDay();
                    if (dow < 1 || dow > 5) continue; // Skip weekends
                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isHoliday = holidays.includes(dateStr);
                    items.push(
                      <button
                        key={dateStr}
                        onClick={() => {
                          if (isHoliday) {
                            setHolidays(holidays.filter(h => h !== dateStr));
                          } else {
                            setHolidays([...holidays, dateStr]);
                          }
                        }}
                        className={cn(
                          "p-2 rounded-lg border text-xs font-medium transition-all",
                          isHoliday
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                        )}
                      >
                        <div className="font-bold">{dayNames[dow]} {day}</div>
                        <div className="text-[10px]">
                          {isHoliday ? "🎉 Holiday" : `${dow === 3 ? 1 : 2} hd`}
                        </div>
                      </button>
                    );
                  }
                  return items;
                })()}
              </div>
            </div>

            {/* Half-days summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Raw half-days (all working days):</span>
                <span className="font-bold text-slate-900">{calculateDemiJourneesMois(selectedMonth, selectedYear, [])}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Declared public holidays:</span>
                <span className="font-bold text-red-600">{holidays.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Deducted half-days (public holidays):</span>
                <span className="font-bold text-red-600">
                  {calculateDemiJourneesMois(selectedMonth, selectedYear, []) - calculateDemiJourneesMois(selectedMonth, selectedYear, holidays)}
                </span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Total half-days of the month:</span>
                <span className="text-lg font-bold text-blue-600">{calculateDemiJourneesMois(selectedMonth, selectedYear, holidays)}</span>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || isReadOnly}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save settings
            </button>
          </div>
        </div>
      )}

      {/* === MODAL APPEL (marquage présences/absences depuis le registre) === */}
      {showAppelModal && register && (
        <AppelModal
          register={register}
          selectedClassId={selectedClassId}
          academicYearId={academicYearId}
          schoolLevelId={selectedClass?.schoolLevelId || ''}
          teacherId={teacherId}
          appelDate={appelDate}
          setAppelDate={setAppelDate}
          onClose={() => setShowAppelModal(false)}
          onSaved={() => { loadRegister(); }}
        />
      )}

      {/* === States === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {!loading && !selectedClassId && classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">No class assigned</p>
          <p className="text-sm text-slate-500 mt-1">You have no class assigned for this year.</p>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          This register is locked (status: {register?.status}).
        </div>
      )}
      {/* ⭐ Modal de confirmation professionnel (remplace window.confirm) */}
      {confirmDialog}
    </div>
  );
}

// ============================================================================
// MODAL APPEL — Marquage des présences/absences depuis le registre d'appel
// ============================================================================
// Affiche la liste des élèves avec 4 boutons (PM/AM/PS/AS) + Late.
// Sauvegarde via /api/pedagogy-space/attendance → sync automatique vers le registre.

function AppelModal({
  register, selectedClassId, academicYearId, schoolLevelId, teacherId,
  appelDate, setAppelDate, onClose, onSaved,
}: {
  register: any;
  selectedClassId: string;
  academicYearId: string;
  schoolLevelId: string;
  teacherId: string;
  appelDate: string;
  setAppelDate: (d: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const studentsRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ⭐ FIX : updateStudents met à jour studentsRef immédiatement (synchro)
  const updateStudents = (updater: (prev: any[]) => any[]) => {
    const newState = updater(studentsRef.current);
    studentsRef.current = newState;
    setStudents(newState);
  };

  useEffect(() => {
    if (!selectedClassId || !appelDate) return;
    setLoading(true);
    (async () => {
      try {
        // ⭐ cache: 'no-store' pour éviter le stale read (defense-in-depth)
        const res = await fetch(
          `/api/pedagogy-space/attendance/${selectedClassId}?date=${appelDate}`,
          { credentials: "include", cache: "no-store" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        studentsRef.current = list;
        setStudents(list);
      } catch {
        studentsRef.current = [];
        setStudents([]);
      }
      finally { setLoading(false); }
    })();
  }, [selectedClassId, appelDate]);

  const setMorning = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    updateStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, morningStatus: status } : s));
  };
  const setAfternoon = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'EXCUSED') => {
    updateStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, afternoonStatus: status } : s));
  };
  const toggleLate = (studentId: string) => {
    updateStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, late: !s.late } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = studentsRef.current
        .filter(s => s && s.studentId)
        .map(s => ({
          studentId: s.studentId,
          status: s.status || 'PRESENT',
          morningStatus: s.morningStatus || 'PRESENT',
          afternoonStatus: s.afternoonStatus || 'PRESENT',
          eveningStatus: s.eveningStatus || 'PRESENT',
          late: !!s.late,
        }));
      const res = await fetch("/api/pedagogy-space/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ academicYearId, classId: selectedClassId, date: appelDate, records }),
      });
      if (!res.ok) throw new Error("Save error");
      toast.success("✅ Attendance saved — register updated");

      // ⭐ Emit the 'attendance:saved' event so the register table
      //    reloads automatically. The listener in AttendanceRegisterTab
      //    (parent component) will call loadRegister() with a 300ms delay.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('attendance:saved', {
          detail: {
            classId: selectedClassId,
            date: appelDate,
            academicYearId,
          },
        }));
      }

      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally { setSaving(false); }
  };

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-6 w-6 text-amber-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Take attendance</h3>
              <p className="text-xs text-slate-500">Class: {translateClassName(register.classNameResolved) || '—'} — Data will be saved automatically to the register</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        {/* Date selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-xs font-semibold text-slate-600 mr-2">Attendance date:</label>
          <input type="date" value={appelDate} onChange={e => setAppelDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        </div>

        {/* Students list */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No students in this class.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">No.</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Name</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={3}>☀️ Morning</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={3}>🌙 Afternoon</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700">⏰</th>
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
                    return aName.localeCompare(bName, 'en');
                  }).map((s, idx) => (
                    <tr key={s.studentId} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setMorning(s.studentId, 'PRESENT')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.morningStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>PM</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setMorning(s.studentId, 'ABSENT')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.morningStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>AM</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setMorning(s.studentId, 'EXCUSED')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.morningStatus === 'EXCUSED' ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>EM</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setAfternoon(s.studentId, 'PRESENT')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.afternoonStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>PA</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setAfternoon(s.studentId, 'ABSENT')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.afternoonStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>AA</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setAfternoon(s.studentId, 'EXCUSED')} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.afternoonStatus === 'EXCUSED' ? "bg-purple-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>EA</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => toggleLate(s.studentId)} className={cn("px-2.5 py-1.5 rounded text-xs font-bold", s.late ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>Late</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save attendance
          </button>
        </div>
      </div>
    </div>
  );
}
