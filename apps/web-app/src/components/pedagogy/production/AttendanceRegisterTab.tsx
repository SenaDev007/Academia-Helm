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
  ChevronLeft, Calendar, FileText, BookOpen, BarChart3,
  CheckCircle2, XCircle, Clock, Printer, Settings, AlertCircle,
  Plus, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";

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
function calculateDemiJourneesMois(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  const DEMI_JOURS: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2 };
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay(); // 0=dim, 1=lun, ..., 5=ven, 6=sam
    total += DEMI_JOURS[dow] || 0;
  }
  return total;
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
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  // ⭐ Mois et année VERROUILLÉS sur le mois courant (date du jour).
  // L'enseignant ne peut plus modifier le mois/année — le système reconnaît
  // automatiquement le mois en cours (ex: Juillet 2026) et charge le bon registre.
  // Raisonnement : si on est en juillet 2026, on veut travailler sur le registre
  // de juillet 2026, pas sur un mois passé ou futur.
  const today = new Date();
  const [selectedMonth] = useState<number>(today.getMonth() + 1); // 1-12, verrouillé
  const [selectedYear] = useState<number>(today.getFullYear());    // verrouillé

  const [register, setRegister] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  // ⭐ Signatures (comme dans le module RH — contrats)
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "evaluation" | "summary">("register");

  // États pour la configuration des matières
  const [showSubjectConfig, setShowSubjectConfig] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<any[]>([]);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // === Chargement des classes ===
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
      } catch { setClasses([]); }
    })();
  }, [teacherId, academicYearId]);

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
      // ⭐ Charger les signatures existantes depuis le registre
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      const studentsData = typeof data.studentsData === "string"
        ? JSON.parse(data.studentsData || "[]")
        : (data.studentsData || []);
      // Si pas d'élèves, on charge depuis la classe
      if (studentsData.length === 0) {
        const cls = classes.find(c => c.classId === selectedClassId);
        // ⭐ Calculer le nombre de demi-jours du mois (MÊME pour tous les élèves)
        // Lundi=2, Mardi=2, Mercredi=1, Jeudi=2, Vendredi=2 (total/semaine=9)
        const totalDemiJourneesMois = calculateDemiJourneesMois(selectedMonth, selectedYear);
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
        const totalDemiJourneesMois = calculateDemiJourneesMois(selectedMonth, selectedYear);
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

  // === Mise à jour d'une case d'absence ===
  const updateAbsence = (studentIdx: number, week: number, day: number, marked: string) => {
    setStudents(prev => prev.map((s, i) => {
      if (i !== studentIdx) return s;
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
      // = calculé par le backend syncAttendanceToRegister, mais pour l'affichage
      // frontend on utilise la valeur stockée dans le registre ou un défaut.
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
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Registre enregistré");
      loadRegister();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!register) return;
    if (!confirm("Soumettre ce registre au directeur ?")) return;
    try {
      const res = await fetch(`/api/pedagogy-space/attendance-registers/${register.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "SUBMITTED", submittedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success("✅ Registre soumis");
      loadRegister();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // === Soumettre l'évaluation mensuelle au directeur ===
  const handleSubmitEvaluation = async () => {
    if (!evaluation) return;
    if (subjectsConfig.length === 0) {
      toast.error("Veuillez d'abord configurer les matières");
      return;
    }
    if (!confirm("Soumettre cette évaluation au directeur ?")) return;
    setSaving(true);
    try {
      // D'abord sauvegarder les scores
      await handleSaveEvaluation(true);
      // Puis soumettre
      const res = await fetch(`/api/pedagogy-space/monthly-evaluations/${evaluation.id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Évaluation soumise au directeur");
      loadRegister();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Chargement des matières disponibles pour la classe ===
  const loadAvailableSubjects = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingSubjects(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${selectedClassId}&teacherId=${teacherId}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setAvailableSubjects(Array.isArray(data) ? data : []);
    } catch {
      setAvailableSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, [academicYearId, selectedClassId, teacherId]);

  // === Ouvrir la modale de config des matières ===
  const openSubjectConfig = () => {
    // Pré-remplir avec les matières déjà configurées
    setSelectedSubjects(subjectsConfig.map((s: any) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      coefficient: s.coefficient ?? 1,
    })));
    loadAvailableSubjects();
    setShowSubjectConfig(true);
  };

  // === Ajouter une matière disponible à la sélection ===
  const addAvailableSubject = (subj: any) => {
    if (selectedSubjects.find(s => s.subjectName === subj.subjectName)) {
      toast.error("Cette matière est déjà ajoutée");
      return;
    }
    setSelectedSubjects(prev => [...prev, {
      subjectId: subj.subjectId,
      subjectName: subj.subjectName,
      coefficient: subj.coefficient ?? 1,
    }]);
  };

  // === Ajouter une matière personnalisée ===
  const addCustomSubject = () => {
    if (!customSubjectName.trim()) {
      toast.error("Veuillez saisir un nom de matière");
      return;
    }
    if (selectedSubjects.find(s => s.subjectName.toLowerCase() === customSubjectName.trim().toLowerCase())) {
      toast.error("Cette matière est déjà ajoutée");
      return;
    }
    setSelectedSubjects(prev => [...prev, {
      subjectId: null,
      subjectName: customSubjectName.trim(),
      coefficient: 1,
    }]);
    setCustomSubjectName("");
  };

  // === Retirer une matière de la sélection ===
  const removeSubject = (idx: number) => {
    setSelectedSubjects(prev => prev.filter((_, i) => i !== idx));
  };

  // === Sauvegarder la config des matières ===
  const handleSaveSubjects = async () => {
    if (!evaluation) return;
    if (selectedSubjects.length === 0) {
      toast.error("Veuillez sélectionner au moins une matière");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/monthly-evaluations/${evaluation.id}/subjects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subjectsConfig: selectedSubjects.map((s, idx) => ({
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            order: idx + 1,
            coefficient: s.coefficient || 1,
          })),
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(`✅ ${selectedSubjects.length} matière(s) configurée(s)`);
      setShowSubjectConfig(false);
      loadRegister();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Évaluation : maj d'un score ===
  const updateStudentScore = (studentIdx: number, subjectIdx: number, field: "cm" | "cp", value: number) => {
    if (!evaluation) return;
    const scores = typeof evaluation.studentScores === "string"
      ? JSON.parse(evaluation.studentScores)
      : (evaluation.studentScores || []);
    const newScores = [...scores];
    if (!newScores[studentIdx]) return;
    if (!newScores[studentIdx].scores) newScores[studentIdx].scores = [];
    if (!newScores[studentIdx].scores[subjectIdx]) return;
    newScores[studentIdx].scores[subjectIdx][field] = value;
    newScores[studentIdx].scores[subjectIdx].total =
      (newScores[studentIdx].scores[subjectIdx].cm || 0) +
      (newScores[studentIdx].scores[subjectIdx].cp || 0);
    // Recalculer totalGeneral
    newScores[studentIdx].totalGeneral = newScores[studentIdx].scores.reduce(
      (sum: number, s: any) => sum + (s.total || 0), 0
    );
    setEvaluation({ ...evaluation, studentScores: newScores });
  };

  const handleSaveEvaluation = async (silent: boolean = false) => {
    if (!evaluation) return;
    if (!silent) setSaving(true);
    try {
      const scores = typeof evaluation.studentScores === "string"
        ? JSON.parse(evaluation.studentScores)
        : (evaluation.studentScores || []);
      // Calculer les statistiques
      const seuil = evaluation.seuilReussite || 10.0;
      let totalG = 0, totalF = 0;
      let composeG = 0, composeF = 0;
      let atteintG = 0, atteintF = 0;
      for (const s of scores) {
        const sexe = (s.sexe || "").toUpperCase();
        const tot = s.totalGeneral || 0;
        if (sexe === "M" || sexe === "G") {
          totalG++;
          if (tot > 0) composeG++;
          if (tot >= seuil) atteintG++;
        } else if (sexe === "F") {
          totalF++;
          if (tot > 0) composeF++;
          if (tot >= seuil) atteintF++;
        }
      }
      const totalC = totalG + totalF;
      const res = await fetch(`/api/pedagogy-space/monthly-evaluations/${evaluation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentScores: scores,
          subjectsConfig: typeof evaluation.subjectsConfig === "string"
            ? JSON.parse(evaluation.subjectsConfig) : (evaluation.subjectsConfig || []),
          seuilReussite: seuil,
          effectifTotalGarcons: totalG,
          effectifTotalFilles: totalF,
          effectifTotalClasse: totalC,
          ayantComposeG: composeG, ayantComposeF: composeF, ayantComposeTotal: composeG + composeF,
          ayantAtteintSeuilG: atteintG, ayantAtteintSeuilF: atteintF, ayantAtteintSeuilTotal: atteintG + atteintF,
          nAyantPasAtteintG: totalG - atteintG, nAyantPasAtteintF: totalF - atteintF, nAyantPasAtteintTotal: totalC - atteintG - atteintF,
          pourcentageReussiteG: totalG > 0 ? Math.round((atteintG / totalG) * 10000) / 100 : 0,
          pourcentageReussiteF: totalF > 0 ? Math.round((atteintF / totalF) * 10000) / 100 : 0,
          pourcentageReussiteTotal: totalC > 0 ? Math.round(((atteintG + atteintF) / totalC) * 10000) / 100 : 0,
        }),
      });
      if (!res.ok) throw new Error();
      if (!silent) {
        toast.success("✅ Évaluation enregistrée");
        loadRegister();
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
      throw e;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // === Maj du registre : demi-journées, motif, observation ===
  const updateStudentField = (studentIdx: number, field: string, value: any) => {
    setStudents(prev => prev.map((s, i) => {
      if (i !== studentIdx) return s;
      const updated = { ...s, [field]: value };
      // Recalculer si nbDemiJournees change
      if (field === "nbDemiJournees") {
        const demiJournees = parseInt(value) || 0;
        updated.totalPresencesPossibles = demiJournees;
        updated.totalPresenceEffectif = demiJournees - (s.totalAbsences || 0);
      }
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

  const subjectsConfig: any[] = evaluation
    ? (typeof evaluation.subjectsConfig === "string"
        ? JSON.parse(evaluation.subjectsConfig)
        : (evaluation.subjectsConfig || []))
    : [];
  const studentScores: any[] = evaluation
    ? (typeof evaluation.studentScores === "string"
        ? JSON.parse(evaluation.studentScores)
        : (evaluation.studentScores || []))
    : [];
  const monthlyData: any[] = summary
    ? (typeof summary.monthlyData === "string"
        ? JSON.parse(summary.monthlyData)
        : (summary.monthlyData || []))
    : [];

  // Calculer les totaux pour l'affichage
  const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
  const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
  const totalEff = students.reduce((sum, s) => sum + (s.totalPresenceEffectif || 0), 0);
  const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
  const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;

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
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mois (auto)</label>
          <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold min-w-[150px] text-slate-700 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {MONTH_NAMES[selectedMonth]}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Année (auto)</label>
          <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold w-[100px] text-slate-700">
            {selectedYear}
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
          <button onClick={handleSave} disabled={saving || loading || !register || isReadOnly || activeTab !== "register"}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button onClick={handleSubmit} disabled={loading || !register || register?.status !== "DRAFT" || activeTab !== "register"}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            <Send className="h-4 w-4" />
            Soumettre
          </button>
        </div>
      </div>

      {/* === Sous-onglets : Registre / Évaluation / Relevés === */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
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
      </div>

      {/* === PAGE 1 — Registre d'appel === */}
      {activeTab === "register" && register && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          {/* En-tête */}
          <div className="text-center border-b border-slate-300 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              REGISTRE D'APPEL{register.schoolLevelCode === "MATERNELLE" ? " MATERNELLE" : register.schoolLevelCode === "PRIMAIRE" ? "" : ` ${register.schoolLevelName || ""}`}
            </h2>
            <div className="text-sm text-slate-600 mt-1">
              Mois de <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear}
            </div>
            <div className="text-sm text-slate-700 mt-1">
              Classe : <strong>{register.classNameResolved || selectedClass?.className || "—"}</strong> — Effectif : {selectedClass?.totalStudents || 0} élèves
              ({selectedClass?.boys || 0} G, {selectedClass?.girls || 0} F)
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
                  <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>Nb. demi-journées</th>
                </tr>
                <tr className="bg-slate-50">
                  {/* ⭐ Élargir les sous-colonnes jours : de px-1 à px-2,
                      minWidth 45px par cellule (au lieu de default ~28px).
                      Permet de voir les marques (-, |, +) clairement. */}
                  {WEEKS.map(w => (
                    <th key={w} colSpan={5} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] uppercase" style={{ minWidth: "225px" }}>
                      Sem. {w}
                    </th>
                  ))}
                </tr>
                {/* ⭐ Ligne des initiales des jours (L M M J V) pour chaque semaine */}
                <tr className="bg-slate-50">
                  {WEEKS.map(w => DAYS.map(d => (
                    <th key={`${w}-${d.num}`} className="border border-slate-300 px-1 py-1 font-bold text-slate-500 text-[10px] uppercase" style={{ minWidth: "45px", width: "45px" }}>
                      {d.label}
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {[...students].sort((a, b) => {
                  const aName = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
                  const bName = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
                  return aName.localeCompare(bName, 'fr');
                }).map((student, idx) => (
                  <tr key={student.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{student.numero || idx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-medium">
                      {student.nom} {student.prenom}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                    {/* 25 cases d'absence — système demi-jours : -, |, + */}
                    {WEEKS.map(w => DAYS.map(d => {
                      const marked = getAbsence(student, w, d.num);
                      return (
                        <td key={`${w}-${d.num}`} className="border border-slate-300 p-0" style={{ minWidth: "45px", width: "45px" }}>
                          <select
                            value={marked}
                            onChange={(e) => updateAbsence(idx, w, d.num, e.target.value)}
                            disabled={isReadOnly}
                            className={cn(
                              "w-full h-9 text-center text-base font-bold border-0 focus:outline-none focus:ring-1 focus:ring-blue-400",
                              marked === "-" && "bg-amber-100 text-amber-700",
                              marked === "|" && "bg-amber-100 text-amber-700",
                              marked === "+" && "bg-red-100 text-red-700",
                              !marked && "bg-transparent"
                            )}
                          >
                            <option value="">·</option>
                            <option value="-">− (Absent matin)</option>
                            <option value="|">│ (Absent après-midi)</option>
                            <option value="+">+ (Absent toute la journée)</option>
                          </select>
                        </td>
                      );
                    }))}
                    <td className="border border-slate-300 p-0">
                      <input type="text" value={student.motif || ""}
                        onChange={(e) => updateStudentField(idx, "motif", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-1 py-1 text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold bg-slate-50">{student.totalPresencesPossibles || 0}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-red-600">{student.totalAbsences || 0}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-600">{student.totalPresenceEffectif || 0}</td>
                    <td className="border border-slate-300 p-0">
                      <input type="text" value={student.observation || ""}
                        onChange={(e) => updateStudentField(idx, "observation", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-1 py-1 text-[10px] border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                    </td>
                    <td className="border border-slate-300 p-0">
                      <input type="number" min={0} value={student.nbDemiJournees || 0}
                        onChange={(e) => updateStudentField(idx, "nbDemiJournees", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-1 py-1 text-xs text-center border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
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

          {/* === Section récapitulative (bas du registre) === */}
          <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">
              Récapitulatif du mois — {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Demi-journées du mois</label>
                <input type="number" min={0}
                  value={register.demiJourneeMois || 0}
                  onChange={(e) => updateRegisterField("demiJourneeMois", parseInt(e.target.value) || 0)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm font-bold" />
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
                  <div className="text-xs text-slate-500">Signature et cachet</div>
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
                  <div className="text-xs text-slate-500">Signature</div>
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

      {/* === PAGE 2 — Évaluation certificative mensuelle === */}
      {activeTab === "evaluation" && evaluation && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
          {/* En-tête */}
          <div className="text-center border-b border-slate-300 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              ÉVALUATION CERTIFICATIVE MENSUELLE N° {evaluation.evaluationNumber || "—"}
            </h2>
            <div className="text-sm text-slate-600 mt-1">
              Mois de <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear} — Étape N° {evaluation.etapeNumber || "—"}
            </div>
            <p className="text-xs text-slate-500 mt-1 italic">
              NB : Pour chaque épreuve, l'élève évalué(e) n'aura de bonus de perfectionnement que lorsqu'il(elle) aura atteint la maîtrise minimale fixée.
            </p>
          </div>

          {/* Sélection du seuil de réussite + Bouton config matières */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="text-xs font-bold text-slate-700 uppercase">Seuil de réussite (sur 20)</label>
            <input type="number" step="0.5" min={0} max={20}
              value={evaluation.seuilReussite || 10.0}
              onChange={(e) => setEvaluation({ ...evaluation, seuilReussite: parseFloat(e.target.value) || 10.0 })}
              disabled={isReadOnly}
              className="w-20 px-2 py-1 border border-slate-200 rounded text-sm font-bold" />

            {/* Bouton config matières */}
            <button
              onClick={openSubjectConfig}
              disabled={isReadOnly}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              <Settings className="h-4 w-4" />
              Configurer les matières ({subjectsConfig.length})
            </button>

            {/* Bouton soumettre */}
            {evaluation.status === "DRAFT" && (
              <button onClick={handleSubmitEvaluation} disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                <Send className="h-4 w-4" />
                Soumettre au directeur
              </button>
            )}

            <button onClick={handleSaveEvaluation} disabled={saving || isReadOnly}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>

          {/* Si aucune matière configurée */}
          {subjectsConfig.length === 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <AlertCircle className="h-4 w-4" />
                <span>
                  <strong>Aucune matière configurée.</strong> Cliquez sur "Configurer les matières" pour sélectionner les matières à évaluer.
                </span>
              </div>
            </div>
          )}

          {/* Tableau d'évaluation : matières × CM/CP/Total */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                  {subjectsConfig.map((subj: any, idx: number) => (
                    <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">
                      {subj.subjectName || subj.label || "Matière"}
                    </th>
                  ))}
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total général</th>
                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil atteint</th>
                </tr>
                <tr className="bg-slate-50">
                  {subjectsConfig.flatMap((_: any, idx: number) => ([
                    <th key={`cm-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>,
                    <th key={`cp-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>,
                    <th key={`tot-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>,
                  ]))}
                </tr>
              </thead>
              <tbody>
                {[...studentScores].sort((a: any, b: any) => {
                  const aName = `${a.lastName || a.nom || ''} ${a.firstName || a.prenom || ''}`.trim().toLowerCase();
                  const bName = `${b.lastName || b.nom || ''} ${b.firstName || b.prenom || ''}`.trim().toLowerCase();
                  return aName.localeCompare(bName, 'fr');
                }).map((student: any, sIdx: number) => (
                  <tr key={student.studentId || sIdx} className={cn("hover:bg-slate-50", sIdx % 2 === 1 && "bg-slate-50/50")}>
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{sIdx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-medium">{student.nom} {student.prenom}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                    {(student.scores || []).flatMap((score: any, subIdx: number) => ([
                      <td key={`s${sIdx}-cm${subIdx}`} className="border border-slate-300 p-0">
                        <input type="number" min={0} max={18} step="0.5"
                          value={score.cm || 0}
                          onChange={(e) => updateStudentScore(sIdx, subIdx, "cm", parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          className="w-full px-1 py-1 text-center text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                      </td>,
                      <td key={`s${sIdx}-cp${subIdx}`} className="border border-slate-300 p-0">
                        <input type="number" min={0} max={2} step="0.25"
                          value={score.cp || 0}
                          onChange={(e) => updateStudentScore(sIdx, subIdx, "cp", parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          className="w-full px-1 py-1 text-center text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent" />
                      </td>,
                      <td key={`s${sIdx}-tot${subIdx}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                        {score.total || ((score.cm || 0) + (score.cp || 0))}
                      </td>,
                    ]))}
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                      {student.totalGeneral || 0}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      {(student.totalGeneral || 0) >= (evaluation.seuilReussite || 10.0) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
                {studentScores.length === 0 && (
                  <tr>
                    <td colSpan={4 + subjectsConfig.length * 3} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">
                      Aucun élève. Initialisez le registre d'appel pour charger les élèves.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* === Section récapitulative (évaluation) === */}
          <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Récapitulatif de l'évaluation</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-left">Indicateur</th>
                    <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Garçons</th>
                    <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Filles</th>
                    <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2 font-semibold">Effectif total de la classe</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{evaluation.effectifTotalGarcons ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{evaluation.effectifTotalFilles ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold">{evaluation.effectifTotalClasse ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2 font-semibold">Nombre d'élèves ayant composé</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{evaluation.ayantComposeG ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center">{evaluation.ayantComposeF ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold">{evaluation.ayantComposeTotal ?? "—"}</td>
                  </tr>
                  <tr className="bg-emerald-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-semibold">Ont atteint le seuil de réussite</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{evaluation.ayantAtteintSeuilG ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{evaluation.ayantAtteintSeuilF ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{evaluation.ayantAtteintSeuilTotal ?? "—"}</td>
                  </tr>
                  <tr className="bg-red-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-semibold">N'ont pas atteint le seuil</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{evaluation.nAyantPasAtteintG ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{evaluation.nAyantPasAtteintF ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-700">{evaluation.nAyantPasAtteintTotal ?? "—"}</td>
                  </tr>
                  <tr className="bg-blue-50/50">
                    <td className="border border-slate-300 px-3 py-2 font-bold">% de réussite</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{evaluation.pourcentageReussiteG?.toFixed(2) ?? "—"}%</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{evaluation.pourcentageReussiteF?.toFixed(2) ?? "—"}%</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-800">{evaluation.pourcentageReussiteTotal?.toFixed(2) ?? "—"}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* === Signatures === */}
          <div className="grid grid-cols-2 gap-8 pt-6">
            <div className="border-t-2 border-slate-400 pt-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Le Titulaire de la classe</div>
              <div className="h-16" />
              <div className="text-[10px] text-slate-400">Signature</div>
            </div>
            <div className="border-t-2 border-slate-400 pt-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Le Directeur / La Directrice</div>
              <div className="h-16" />
              <div className="text-[10px] text-slate-400">Signature et cachet</div>
            </div>
          </div>
        </div>
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

      {/* === Modale de configuration des matières === */}
      {showSubjectConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Configurer les matières de l'évaluation</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Évaluation de {MONTH_NAMES[selectedMonth]} {selectedYear} — Classe: {selectedClass?.className || "—"}
                </p>
              </div>
              <button onClick={() => setShowSubjectConfig(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* === Matières sélectionnées === */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-700 uppercase">
                    Matières de l'évaluation ({selectedSubjects.length})
                  </h4>
                </div>
                {selectedSubjects.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg">
                    Aucune matière sélectionnée. Ajoutez des matières ci-dessous.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSubjects.map((subj, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-emerald-600 text-white text-xs font-bold rounded">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={subj.subjectName}
                          onChange={(e) => setSelectedSubjects(prev => prev.map((s, i) =>
                            i === idx ? { ...s, subjectName: e.target.value } : s
                          ))}
                          className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded bg-white"
                        />
                        <input
                          type="number"
                          step="0.5"
                          min={0.5}
                          value={subj.coefficient || 1}
                          onChange={(e) => setSelectedSubjects(prev => prev.map((s, i) =>
                            i === idx ? { ...s, coefficient: parseFloat(e.target.value) || 1 } : s
                          ))}
                          title="Coefficient"
                          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded bg-white"
                          placeholder="Coef."
                        />
                        <button
                          onClick={() => removeSubject(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* === Ajout d'une matière personnalisée === */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-2">
                  Ajouter une matière personnalisée
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomSubject()}
                    placeholder="Nom de la matière (ex: Communication orale, Mathématiques...)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                  <button
                    onClick={addCustomSubject}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" /> Ajouter
                  </button>
                </div>
              </div>

              {/* === Matières disponibles (depuis le système) === */}
              {loadingSubjects ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
                  <span className="text-sm text-slate-500">Chargement des matières...</span>
                </div>
              ) : availableSubjects.length > 0 ? (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 uppercase mb-2">
                    Matières disponibles pour cette classe ({availableSubjects.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {availableSubjects.map((subj, idx) => {
                      const alreadyAdded = selectedSubjects.find(s => s.subjectName === subj.subjectName);
                      return (
                        <button
                          key={subj.subjectId || idx}
                          onClick={() => addAvailableSubject(subj)}
                          disabled={!!alreadyAdded}
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-xs font-medium text-left transition-all",
                            alreadyAdded
                              ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 cursor-pointer"
                          )}
                        >
                          <span className="truncate">{subj.subjectName}</span>
                          {alreadyAdded ? (
                            <CheckCircle2 className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          ) : (
                            <Plus className="h-3 w-3 text-blue-600 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-semibold mb-1">Aucune matière configurée pour cette classe.</p>
                      <p className="text-xs">
                        L'administration de l'école doit d'abord configurer les matières dans le module
                        <strong> Matières </strong> (table class_subjects). Une fois les matières assignées à cette classe,
                        elles apparaîtront ici automatiquement.
                      </p>
                      <p className="text-xs mt-2">
                        En attendant, vous pouvez ajouter manuellement des matières personnalisées dans la section ci-dessus.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* === Aide === */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <strong>Rappel :</strong> Chaque matière est notée sur 20 points répartis comme suit :
                <ul className="mt-1 ml-4 list-disc">
                  <li><strong>CM (Critère Maîtrise)</strong> : noté sur 18 points</li>
                  <li><strong>CP (Critère Perfectionnement)</strong> : noté sur 2 points (bonus)</li>
                  <li><strong>Total</strong> = CM + CP (sur 20)</li>
                </ul>
                <div className="mt-2">Les scores des élèves seront automatiquement initialisés à 0 pour chaque matière ajoutée.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowSubjectConfig(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveSubjects}
                disabled={saving || selectedSubjects.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer la configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
