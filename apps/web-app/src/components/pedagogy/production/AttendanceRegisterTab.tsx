"use client";

/**
 * ============================================================================
 * REGISTRE D'APPEL — Registre mensuel + Évaluation certificative + Relevés
 * ============================================================================
 *
 * Implémentation conforme au template officiel du registre d'appel mensuel
 * pour le primaire (maternelle/primaire).
 *
 * Structure :
 *   PAGE 1 — Registre d'appel mensuel
 *     - Tableau principal : 1 ligne par élève, 25 cases (5 semaines × 5 jours)
 *       + Motif des absences + Totaux (possibles, absences, effectif)
 *       + Observation + Nombre de demi-journées de classe
 *     - Section récapitulative bas : Demi-journée du mois, Présence possible,
 *       Total absences, Total présences effectives, % présences, % absences
 *     - Phrase d'arrêt : "Arrêté ce registre d'appel ce jour..."
 *       avec date, heure, effectif du jour (Filles/Garçons)
 *     - Signatures : Directeur + Titulaire
 *
 *   PAGE 2 — Évaluation certificative mensuelle
 *     - En-tête : N° d'évaluation + mois + étape
 *     - Tableau : matières dynamiques × sous-colonnes CM (/18), CP (/2), Total
 *     - Section récapitulative : effectif total, ayant composé (G/F/Total),
 *       ayant atteint le seuil de réussite (G/F/Total), n'ayant pas atteint (G/F/Total),
 *       % de réussite (G/F/Total)
 *     - Signatures : Titulaire + Directeur
 *
 *   PAGE 3 — Tableau de relevés mensuels pour l'année scolaire
 *     - Synthèse annuelle : Sept → Juin × Renseignements généraux + Renseignements spéciaux
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
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

interface AttendanceRegisterTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// ⭐ TOUS les 12 mois sont désormais disponibles (y compris Juillet et Août)
// pour permettre la saisie même pendant l'été (cours de rattrapage, etc.).
// Le mois courant est auto-sélectionné et verrouillé (voir selectedMonth state).
const MONTHS = [
  { value: 1, label: "Janvier" }, { value: 2, label: "Février" },
  { value: 3, label: "Mars" }, { value: 4, label: "Avril" },
  { value: 5, label: "Mai" }, { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" }, { value: 8, label: "Août" },
  { value: 9, label: "Septembre" }, { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" }, { value: 12, label: "Décembre" },
];

const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                     "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const WEEKS = [1, 2, 3, 4, 5]; // 5 semaines par mois
const DAYS = [
  { num: 1, label: "L" }, { num: 2, label: "M" }, { num: 3, label: "M" },
  { num: 4, label: "J" }, { num: 5, label: "V" },
]; // Lundi à Vendredi (initiales)

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ⭐ Calculer le nombre total de demi-jours d'un mois
// Lundi=2, Mardi=2, Mercredi=1, Jeudi=2, Vendredi=2 (total/semaine=9)
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
function getWeekDateRange(week: number, month: number, year: number): string {
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

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Marqueurs d'absence possibles
const ABSENCE_MARKS = [
  { value: "", label: "Présent", short: "" },
  { value: "A", label: "Absent", short: "A" },
  { value: "R", label: "Retard", short: "R" },
  { value: "E", label: "Excusé", short: "E" },
];

export function AttendanceRegisterTab({ tenantId, academicYearId, teacherId }: AttendanceRegisterTabProps) {
  const { user } = useAppSession();
  // ⭐ Contexte module (pour tenant + schoolLevel dans le PDF)
  const { tenant, schoolLevel } = useModuleContext();
  // ⭐ Noms pour les signatures (auto-récupérés depuis la session)
  const teacherName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  // Le nom du directeur sera récupéré depuis le tenant/settings
  const [directorName, setDirectorName] = useState<string>('');

  const [classes, setClasses] = useState<any[]>([]);
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null); // null | 'pdf'
  const [showAppelModal, setShowAppelModal] = useState(false);
  const [appelDate, setAppelDate] = useState(new Date().toISOString().split("T")[0]);
  const [appelSaving, setAppelSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "evaluation" | "summary" | "settings">("register");
  // ⭐ Modal de confirmation professionnel (remplace window.confirm)
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();

  // ⭐ Jours fériés du mois (paramétrables par l'enseignant)
  // Stockés sous forme de dates ISO (YYYY-MM-DD)
  const [holidays, setHolidays] = useState<string[]>([]);


  // === Chargement des classes ===
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const { data: classesData = [] } = useMyClasses(teacherId, academicYearId);
  useEffect(() => {
    const list = Array.isArray(classesData) ? classesData : [];
    setClasses(list);
    if (list.length > 0 && !selectedClassId) {
      setSelectedClassId(list[0].classId);
    }
  }, [classesData, selectedClassId]);

  // === Chargement du registre ===
  const loadRegister = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pedagogy-space/attendance-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, teacherId, classId: selectedClassId,
          month: selectedMonth, year: selectedYear,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
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
        // Lundi=2, Mardi=2, Mercredi=1, Jeudi=2, Vendredi=2 (total/semaine=9)
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
          totalPresenceEffectif: totalDemiJourneesMois,
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
      toast.error("Erreur", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, selectedClassId, selectedMonth, selectedYear, classes]);

  useEffect(() => {
    if (selectedClassId) loadRegister();
  }, [loadRegister, selectedClassId]);

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
  // et totalPresenceEffectif pour TOUS les élèves.
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
        totalPresenceEffectif: newDemiJournees - totalAbsences,
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
      const totalPresenceEffectif = totalPresencesPossibles - totalAbsences;
      return {
        ...s,
        absences: newAbsences,
        totalAbsences,
        totalPresencesPossibles,
        totalPresenceEffectif,
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
      const totalEff = students.reduce((sum, s) => sum + (s.totalPresenceEffectif || 0), 0);
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
          // ⭐ Jours fériés du mois (stockés dans le registre)
          holidays: holidays,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Registre enregistré", {
        description: "Les modifications ont été sauvegardées. Le statut reste 'Brouillon' jusqu'à la soumission au directeur.",
      });
      // ⭐ Recharger le registre pour mettre à jour l'affichage
      await loadRegister();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
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
    // ⭐ Modal professionnel
    const ok = await confirmWarning(
      `Souhaitez-vous soumettre au directeur ?`,
      'Soumission unifiée',
      `Classe : ${selectedClass?.className || '—'}\n` +
      `Mois : ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n\n` +
      `Cette action soumet en une seule fois :\n` +
      `• Le registre d'appel\n` +
      `• L'évaluation mensuelle\n` +
      `• Le cahier journal (semaine en cours)\n\n` +
      `Cette action est irréversible. Le directeur sera notifié automatiquement.`
    );
    if (!ok) return;
    setSubmittingUnified(true);
    try {
      // ⭐ Calculer le lundi de la semaine en cours
      const today = new Date();
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day; // dimanche = -6, sinon 1 - day
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);

      const res = await fetch('/api/pedagogy-space/submit-unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teacherId,
          classId: selectedClassId,
          month: selectedMonth,
          year: selectedYear,
          weekStartDate: monday.toISOString().split('T')[0],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      toast.success('✅ Soumission réussie', {
        description: `Le directeur a été notifié par email, WhatsApp et SMS.`,
      });
      // ⭐ Recharger le registre pour mettre à jour le statut (DRAFT → SUBMITTED)
      await loadRegister();
    } catch (e: any) {
      toast.error('Erreur lors de la soumission', { description: e.message });
    } finally {
      setSubmittingUnified(false);
    }
  };

  // ⭐ Notifier manuellement le directeur (relance email + WhatsApp + SMS)
  //    Visible même après soumission (permet de relancer le directeur).
  const handleNotifyDirector = async () => {
    if (!register || !selectedClassId) return;
    const ok = await confirmWarning(
      `Notifier le directeur ?`,
      'Notification manuelle',
      `Le directeur recevra une notification par :\n` +
      `• Email\n` +
      `• WhatsApp\n` +
      `• SMS\n\n` +
      `Classe : ${selectedClass?.className || '—'}\n` +
      `Mois : ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
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
      toast.success('✅ Directeur notifié', {
        description: `Notification envoyée à ${data.notifiedDirectors || 'le directeur'}.`,
      });
    } catch (e: any) {
      toast.error('Erreur lors de la notification', { description: e.message });
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
      toast.success("✅ Tableau de relevés actualisé");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
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
        schoolName: tenant?.name || 'Établissement scolaire',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
        schoolLevel: schoolLevel?.code || (register.schoolLevelCode as string) || 'PRIMAIRE',
      };

      // ⭐ Stats récapitulatives
      const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
      const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
      const totalEff = students.reduce((sum, s) => sum + (s.totalPresenceEffectif || 0), 0);
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
        totalPresenceEffectif: s.totalPresenceEffectif || 0,
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

      toast.success('✅ PDF exporté avec en-tête officiel');
    } catch (e: any) {
      console.error('Erreur export PDF:', e);
      toast.error("Erreur d'export", { description: e.message });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* === En-tête : classe + mois + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classe</label>
          <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
            disabled={loading}>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId} ({c.totalStudents || 0} élèves)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mois</label>
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
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Année</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold w-[110px] text-slate-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
          >
            {/* ⭐ Liste d'années : année courante -2 à +1 (permet consultation registres passés) */}
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
          {/* ⭐ Bouton Appel — ouvre un modal pour marquer les présences/absences */}
          {activeTab === "register" && register && (
            <button onClick={() => setShowAppelModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
              <CalendarCheck className="h-4 w-4" />
              Faire l'appel
            </button>
          )}
          {/* ⭐ Bouton Enregistrer — toujours actif (sauf loading/saving/!register)
              pour permettre la sauvegarde en attendant la soumission au directeur */}
          <button onClick={handleSave} disabled={saving || loading || !register}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {/* ⭐ Bouton Soumettre UNIFIÉ — soumet registre + évaluation mensuelle + cahier journal
              en une seule transaction, puis notifie automatiquement le directeur
              (email + WhatsApp + SMS) */}
          <button onClick={handleUnifiedSubmit} disabled={loading || !register || register?.status !== "DRAFT" || submittingUnified}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {submittingUnified ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submittingUnified ? 'Soumission...' : 'Soumettre au directeur'}
          </button>
          {/* ⭐ Bouton Notifier le directeur — relance email/WhatsApp/SMS (visible même après soumission) */}
          <button onClick={handleNotifyDirector} disabled={notifyingDirector || !register}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            title="Notifier le directeur par email, WhatsApp et SMS">
            {notifyingDirector ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Notifier
          </button>
          {/* ⭐ Bouton Export PDF uniquement (Excel supprimé) */}
          {register && (
            <button onClick={() => handleExport("pdf")} disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* === Sous-onglets : Registre / Évaluation / Relevés / Paramètres === */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
        <button onClick={() => setActiveTab("register")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "register" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <ClipboardList className="h-4 w-4" />
          Registre d'appel
        </button>
        <button onClick={() => setActiveTab("evaluation")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "evaluation" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <FileText className="h-4 w-4" />
          Évaluation mensuelle
        </button>
        <button onClick={() => setActiveTab("summary")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "summary" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <BarChart3 className="h-4 w-4" />
          Tableau de relevés annuel
        </button>
        <button onClick={() => setActiveTab("settings")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            activeTab === "settings" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          <Settings className="h-4 w-4" />
          Paramètres
        </button>
      </div>

      {/* === PAGE 1 — Registre d'appel === */}
      {activeTab === "register" && register && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          {/* En-tête */}
          <div className="text-center border-b border-slate-300 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              REGISTRE D'APPEL{register.schoolLevelCode === "MATERNELLE" ? " MATERNELLE" : register.schoolLevelCode === "PRIMAIRE" ? "" : ` ${register.schoolLevelName || ""}`}
            </h2>
            <div className="text-sm text-slate-600 mt-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Mois de <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear}</span>
                <span className="text-slate-300">|</span>
                <span>Nombre de demi-journées : <strong className="text-blue-600">{demiJourneeMois}</strong></span>
              </div>
              <div className="text-slate-700">
                Classe : <strong>{register.classNameResolved || selectedClass?.className || "—"}</strong> — Effectif : {selectedClass?.totalStudents || 0} élèves
                ({selectedClass?.boys || 0} G, {selectedClass?.girls || 0} F)
              </div>
            </div>
          </div>

          {/* Tableau principal : 1 élève = 1 ligne */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: "1600px" }}>
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                  <th colSpan={25} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">
                    Indication des absences pour chaque jour de classe (5 semaines × 5 jours)
                  </th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "120px" }}>Motif des absences</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total présences possibles</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total absences</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Total présence effectif</th>
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "100px" }}>Observation</th>
                </tr>
                <tr className="bg-slate-50">
                  {/* ⭐ Élargir les sous-colonnes jours : de px-1 à px-2,
                      minWidth 45px par cellule (au lieu de default ~28px).
                      Permet de voir les marques (-, |, +) clairement. */}
                  {WEEKS.map(w => {
                    const range = getWeekDateRange(w, selectedMonth, selectedYear);
                    return (
                      <th key={w} colSpan={5} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] uppercase" style={{ minWidth: "225px" }}>
                        S{w} {range && <span className="font-normal text-slate-400 normal-case text-[9px] block">{range}</span>}
                      </th>
                    );
                  })}
                </tr>
                {/* ⭐ Ligne des initiales des jours (L M M J V) avec dates pour chaque semaine */}
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
                  return aName.localeCompare(bName, 'fr');
                }).map((student, idx) => (
                  <tr key={student.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                    {/* ⭐ N° séquentiel après tri alphabétique (1, 2, 3...) */}
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-medium">
                      {student.nom} {student.prenom}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                    {/* 25 cases d'absence — système demi-jours : -, |, + */}
                    {WEEKS.map(w => DAYS.map(d => {
                      const marked = getAbsence(student, w, d.num);
                      const cell = getCellDate(w, d.num, selectedMonth, selectedYear);
                      // ⭐ Griser les cellules hors mois
                      if (!cell.inMonth) {
                        return (
                          <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-slate-100" style={{ minWidth: "45px", width: "45px" }}>
                            <div className="w-full h-9 flex items-center justify-center text-slate-300 text-xs">—</div>
                          </td>
                        );
                      }
                      // ⭐ Si jour férié → emoji 🎉 en lecture seule
                      const isHoliday = holidays.includes(cell.dateStr);
                      if (isHoliday) {
                        return (
                          <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-red-50" style={{ minWidth: "45px", width: "45px" }}>
                            <div className="w-full h-9 flex items-center justify-center text-base" title="Jour férié">🎉</div>
                          </td>
                        );
                      }
                      return (
                        <td key={`${w}-${d.num}`} className="border border-slate-300 p-0" style={{ minWidth: "45px", width: "45px" }}>
                          {/* ⭐ Affichage read-only : seul le symbole s'affiche, pas de select/flèche */}
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
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-600">{student.totalPresenceEffectif || 0}</td>
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
                      Aucun élève inscrit dans cette classe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ⭐ Section jours fériés (dynamique sous le tableau) */}
          {holidays.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <div className="text-xs font-bold text-red-700 uppercase flex items-center gap-1">
                <span>🎉</span> Jours fériés du mois
              </div>
              <div className="flex flex-wrap gap-2">
                {holidays.map(h => (
                  <span key={h} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-red-200 rounded text-xs text-red-700">
                    🎉 {formatDateFR(h)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* === Légende des symboles === */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-bold text-slate-600 uppercase mb-2">Légende</div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-transparent text-slate-400 font-bold rounded">·</span> Présent</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-700 font-bold rounded">−</span> Absent le matin (1 demi-jour)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-700 font-bold rounded">│</span> Absent l'après-midi (1 demi-jour)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 font-bold rounded">+</span> Absent toute la journée (2 demi-jours)</span>
              <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-400 font-bold rounded">—</span> Hors mois</span>
              <span className="flex items-center gap-1"><span className="text-base">🎉</span> Jour férié</span>
            </div>
          </div>

          {/* === Section récapitulative (bas du registre) === */}
          <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">
              Récapitulatif du mois — {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Demi-journées du mois</label>
                {/* ⭐ Auto-calculé (read-only) : nombre de demi-jours du mois, SANS × nb élèves */}
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold bg-slate-100 text-slate-700">{demiJourneeMois}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Présence possible</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold bg-white">{totalPoss}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total absences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-red-600 bg-white">{totalAbs}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total présences effectives</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-emerald-600 bg-white">{totalEff}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">% présences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-emerald-700 bg-emerald-50">{pctP}%</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">% absences</label>
                <div className="px-2 py-1 border border-slate-200 rounded text-sm font-bold text-red-700 bg-red-50">{pctA}%</div>
              </div>
            </div>
          </div>

          {/* === Phrase d'arrêt === */}
          <div className="border border-slate-300 rounded-lg p-4 bg-amber-50/30">
            <p className="text-sm font-medium text-slate-800 mb-3">
              Arrêté ce registre d'appel ce jour :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date d'arrêt</label>
                <input type="date" value={register.arreteDate ? formatDateFR(register.arreteDate) : ""}
                  onChange={(e) => updateRegisterField("arreteDate", e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Heure</label>
                <input type="time" value={register.arreteHeure || ""}
                  onChange={(e) => updateRegisterField("arreteHeure", e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effectif filles du jour</label>
                <input type="number" min={0} value={register.effectifJourFilles || 0}
                  onChange={(e) => updateRegisterField("effectifJourFilles", parseInt(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Effectif garçons du jour</label>
                <input type="number" min={0} value={register.effectifJourGarcons || 0}
                  onChange={(e) => updateRegisterField("effectifJourGarcons", parseInt(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
              </div>
            </div>
          </div>

          {/* === Signatures (comme dans le module RH — contrats) === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            {/* Signature Directeur */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div>
                  <div className="text-xs text-slate-500">{directorName || 'Nom du directeur'} — Signature et cachet</div>
                </div>
                {directorSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
              </div>
              {directorSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={directorSignature} alt="Signature Directeur" className="max-h-32 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={140}
                  disabled={isReadOnly}
                  placeholder="Signature du Directeur"
                  onSignatureChange={(data) => setDirectorSignature(data)}
                />
              )}
              {directorSignature && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setDirectorSignature(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Effacer la signature
                </button>
              )}
            </div>

            {/* Signature Titulaire */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div>
                  <div className="text-xs text-slate-500">{teacherName || 'Nom du titulaire'} — Signature</div>
                </div>
                {teacherSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
              </div>
              {teacherSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={teacherSignature} alt="Signature Titulaire" className="max-h-32 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={140}
                  disabled={isReadOnly}
                  placeholder="Signature du Titulaire"
                  onSignatureChange={(data) => setTeacherSignature(data)}
                />
              )}
              {teacherSignature && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setTeacherSignature(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Effacer la signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === PAGE 2 — Évaluation mensuelle (dynamic from Module Examen) === */}
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

      {/* === PAGE 3 — Tableau de relevés mensuels pour l'année scolaire === */}
      {activeTab === "summary" && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                TABLEAU DE RELEVÉS MENSUELS POUR L'ANNÉE SCOLAIRE
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Classe : <strong>{selectedClass?.className || "—"}</strong>
              </p>
            </div>
            <button onClick={refreshSummary}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: "1400px" }}>
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Mois</th>
                  <th colSpan={6} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-blue-50">
                    RENSEIGNEMENTS GÉNÉRAUX
                  </th>
                  <th colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-amber-50">
                    RENSEIGNEMENTS SPÉCIAUX
                  </th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "150px" }}>Observations</th>
                </tr>
                <tr className="bg-slate-50 text-[10px]">
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Demi-jours de classe</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total élèves fréquentés</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total présences possibles</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total absences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Nombre présences</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">% présences effectives</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Élèves jamais manqué / ≤ 4 classes</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Élèves ayant manqué &gt; 4 classes</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 uppercase">Total absences imputables</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map(m => {
                  const data = monthlyData.find(d => d.month === m.value);
                  return (
                    <tr key={m.value} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase">{m.label}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{data?.demiJoursClasse ?? "—"}</td>
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
                {/* Ligne moyenne générale */}
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 px-2 py-2 uppercase">Moyenne générale</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{monthlyData.length > 0 ? (monthlyData.reduce((s, d) => s + (d.demiJoursClasse || 0), 0) / monthlyData.length).toFixed(1) : "—"}</td>
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
                  <td className="border border-slate-300 px-2 py-2 text-[10px] text-slate-500">Totaux annuels</td>
                </tr>
              </tbody>
            </table>
          </div>

          {monthlyData.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-6 italic">
              Aucune donnée mensuelle disponible. Cliquez sur "Actualiser" pour recalculer à partir des registres d'appel existants.
            </div>
          )}
        </div>
      )}

      {/* === PAGE 4 — Paramètres (jours fériés) === */}
      {activeTab === "settings" && register && (
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-900">Paramètres du mois</h2>
            <p className="text-sm text-slate-500">
              {MONTH_NAMES[selectedMonth]} {selectedYear} — Configuration des jours fériés
            </p>
          </div>

          {/* === Jours fériés === */}
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Settings className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-800">
                <strong>Jours fériés :</strong> Spécifiez les jours fériés du mois.
                Chaque jour férié déduit ses demi-jours du total (Lundi/Mardi/Jeudi/Vendredi = 2 demi-jours,
                Mercredi = 1 demi-jour). Le total des demi-jours est mis à jour automatiquement.
              </div>
            </div>

            {/* Liste des jours du mois (lundi-vendredi seulement) */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">Jours ouvrés du mois :</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {(() => {
                  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
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
                          {isHoliday ? "🎉 Férié" : `${dow === 3 ? 1 : 2} dj`}
                        </div>
                      </button>
                    );
                  }
                  return items;
                })()}
              </div>
            </div>

            {/* Récapitulatif des demi-jours */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Demi-jours bruts (tous jours ouvrés) :</span>
                <span className="font-bold text-slate-900">{calculateDemiJourneesMois(selectedMonth, selectedYear, [])}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Jours fériés déclarés :</span>
                <span className="font-bold text-red-600">{holidays.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Demi-jours déduits (jours fériés) :</span>
                <span className="font-bold text-red-600">
                  {calculateDemiJourneesMois(selectedMonth, selectedYear, []) - calculateDemiJourneesMois(selectedMonth, selectedYear, holidays)}
                </span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Total demi-jours du mois :</span>
                <span className="text-lg font-bold text-blue-600">{calculateDemiJourneesMois(selectedMonth, selectedYear, holidays)}</span>
              </div>
            </div>

            {/* Bouton sauvegarder */}
            <button
              onClick={handleSave}
              disabled={saving || isReadOnly}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer les paramètres
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

      {/* === États === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement…
        </div>
      )}

      {!loading && !selectedClassId && classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune classe assignée</p>
          <p className="text-sm text-slate-500 mt-1">Vous n'avez pas de classe assignée pour cette année.</p>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          Ce registre est verrouillé (statut: {register?.status}).
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
// Affiche la liste des élèves avec 4 boutons (PM/AM/PS/AS) + Retard.
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedClassId || !appelDate) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pedagogy-space/attendance/${selectedClassId}?date=${appelDate}`, { credentials: "include" });
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      } catch { setStudents([]); }
      finally { setLoading(false); }
    })();
  }, [selectedClassId, appelDate]);

  const setMorning = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, morningStatus: status } : s));
  };
  const setAfternoon = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, afternoonStatus: status } : s));
  };
  const toggleLate = (studentId: string) => {
    setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, late: !s.late } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = students
        .filter(s => s && s.studentId)
        .map(s => ({
          studentId: s.studentId,
          status: s.status || 'PRESENT',
          morningStatus: s.morningStatus || 'PRESENT',
          afternoonStatus: s.afternoonStatus || 'PRESENT',
          late: !!s.late,
        }));
      const res = await fetch("/api/pedagogy-space/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academicYearId, classId: selectedClassId, date: appelDate, records }),
      });
      if (!res.ok) throw new Error("Erreur d'enregistrement");
      toast.success("✅ Appel enregistré — le registre est mis à jour");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-6 w-6 text-amber-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Faire l'appel</h3>
              <p className="text-xs text-slate-500">Classe: {register.classNameResolved || '—'} — Les données s'enregistreront automatiquement dans le registre</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        {/* Date selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <label className="text-xs font-semibold text-slate-600 mr-2">Date de l'appel:</label>
          <input type="date" value={appelDate} onChange={e => setAppelDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        </div>

        {/* Students list */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Aucun élève dans cette classe.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">N°</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-700">Nom</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={2}>☀️ Matin</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700" colSpan={2}>🌙 Après-midi</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700">⏰</th>
                  </tr>
                </thead>
                <tbody>
                  {[...students].sort((a, b) => {
                    const aName = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
                    const bName = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
                    return aName.localeCompare(bName, 'fr');
                  }).map((s, idx) => (
                    <tr key={s.studentId} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setMorning(s.studentId, 'PRESENT')} className={cn("px-3 py-1.5 rounded text-xs font-bold", s.morningStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>PM</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setMorning(s.studentId, 'ABSENT')} className={cn("px-3 py-1.5 rounded text-xs font-bold", s.morningStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>AM</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setAfternoon(s.studentId, 'PRESENT')} className={cn("px-3 py-1.5 rounded text-xs font-bold", s.afternoonStatus === 'PRESENT' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>PS</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setAfternoon(s.studentId, 'ABSENT')} className={cn("px-3 py-1.5 rounded text-xs font-bold", s.afternoonStatus === 'ABSENT' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>AS</button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => toggleLate(s.studentId)} className={cn("px-3 py-1.5 rounded text-xs font-bold", s.late ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>Retard</button>
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer l'appel
          </button>
        </div>
      </div>
    </div>
  );
}
