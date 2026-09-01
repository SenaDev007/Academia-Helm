"use client";

/**
 * ============================================================================
 * ÉVALUATION MENSUELLE — Récupération dynamique depuis le Module Examen
 * ============================================================================
 *
 * Cette API remplace l'ancien modèle local (pedagogy-space/monthly-evaluations).
 * Elle récupère dynamiquement les évaluations validées par l'enseignant depuis
 * le Module Examen (status=OPEN_FOR_GRADING ou SUBMITTED ou VALIDATED).
 *
 * ⭐ Le tableau affiché est EXACTEMENT le même que celui du Module Examen
 *    (GradingSheet.tsx) — mêmes colonnes, mêmes couleurs, mêmes calculs :
 *    N° | Nom | Sexe | Présence | [Matières CM/CP/Total ou TS/S/PS] |
 *    Total gén. | Rang | Seuil fixé | Seuil atteint Oui/Non |
 *    Appréciation globale (Maternelle) | Observation
 *
 * Flux :
 *   1. L'admin crée une évaluation (Module Examen → Évaluations) → status=PLANNED
 *   2. L'enseignant saisit les notes + clique "Valider" (Module Examen → Saisie
 *      des notes) → status=OPEN_FOR_GRADING (notes validées par l'enseignant)
 *   3. L'enseignant ouvre l'Espace Pédagogique → Registre d'Appel → Évaluation
 *      mensuelle : cette page récupère dynamiquement les évaluations OPEN_FOR_GRADING
 *      + affiche le même tableau que le Module Examen (read-only)
 *   4. L'enseignant signe + clique "Soumettre au directeur" → status=SUBMITTED
 *   5. L'admin valide → status=VALIDATED (verrouillé)
 *
 * Lorsque RIEN n'est encore soumis → message clair.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, FileText, AlertCircle, CheckCircle2,
  Send, RefreshCw, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import apiClient from "@/lib/api/client";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
// ⭐ Import des helpers partagés avec GradingSheet pour calculs identiques
import {
  formatRang,
  computeAppreciationGlobale,
  getSubjectOrderIndex,
} from "@/components/exams/GradingSheet";
// ⭐ Export PDF professionnel (même template que module Finance)
import { exportMonthlyEvaluationToPdf } from "@/lib/exports/pedagogy-exports";
import { useModuleContext } from "@/hooks/useModuleContext";
import { translateClassName } from "@/lib/pedagogy/class-name-en";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// ⭐ Translate nursery appreciation labels from the shared GradingSheet helper
//    (which returns French strings) to English for the EN track.
const APPRECIATION_EN: Record<string, string> = {
  'Très Satisfaisant': 'Very Satisfactory',
  'Satisfaisant': 'Satisfactory',
  'Peu Satisfaisant': 'Less Satisfactory',
};
function translateAppreciation(label: string | undefined | null): string {
  if (!label) return '';
  return APPRECIATION_EN[label] || label;
}

interface MonthlyEvaluationTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  classId: string;
  className: string;
  selectedMonth: number;
  selectedYear: number;
  teacherName: string;
  directorName: string;
  isMaternelle: boolean;
  isReadOnly: boolean;
  onSignaturesChange?: (teacherSig: string | null, directorSig: string | null) => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string; schoolLevel?: { code: string; name: string } };
  subject?: { id: string; name: string; language?: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  maxScore?: number;
  _count?: { grades: number };
}

// ⭐ Format IDENTIQUE au backend GradesService.getGradingSheet()
interface GradeRow {
  studentId: string;
  matricule?: string;
  studentName: string;
  gender?: string;
  scores: Record<string, {
    score: number | null;
    cm: number | null;
    cp: number | null;
    qualitativeCode: 'TS' | 'S' | 'PS' | null;
    isAbsent: boolean;
    comment?: string;
  }>;
}

interface GroupedEvaluation {
  key: string;
  classId: string;
  className: string;
  evaluationTypeId: string;
  evaluationTypeName: string;
  periodId: string;
  periodName: string;
  startDate: string | null;
  endDate: string | null;
  subjects: Array<{ id: string; name: string }>;
  evaluationIds: string[];
  statuses: string[];
  firstEvaluation: Evaluation;
  // Grades fetched per evaluation (evaluationId → students with grades)
  gradesByEvaluation: Record<string, any[]>;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Composant principal ────────────────────────────────────────────────────

export function MonthlyEvaluationTab({
  tenantId,
  academicYearId,
  teacherId,
  classId,
  className,
  selectedMonth,
  selectedYear,
  teacherName,
  directorName,
  isMaternelle,
  isReadOnly,
  onSignaturesChange,
}: MonthlyEvaluationTabProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupedEvaluation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null); // group.key being submitted
  // Signatures par groupe (groupKey → { teacher, director })
  const [signatures, setSignatures] = useState<Record<string, { teacher: string | null; director: string | null }>>({});
  // ⭐ Modal de confirmation professionnel (remplace window.confirm)
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();
  // ⭐ Contexte module (pour tenant + schoolLevel dans le PDF)
  const { tenant, schoolLevel } = useModuleContext();
  // ⭐ Infos école (pour export PDF)
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    logoUrl: string | null;
    address: string;
    phone: string;
    email: string;
  } | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ─── Déterminer isPrimaire vs isSecondaire ────────────────────────────────
  // Pour l'instant on suppose Primaire si pas Maternelle.
  // TODO: passer isSecondaire en prop si on veut gérer le secondaire ici aussi.
  const isPrimaire = !isMaternelle;
  const isSecondaire = false;

  // ─── Charger les infos de l'école (pour export PDF) ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSchoolInfo({
            name: data.schoolName || data.name || data.tenantName || 'School establishment',
            logoUrl: data.logoUrl || data.logo || null,
            address: data.address || data.schoolAddress || '',
            phone: data.phone || data.schoolPhone || '',
            email: data.email || data.schoolEmail || '',
          });
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ─── Charger les évaluations validées par l'enseignant pour cette classe ────
  const loadEvaluations = useCallback(async () => {
    if (!classId || !academicYearId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ⭐ Récupérer TOUTES les évaluations de cette classe pour cette année académique
      // avec les statuts OPEN_FOR_GRADING, SUBMITTED, VALIDATED
      const response = await apiClient.get(`/institutional-exams/evaluations`, {
        params: {
          academicYearId,
          classId,
          status: 'OPEN_FOR_GRADING,SUBMITTED,VALIDATED,LOCKED',
        },
      });
      const allEvaluations: Evaluation[] = Array.isArray(response.data) ? response.data : [];

      // ⭐ FILTRER par mois/année (basé sur evaluationDate ou startDate ou endDate)
      //    Le sélecteur mois/année du registre d'appel filtre maintenant aussi
      //    les évaluations mensuelles affichées.
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      const filtered = allEvaluations.filter(ev => {
        const dateStr = ev.evaluationDate || ev.startDate || ev.endDate;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= monthStart && d <= monthEnd;
      });

      // ⭐ Grouper par (classId × evaluationTypeId × periodId × startDate × endDate)
      //    Identique à HierarchicalEvaluationList pour rester cohérent
      const groupMap = new Map<string, GroupedEvaluation>();
      for (const ev of filtered) {
        const key = `${ev.class?.id || classId}__${ev.evaluationType?.id || ''}__${ev.period?.id || ''}__${ev.startDate || ''}__${ev.endDate || ''}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            classId: ev.class?.id || classId,
            className: ev.class?.name || className,
            evaluationTypeId: ev.evaluationType?.id || '',
            evaluationTypeName: ev.evaluationType?.name || 'Evaluation',
            periodId: ev.period?.id || '',
            periodName: ev.period?.name || '',
            startDate: ev.startDate || ev.evaluationDate || null,
            endDate: ev.endDate || ev.evaluationDate || null,
            subjects: [],
            evaluationIds: [],
            statuses: [],
            firstEvaluation: ev,
            gradesByEvaluation: {},
          });
        }
        const g = groupMap.get(key)!;
        if (ev.subject?.id && !g.subjects.find(s => s.id === ev.subject!.id)) {
          g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
        }
        if (!g.evaluationIds.includes(ev.id)) g.evaluationIds.push(ev.id);
        if (!g.statuses.includes(ev.status)) g.statuses.push(ev.status);
      }

      // ⭐ Pour chaque groupe, charger les grades (élèves + scores) pour chaque évaluation
      const groupsWithGrades: GroupedEvaluation[] = [];
      for (const g of Array.from(groupMap.values())) {
        const gradesByEvaluation: Record<string, any[]> = {};
        await Promise.all(
          g.evaluationIds.map(async (evId) => {
            try {
              const res = await apiClient.get(`/institutional-exams/grades/evaluation/${evId}`);
              gradesByEvaluation[evId] = Array.isArray(res.data) ? res.data : [];
            } catch (err) {
              console.warn(`Failed to load grades for evaluation ${evId}`, err);
              gradesByEvaluation[evId] = [];
            }
          })
        );
        groupsWithGrades.push({ ...g, gradesByEvaluation });
      }

      // ⭐ Trier les groupes par date (plus récent en premier)
      groupsWithGrades.sort((a, b) => {
        const da = new Date(a.startDate || a.firstEvaluation.evaluationDate || 0).getTime();
        const db = new Date(b.startDate || b.firstEvaluation.evaluationDate || 0).getTime();
        return db - da;
      });

      setGroups(groupsWithGrades);
    } catch (err: any) {
      console.error('Error loading evaluations:', err);
      setError(err.message || 'Error loading evaluations');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [classId, academicYearId, className, selectedMonth, selectedYear]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // ─── Construire les lignes d'élèves pour un groupe ────────────────────────
  // Format IDENTIQUE au backend : studentId, studentName, matricule, gender,
  // score, cm, cp, qualitativeCode, isAbsent, comment, status
  const buildRows = useCallback((group: GroupedEvaluation): GradeRow[] => {
    const rowMap = new Map<string, GradeRow>();
    for (const evId of group.evaluationIds) {
      const evIndex = group.evaluationIds.indexOf(evId);
      const subjectId = group.subjects[evIndex]?.id;
      if (!subjectId) continue;
      const grades = group.gradesByEvaluation[evId] || [];
      for (const grade of grades) {
        const studentId = grade.studentId || grade.student?.id;
        if (!studentId) continue;
        if (!rowMap.has(studentId)) {
          // ⭐ Le backend retourne studentName + matricule + gender directement
          rowMap.set(studentId, {
            studentId,
            matricule: grade.matricule || grade.student?.matricule || '',
            studentName: grade.studentName || `${grade.student?.lastName || ''} ${grade.student?.firstName || ''}`.trim(),
            gender: grade.gender || grade.student?.gender || '',
            scores: {},
          });
        }
        const row = rowMap.get(studentId)!;
        // ⭐ cm/cp sont déjà parsés par le backend (GradesService.getGradingSheet)
        row.scores[subjectId] = {
          score: grade.score ?? null,
          cm: grade.cm ?? null,
          cp: grade.cp ?? null,
          qualitativeCode: grade.qualitativeCode || null,
          isAbsent: grade.isAbsent || false,
          comment: grade.comment,
        };
      }
    }
    // Trier par nom (comme dans GradingSheet)
    return Array.from(rowMap.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName, 'fr')
    );
  }, []);

  // ─── Trier les matières comme dans GradingSheet ─────────────────────────────
  const sortSubjects = useCallback((subjects: Array<{ id: string; name: string }>) => {
    return [...subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [isMaternelle, isPrimaire]);

  // ─── Statistiques par groupe ────────────────────────────────────────────────
  // ⭐ Logique de calcul du seuil de réussite (selon exigence utilisateur) :
  //    moyenne = totalGeneral / nb_matières_évaluées
  //    seuil fixé = 10/20 (Primaire/Secondaire)
  //    seuil atteint si moyenne ≥ 10
  //    Pour Maternelle : seuil atteint si appréciation = "Très Satisfaisant" ou "Satisfaisant"
  //    "Ayant composé" = l'élève n'était PAS absent à toutes les matières
  //      (i.e. il a participé à au moins une matière — pas la même chose qu'avoir un total > 0)
  const computeStats = useCallback((group: GroupedEvaluation, rows: GradeRow[], sortedSubjects: Array<{ id: string; name: string }>) => {
    let totalG = 0, totalF = 0;
    let composeG = 0, composeF = 0;
    let atteintG = 0, atteintF = 0;
    // Seuil fixé (affiché dans le tableau) : 10/20 par matière
    const seuilFixe = 10;

    for (const row of rows) {
      const sexe = (row.gender || '').toUpperCase();
      let hasComposed = false; // l'élève a participé à au moins une matière
      let totalGeneral = 0;
      let nbMatieresEvaluees = 0; // matières où l'élève n'était pas absent

      for (const subj of sortedSubjects) {
        const s = row.scores[subj.id];
        if (!s) continue;
        if (s.isAbsent) continue; // absent → ne compte pas
        // L'élève a composé s'il a au moins une note (non absent) dans une matière
        if (isMaternelle) {
          if (s.qualitativeCode) {
            hasComposed = true;
            nbMatieresEvaluees++;
          }
        } else if (isSecondaire) {
          if (s.score !== null && s.score !== undefined) {
            hasComposed = true;
            nbMatieresEvaluees++;
            totalGeneral += s.score;
          }
        } else {
          // Primaire : CM + CP
          if (s.cm !== null || s.cp !== null) {
            hasComposed = true;
            nbMatieresEvaluees++;
            totalGeneral += (s.cm ?? 0) + (s.cp ?? 0);
          }
        }
      }

      // ⭐ Moyenne = totalGeneral / nb_matières_évaluées
      //    (chaque matière est sur 20, donc la moyenne est sur 20)
      //    Si l'élève n'a composé à aucune matière → moyenne = 0
      const moyenne = nbMatieresEvaluees > 0 ? totalGeneral / nbMatieresEvaluees : 0;

      // ⭐ Seuil atteint :
      //    - Primaire/Secondaire : moyenne >= 10
      //    - Maternelle : appréciation globale = Très Satisfaisant ou Satisfaisant
      let aAtteintSeuil = false;
      if (isMaternelle) {
        const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
        aAtteintSeuil = (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant');
      } else {
        aAtteintSeuil = hasComposed && moyenne >= seuilFixe;
      }

      if (sexe === 'M' || sexe === 'G' || sexe === 'MALE') {
        totalG++;
        if (hasComposed) composeG++;
        if (aAtteintSeuil) atteintG++;
      } else if (sexe === 'F' || sexe === 'FEMALE') {
        totalF++;
        if (hasComposed) composeF++;
        if (aAtteintSeuil) atteintF++;
      }
    }

    const totalC = totalG + totalF;
    const composeC = composeG + composeF;
    const atteintC = atteintG + atteintF;
    return {
      effectifG: totalG, effectifF: totalF, effectifTotal: totalC,
      ayantComposeG: composeG, ayantComposeF: composeF, ayantComposeTotal: composeC,
      ayantAtteintSeuilG: atteintG, ayantAtteintSeuilF: atteintF, ayantAtteintSeuilTotal: atteintC,
      nAyantPasAtteintG: composeG - atteintG, // ⭐ base = ayant composé (pas effectif total)
      nAyantPasAtteintF: composeF - atteintF,
      nAyantPasAtteintTotal: composeC - atteintC,
      // ⭐ Pourcentage de réussite = (ayant atteint le seuil / ayant composé) × 100
      //    (base = ayant composé, car on ne peut pas réussir sans avoir composé)
      pourcentageReussiteG: composeG > 0 ? (atteintG / composeG) * 100 : 0,
      pourcentageReussiteF: composeF > 0 ? (atteintF / composeF) * 100 : 0,
      pourcentageReussiteTotal: composeC > 0 ? (atteintC / composeC) * 100 : 0,
      seuilFixe,
    };
  }, [isMaternelle, isSecondaire]);

  // ─── Soumettre au directeur ─────────────────────────────────────────────────
  const handleSubmitToDirector = async (group: GroupedEvaluation) => {
    const sig = signatures[group.key];
    if (!sig?.teacher) {
      toast.error("Signature required", {
        description: "You must sign before submitting to the director.",
      });
      return;
    }
    // ⭐ Professional modal (replaces window.confirm)
    const ok = await confirmWarning(
      `Do you want to submit this evaluation to the director?`,
      'Submission to director',
      `Class: ${translateClassName(group.className)}\n` +
      `Period: ${group.periodName || '—'}\n` +
      `Type: ${group.evaluationTypeName}\n\n` +
      `This action is irreversible. You will not be able to modify the grades after submission.`
    );
    if (!ok) return;
    setSubmitting(group.key);
    try {
      const errors: string[] = [];
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          try {
            await apiClient.patch(`/institutional-exams/evaluations/${evId}/submit`);
          } catch (err: any) {
            const msg = err.response?.data?.message || err.message || '';
            if (msg.includes('must be') || err.response?.status === 400) {
              console.warn(`Evaluation ${evId} already submitted or invalid status, ignored`);
              return;
            }
            console.error(`Failed to submit evaluation ${evId}:`, err.response?.data || err.message);
            errors.push(evId);
          }
        })
      );
      if (errors.length > 0) {
        throw new Error(`Failed to submit ${errors.length} evaluation(s).`);
      }
      toast.success("Evaluation submitted to director", {
        description: "You can track validation in the Exams Module.",
      });
      await loadEvaluations();
    } catch (err: any) {
      toast.error("Submission error", { description: err.message });
    } finally {
      setSubmitting(null);
    }
  };

  // ─── Export PDF professionnel (même template que module Finance) ─────────────
  //    Utilise jsPDF + autotable + drawOfficialHeader (drapeau Bénin + République
  //    + Ministère + école + logo) + drawFooter (numéro page + timestamp).
  //    Orientation paysage, pagination automatique, tableau non tronqué.
  const handleExportPDF = async (group: GroupedEvaluation) => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const rows = buildRows(group);
      const sortedSubjects = sortSubjects(group.subjects);
      const stats = computeStats(group, rows, sortedSubjects);
      const sig = signatures[group.key] || { teacher: null, director: null };
      const startDate = group.startDate ? new Date(group.startDate) : null;
      const endDate = group.endDate ? new Date(group.endDate) : null;
      const sameDay = startDate && endDate &&
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();
      const dateRange = startDate
        ? sameDay || !endDate
          ? `On ${startDate.toLocaleDateString('en-GB')}`
          : `From ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`
        : 'Date not defined';

      // ⭐ Construire les lignes d'évaluation au format attendu par le PDF
      const evalRows = rows.map((row, idx) => {
        let totalGeneral = 0;
        let nbMatieresEvaluees = 0;
        const scores = sortedSubjects.map((subj) => {
          const s = row.scores[subj.id] || { cm: null, cp: null, score: null, qualitativeCode: null, isAbsent: false };
          if (s.isAbsent) return { cm: null, cp: null, total: 0, qualitativeCode: null, isAbsent: true };
          const cm = s.cm ?? null;
          const cp = s.cp ?? null;
          const total = (cm !== null ? cm : 0) + (cp !== null ? cp : 0);
          if (cm !== null || cp !== null) {
            nbMatieresEvaluees++;
            totalGeneral += total;
          }
          return { cm, cp, total, qualitativeCode: s.qualitativeCode, isAbsent: false };
        });
        const moyenne = nbMatieresEvaluees > 0 ? totalGeneral / nbMatieresEvaluees : 0;
        const seuilAtteint = isMaternelle ? null : (nbMatieresEvaluees > 0 && moyenne >= 10);
        // Rang
        const sortedByTotal = [...rows].map((r) => ({
          id: r.studentId,
          total: sortedSubjects.reduce((sum, subj) => {
            const sc = r.scores[subj.id];
            if (!sc || sc.isAbsent) return sum;
            if (isMaternelle) {
              if (sc.qualitativeCode === 'TS') return sum + 3;
              if (sc.qualitativeCode === 'S') return sum + 2;
              if (sc.qualitativeCode === 'PS') return sum + 1;
              return sum;
            }
            return sum + (sc.cm ?? 0) + (sc.cp ?? 0);
          }, 0),
        })).sort((a, b) => b.total - a.total);
        const rang = sortedByTotal.findIndex((r) => r.id === row.studentId) + 1;
        const appreciation = isMaternelle ? computeAppreciationGlobale(row.scores, sortedSubjects) : undefined;
        return {
          numero: idx + 1,
          studentName: row.studentName,
          sexe: (row.gender || '').startsWith('F') ? 'F' : 'M',
          scores,
          totalGeneral,
          moyenne,
          rang,
          seuilAtteint: seuilAtteint ?? false,
          appreciation,
        };
      });

      // ⭐ Stats au format attendu par le PDF
      const recap = {
        effectifG: stats.effectifG,
        effectifF: stats.effectifF,
        effectifTotal: stats.effectifTotal,
        ayantComposeG: stats.ayantComposeG,
        ayantComposeF: stats.ayantComposeF,
        ayantComposeTotal: stats.ayantComposeTotal,
        ayantAtteintSeuilG: stats.ayantAtteintSeuilG,
        ayantAtteintSeuilF: stats.ayantAtteintSeuilF,
        ayantAtteintSeuilTotal: stats.ayantAtteintSeuilTotal,
        nAyantPasAtteintG: stats.nAyantPasAtteintG,
        nAyantPasAtteintF: stats.nAyantPasAtteintF,
        nAyantPasAtteintTotal: stats.nAyantPasAtteintTotal,
        pourcentageReussiteG: stats.pourcentageReussiteG,
        pourcentageReussiteF: stats.pourcentageReussiteF,
        pourcentageReussiteTotal: stats.pourcentageReussiteTotal,
      };

      // ⭐ School header (same structure as Finance module)
      const header = {
        schoolName: schoolInfo?.name || tenant?.name || 'School establishment',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : schoolInfo?.logoUrl,
        schoolAddress: schoolInfo?.address || tenant?.address || null,
        schoolPhone: schoolInfo?.phone || tenant?.phone || null,
        schoolEmail: schoolInfo?.email || tenant?.email || null,
        schoolLevel: schoolLevel?.code || (isMaternelle ? 'MATERNELLE' : 'PRIMAIRE'),
      };

      await exportMonthlyEvaluationToPdf({
        header,
        className: translateClassName(group.className),
        periodName: group.periodName || MONTH_NAMES[selectedMonth] + ' ' + selectedYear,
        dateRange,
        evaluationTypeName: group.evaluationTypeName,
        isMaternelle,
        subjects: sortedSubjects,
        rows: evalRows,
        recap,
        signatures: {
          teacherName: teacherName || 'Teacher name',
          directorName: directorName || 'Director name',
          teacherSignature: sig.teacher,
          directorSignature: sig.director,
        },
      });

      toast.success('PDF generated successfully', {
        description: 'The PDF has been downloaded with official header.',
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('PDF export error', { description: err.message });
    } finally {
      setExportingPdf(false);
    }
  };


  // ─── Rendu ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border-2 border-slate-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span className="text-sm text-slate-600">Loading validated evaluations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-red-200 rounded-xl p-8">
        <div className="flex items-start gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Loading error</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={loadEvaluations}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white border-2 border-slate-200 rounded-xl p-8">
        <div className="text-center max-w-2xl mx-auto py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            No evaluation for {MONTH_NAMES[selectedMonth]} {selectedYear}
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            No evaluation has been entered and validated by the teacher for class
            <strong> {translateClassName(className)}</strong> for the month of
            <strong> {MONTH_NAMES[selectedMonth]} {selectedYear}</strong>.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">Procedure:</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>The administration creates an evaluation in <strong>Exams Module → Evaluations</strong>.</li>
              <li>The teacher enters grades in <strong>Exams Module → Grade entry</strong>.</li>
              <li>The teacher clicks <strong>"Validate"</strong> to validate the entry.</li>
              <li>The validated evaluation appears here automatically for signature and submission to the director.</li>
            </ol>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            💡 You can change the month/year in the selector at the top to view evaluations from another month.
          </p>
          <button
            onClick={loadEvaluations}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Evaluations validated by the teacher — {MONTH_NAMES[selectedMonth]} {selectedYear}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {groups.length} evaluation(s) · Class: {translateClassName(className)}
          </p>
        </div>
        <button
          onClick={loadEvaluations}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Pour chaque groupe d'évaluations */}
      {groups.map((group) => {
        const rows = buildRows(group);
        const sortedSubjects = sortSubjects(group.subjects);
        const stats = computeStats(group, rows, sortedSubjects);
        const sig = signatures[group.key] || { teacher: null, director: null };
        const allSubmitted = group.statuses.every(s => s === 'SUBMITTED' || s === 'VALIDATED' || s === 'LOCKED');
        const allValidated = group.statuses.every(s => s === 'VALIDATED' || s === 'LOCKED');
        const startDate = group.startDate ? new Date(group.startDate) : null;
        const endDate = group.endDate ? new Date(group.endDate) : null;
        const sameDay = startDate && endDate &&
          startDate.getFullYear() === endDate.getFullYear() &&
          startDate.getMonth() === endDate.getMonth() &&
          startDate.getDate() === endDate.getDate();
        const dateRange = startDate
          ? sameDay || !endDate
            ? `On ${startDate.toLocaleDateString('en-GB')}`
            : `From ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}`
          : 'Date not defined';

        return (
          <div key={group.key} className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
            {/* Header */}
            <div className="text-center border-b border-slate-300 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {group.firstEvaluation.title || `MONTHLY EVALUATION — ${group.evaluationTypeName}`}
              </h2>
              <div className="text-sm text-slate-600 mt-1">
                Class: <strong>{translateClassName(group.className)}</strong>
                {group.periodName && ` — ${group.periodName}`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dateRange} · {group.evaluationTypeName}
              </div>
              <p className="text-xs text-slate-500 mt-1 italic">
                NB: For each test, the evaluated student will receive a perfection bonus only when they have reached the minimum mastery set.
              </p>
              {/* Status badge */}
              <div className="mt-2">
                {allValidated ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Validated by administration — Grades locked
                  </span>
                ) : allSubmitted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                    <Send className="h-3 w-3" />
                    Submitted to director — Pending validation
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Validated by teacher — Ready to sign
                  </span>
                )}
              </div>
            </div>

            {/* Actions: Signature required + Submit button */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {allSubmitted
                  ? "This evaluation has been submitted to the director."
                  : allValidated
                  ? "This evaluation has been validated by the administration."
                  : "You must sign before submitting to the director."}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {/* ⭐ PDF Export button — visible for all statuses */}
                <button
                  onClick={() => handleExportPDF(group)}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  title="Export to professional PDF (official header)"
                >
                  {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                  {exportingPdf ? 'Generating...' : 'Export PDF'}
                </button>
                {/* ⭐ Submit to director button REMOVED — now handled by the
                    unified button in the attendance register header (which submits
                    register + monthly evaluation + journal notebook at once) */}
                {!allSubmitted && !allValidated && (
                  <span className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg font-semibold">
                    {!sig.teacher
                      ? "⚠ Signature required before submission (unified button at top)"
                      : "✓ Ready for submission (unified button at top)"}
                  </span>
                )}
              </div>
            </div>

            {/* ⭐ Tableau IDENTIQUE au Module Examen (GradingSheet) — read-only */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">No.</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Full name</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Gender</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Presence</th>
                    {sortedSubjects.map((subject, idx) => (
                      isMaternelle ? (
                        <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                          {subject.name}
                          <div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                        </th>
                      ) : isSecondaire ? (
                        <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                          {subject.name}
                          <div className="text-[9px] text-slate-400 font-normal">Grade /20</div>
                        </th>
                      ) : (
                        <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">
                          {subject.name}
                        </th>
                      )
                    ))}
                    {!isMaternelle && !isSecondaire && (
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gen.</th>
                    )}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rank</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Set threshold</th>
                    <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Threshold reached</th>
                    {isMaternelle && (
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Global appreciation</th>
                    )}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Observation</th>
                  </tr>
                  {!isSecondaire && !isMaternelle && (
                    <tr className="bg-slate-50">
                      {sortedSubjects.map((_, idx) => (
                        <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                      ))}
                      {sortedSubjects.map((_, idx) => (
                        <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                      ))}
                      {sortedSubjects.map((_, idx) => (
                        <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                      ))}
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Yes</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">No</th>
                    </tr>
                  )}
                  {isMaternelle && (
                    <tr className="bg-slate-50">
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Yes</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">No</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    // ⭐ Calculs IDENTIQUES au récapitulatif (computeStats)
                    //    moyenne = totalGeneral / nb_matières_évaluées
                    //    seuil atteint si moyenne >= 10 (Primaire/Secondaire)
                    let totalGeneral = 0;
                    let nbMatieresEvaluees = 0;
                    let hasComposed = false;
                    for (const subj of sortedSubjects) {
                      const s = row.scores[subj.id];
                      if (!s || s.isAbsent) continue;
                      if (isMaternelle) {
                        if (s.qualitativeCode) {
                          hasComposed = true;
                          nbMatieresEvaluees++;
                        }
                      } else if (isSecondaire) {
                        if (s.score !== null && s.score !== undefined) {
                          hasComposed = true;
                          nbMatieresEvaluees++;
                          totalGeneral += s.score;
                        }
                      } else {
                        // Primaire : CM + CP
                        if (s.cm !== null || s.cp !== null) {
                          hasComposed = true;
                          nbMatieresEvaluees++;
                          totalGeneral += (s.cm ?? 0) + (s.cp ?? 0);
                        }
                      }
                    }
                    const moyenne = nbMatieresEvaluees > 0 ? totalGeneral / nbMatieresEvaluees : 0;
                    // ⭐ Seuil atteint :
                    //    - Primaire/Secondaire : moyenne >= 10
                    //    - Maternelle : appréciation = Très Satisfaisant ou Satisfaisant
                    const seuilAtteint = isMaternelle ? null : (
                      hasComposed && moyenne >= 10
                    );
                    // ⭐ Calcul du rang avec formatRang (comme GradingSheet)
                    const rang = (() => {
                      const sortedByTotal = [...rows]
                        .map((r) => ({
                          id: r.studentId,
                          total: sortedSubjects.reduce((sum, subj) => {
                            const s = r.scores[subj.id];
                            if (!s || s.isAbsent) return sum;
                            if (isMaternelle) {
                              if (s.qualitativeCode === 'TS') return sum + 3;
                              if (s.qualitativeCode === 'S') return sum + 2;
                              if (s.qualitativeCode === 'PS') return sum + 1;
                              return sum;
                            }
                            if (isSecondaire) return sum + (typeof s.score === 'number' ? s.score : 0);
                            const cm = s.cm ?? 0;
                            const cp = s.cp ?? 0;
                            return sum + cm + cp;
                          }, 0),
                        }))
                        .sort((a, b) => b.total - a.total);
                      return sortedByTotal.findIndex((r) => r.id === row.studentId) + 1;
                    })();

                    return (
                      <tr
                        key={row.studentId}
                        className={cn(
                          'hover:bg-slate-50 transition-colors',
                          idx % 2 === 1 && 'bg-slate-50/50',
                          Object.values(row.scores).some(s => s?.isAbsent) && 'bg-red-50/30'
                        )}
                      >
                        <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900">{row.studentName}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {row.gender === 'M' || row.gender === 'MALE' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                          ) : row.gender === 'F' || row.gender === 'FEMALE' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                          ) : '—'}
                        </td>
                        {/* Colonne Présence (read-only display) */}
                        <td className="border border-slate-300 px-1 py-1 text-center">
                          {(() => {
                            const allPresent = !Object.values(row.scores).some((s) => s?.isAbsent);
                            const allAbsent = sortedSubjects.every((subj) => row.scores[subj.id]?.isAbsent);
                            const isMixed = !allPresent && !allAbsent;
                            return (
                              <div className="flex gap-0.5 justify-center items-center">
                                <span className={cn(
                                  'px-2 py-1 rounded text-xs font-bold',
                                  allPresent ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'
                                )}>P</span>
                                <span className={cn(
                                  'px-2 py-1 rounded text-xs font-bold',
                                  allAbsent ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                                )}>A</span>
                                {isMixed && (
                                  <span className="text-[9px] font-bold text-amber-600 ml-0.5" title="Mixed presence">⚠</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Matières (read-only display) */}
                        {sortedSubjects.map((subject) => {
                          const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                          if (isMaternelle) {
                            // Maternelle : TS/S/PS en badges colorés
                            return (
                              <td key={subject.id} className="border border-slate-300 px-1 py-1 text-center">
                                {score.isAbsent ? (
                                  <span className="text-xs text-red-500">—</span>
                                ) : score.qualitativeCode ? (
                                  <span className={cn(
                                    'inline-block px-2 py-1 rounded text-xs font-bold',
                                    score.qualitativeCode === 'TS' && 'bg-emerald-600 text-white',
                                    score.qualitativeCode === 'S' && 'bg-blue-600 text-white',
                                    score.qualitativeCode === 'PS' && 'bg-amber-600 text-white',
                                  )}>
                                    {score.qualitativeCode}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            );
                          }
                          if (isSecondaire) {
                            // Secondaire : note /20
                            return (
                              <td key={subject.id} className="border border-slate-300 px-1 py-1 text-center">
                                <span className={cn(
                                  'text-xs font-bold',
                                  score.isAbsent && 'text-red-500',
                                  !score.isAbsent && score.score !== null && typeof score.score === 'number' &&
                                    (Number(score.score) < 10 ? 'text-rose-600' : Number(score.score) >= 14 ? 'text-emerald-600' : 'text-slate-900')
                                )}>
                                  {score.isAbsent ? '—' : (score.score ?? '—')}
                                </span>
                              </td>
                            );
                          }
                          // Primaire : CM/CP/Total (read-only display)
                          const cmValue = score.cm ?? null;
                          const cpValue = score.cp ?? null;
                          const totalValue = (cmValue !== null ? cmValue : 0) + (cpValue !== null ? cpValue : 0);
                          return (
                            <>
                              <td key={`cm-${subject.id}`} className="border border-slate-300 px-1 py-1 text-center">
                                <span className={cn(
                                  'text-xs font-bold',
                                  score.isAbsent && 'text-red-500',
                                  !score.isAbsent && cmValue !== null && typeof cmValue === 'number' &&
                                    (Number(cmValue) < 10 ? 'text-rose-600' : Number(cmValue) >= 14 ? 'text-emerald-600' : 'text-slate-900')
                                )}>
                                  {score.isAbsent ? '—' : (cmValue ?? '—')}
                                </span>
                              </td>
                              <td key={`cp-${subject.id}`} className="border border-slate-300 px-1 py-1 text-center">
                                <span className={cn(
                                  'text-xs font-bold',
                                  (score.isAbsent || cmValue === null || cmValue < 10) ? 'text-slate-400' : 'text-slate-900'
                                )}>
                                  {score.isAbsent ? '—' : (cpValue ?? '—')}
                                </span>
                              </td>
                              <td key={`tot-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                                {score.isAbsent ? '—' : (cmValue !== null || cpValue !== null ? Number(totalValue).toFixed(2) : '—')}
                              </td>
                            </>
                          );
                        })}
                        {/* Total général */}
                        {!isMaternelle && !isSecondaire && (
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                            {hasComposed ? totalGeneral.toFixed(2) : '—'}
                          </td>
                        )}
                        {/* Rang */}
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                          {formatRang(rang, row.gender)}
                        </td>
                        {/* Seuil fixé */}
                        <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 font-semibold">
                          {isMaternelle ? 'S' : '10'}
                        </td>
                        {/* Seuil atteint Oui */}
                        <td className="border border-slate-300 px-1 py-1 text-center">
                          {(() => {
                            if (isMaternelle) {
                              const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                              return (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') ? '✓' : '';
                            }
                            return seuilAtteint ? '✓' : '';
                          })()}
                        </td>
                        {/* Seuil atteint Non */}
                        <td className="border border-slate-300 px-1 py-1 text-center">
                          {(() => {
                            if (isMaternelle) {
                              const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                              return appreciation === 'Peu Satisfaisant' ? '✓' : '';
                            }
                            // ⭐ "Non" si l'élève a composé mais n'a pas atteint le seuil
                            //    (si l'élève n'a pas composé, on n'affiche ni Oui ni Non)
                            return hasComposed && !seuilAtteint ? '✓' : '';
                          })()}
                        </td>
                        {/* Global appreciation (Nursery) */}
                        {isMaternelle && (
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                            <span className={cn(
                              'text-xs',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Très Satisfaisant' && 'text-emerald-600',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Satisfaisant' && 'text-blue-600',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Peu Satisfaisant' && 'text-amber-600',
                            )}>
                              {translateAppreciation(computeAppreciationGlobale(row.scores, sortedSubjects))}
                            </span>
                          </td>
                        )}
                        {/* Observation */}
                        <td className="border border-slate-300 px-2 py-1 text-center text-xs text-slate-600">
                          {(() => {
                            const firstSubj = sortedSubjects[0];
                            return firstSubj ? (row.scores[firstSubj.id]?.comment || '—') : '—';
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={isMaternelle ? 10 + group.subjects.length : isSecondaire ? 9 + group.subjects.length : 10 + group.subjects.length * 3}
                        className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                      >
                        No students in this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Evaluation summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-left">Indicator</th>
                      <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Boys</th>
                      <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Girls</th>
                      <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Total class headcount</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.effectifG}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.effectifF}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.effectifTotal}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Number of students who took the exam</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.ayantComposeG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.ayantComposeF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.ayantComposeTotal || "—"}</td>
                    </tr>
                    <tr className="bg-emerald-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Reached the success threshold</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.ayantAtteintSeuilG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.ayantAtteintSeuilF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{stats.ayantAtteintSeuilTotal || "—"}</td>
                    </tr>
                    <tr className="bg-red-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Did not reach the threshold</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.nAyantPasAtteintG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.nAyantPasAtteintF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-700">{stats.nAyantPasAtteintTotal || "—"}</td>
                    </tr>
                    <tr className="bg-blue-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-bold">% of success</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{stats.pourcentageReussiteG.toFixed(2)}%</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{stats.pourcentageReussiteF.toFixed(2)}%</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-800">{stats.pourcentageReussiteTotal.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
              {/* Class teacher signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Class Teacher</div>
                    <div className="text-xs text-slate-500">{teacherName || 'Teacher\'s name'} — Signature</div>
                  </div>
                  {sig.teacher && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signed
                    </span>
                  )}
                </div>
                {sig.teacher ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={sig.teacher} alt="Teacher signature" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <SignatureCanvas
                    width={400}
                    height={120}
                    disabled={isReadOnly || allSubmitted || allValidated}
                    placeholder="Teacher's signature"
                    onSignatureChange={(data) => {
                      setSignatures(prev => ({
                        ...prev,
                        [group.key]: { ...prev[group.key], teacher: data },
                      }));
                      onSignaturesChange?.(
                        data,
                        signatures[group.key]?.director || null
                      );
                    }}
                  />
                )}
                {sig.teacher && !isReadOnly && !allSubmitted && !allValidated && (
                  <button type="button"
                    onClick={() => {
                      setSignatures(prev => ({
                        ...prev,
                        [group.key]: { ...prev[group.key], teacher: null },
                      }));
                      onSignaturesChange?.(null, signatures[group.key]?.director || null);
                    }}
                    className="text-xs text-red-500 hover:underline">
                    Clear signature
                  </button>
                )}
              </div>

              {/* Director signature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">The Director</div>
                    <div className="text-xs text-slate-500">{directorName || 'Director\'s name'} — Signature and stamp</div>
                  </div>
                  {sig.director && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signed
                    </span>
                  )}
                </div>
                {sig.director ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={sig.director} alt="Director signature" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-400 italic">
                      The director's signature will be applied after validation
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {/* ⭐ Modal de confirmation professionnel (remplace window.confirm) */}
      {confirmDialog}
    </div>
  );
}
