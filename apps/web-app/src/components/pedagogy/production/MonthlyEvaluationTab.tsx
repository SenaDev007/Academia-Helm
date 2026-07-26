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

const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

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

// ⭐ Échapper le HTML pour éviter les injections dans le PDF imprimable
function escapeHtml(text: string): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  // ⭐ Infos école (pour export PDF)
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    logoUrl: string | null;
    address: string;
    phone: string;
    email: string;
  } | null>(null);

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
            name: data.schoolName || data.name || data.tenantName || 'Établissement scolaire',
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
      // (pas de filtre par mois — on veut toutes les évaluations validées par l'enseignant)
      const response = await apiClient.get(`/institutional-exams/evaluations`, {
        params: {
          academicYearId,
          classId,
          status: 'OPEN_FOR_GRADING,SUBMITTED,VALIDATED,LOCKED',
        },
      });
      const allEvaluations: Evaluation[] = Array.isArray(response.data) ? response.data : [];

      // ⭐ Grouper par (classId × evaluationTypeId × periodId × startDate × endDate)
      //    Identique à HierarchicalEvaluationList pour rester cohérent
      const groupMap = new Map<string, GroupedEvaluation>();
      for (const ev of allEvaluations) {
        const key = `${ev.class?.id || classId}__${ev.evaluationType?.id || ''}__${ev.period?.id || ''}__${ev.startDate || ''}__${ev.endDate || ''}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            classId: ev.class?.id || classId,
            className: ev.class?.name || className,
            evaluationTypeId: ev.evaluationType?.id || '',
            evaluationTypeName: ev.evaluationType?.name || 'Évaluation',
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
      console.error('Erreur lors du chargement des évaluations:', err);
      setError(err.message || 'Erreur lors du chargement des évaluations');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [classId, academicYearId, className]);

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
      toast.error("Signature obligatoire", {
        description: "Vous devez signer avant de soumettre au directeur.",
      });
      return;
    }
    // ⭐ Modal professionnel (remplace window.confirm)
    const ok = await confirmWarning(
      `Souhaitez-vous soumettre cette évaluation au directeur ?`,
      'Soumission au directeur',
      `Classe : ${group.className}\n` +
      `Période : ${group.periodName || '—'}\n` +
      `Type : ${group.evaluationTypeName}\n\n` +
      `Cette action est irréversible. Vous ne pourrez plus modifier les notes après la soumission.`
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
            if (msg.includes('doit être') || err.response?.status === 400) {
              console.warn(`Evaluation ${evId} déjà soumise ou statut invalide, ignoré`);
              return;
            }
            console.error(`Failed to submit evaluation ${evId}:`, err.response?.data || err.message);
            errors.push(evId);
          }
        })
      );
      if (errors.length > 0) {
        throw new Error(`Échec de la soumission pour ${errors.length} évaluation(s).`);
      }
      toast.success("Évaluation soumise au directeur", {
        description: "Vous pouvez suivre la validation dans le Module Examen.",
      });
      await loadEvaluations();
    } catch (err: any) {
      toast.error("Erreur lors de la soumission", { description: err.message });
    } finally {
      setSubmitting(null);
    }
  };

  // ─── Export PDF (génère un PDF imprimable avec en-tête école, tableau,
  //    récapitulatif et signatures) ───────────────────────────────────────────
  const handleExportPDF = (group: GroupedEvaluation) => {
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
        ? `Le ${startDate.toLocaleDateString('fr-FR')}`
        : `Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`
      : 'Date non définie';

    // ⭐ Ouvrir une fenêtre d'impression avec le HTML du PDF
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression", {
        description: "Veuillez autoriser les popups pour ce site.",
      });
      return;
    }

    // ⭐ Couleurs du design system
    const N = '#0b2f73', B = '#1d4fa5', G = '#f5b335';
    const SCHOOL_NAME = schoolInfo?.name || 'Établissement scolaire';
    const SCHOOL_LOGO = schoolInfo?.logoUrl || '';
    const SCHOOL_ADDR = schoolInfo?.address || '';
    const SCHOOL_PHONE = schoolInfo?.phone || '';
    const SCHOOL_EMAIL = schoolInfo?.email || '';

    // ⭐ Construire les en-têtes du tableau (2 lignes avec rowSpan/colSpan)
    const matiereHeader = sortedSubjects.map((subj) => {
      if (isMaternelle) {
        return `<th rowspan="2" class="matiere-th" style="min-width:80px">${escapeHtml(subj.name)}<div class="sub">TS/S/PS</div></th>`;
      }
      return `<th colspan="3" class="matiere-th" style="min-width:180px">${escapeHtml(subj.name)}</th>`;
    }).join('');
    const subHeader = !isMaternelle && !isSecondaire ? sortedSubjects.map((_, idx) => `
      <th class="sub-th">CM /18</th>
      <th class="sub-th">CP /2</th>
      <th class="sub-th">Total</th>
    `).join('') : '';

    // ⭐ Construire les lignes du tableau
    const rowsHtml = rows.map((row, idx) => {
      let totalGeneral = 0;
      let nbMatieresEvaluees = 0;
      let hasComposed = false;
      for (const subj of sortedSubjects) {
        const s = row.scores[subj.id];
        if (!s || s.isAbsent) continue;
        if (isMaternelle) {
          if (s.qualitativeCode) { hasComposed = true; nbMatieresEvaluees++; }
        } else if (isSecondaire) {
          if (s.score !== null) { hasComposed = true; nbMatieresEvaluees++; totalGeneral += s.score || 0; }
        } else {
          if (s.cm !== null || s.cp !== null) {
            hasComposed = true; nbMatieresEvaluees++;
            totalGeneral += (s.cm ?? 0) + (s.cp ?? 0);
          }
        }
      }
      const moyenne = nbMatieresEvaluees > 0 ? totalGeneral / nbMatieresEvaluees : 0;
      const seuilAtteint = isMaternelle ? null : (hasComposed && moyenne >= 10);

      // Cellules matières
      const cells = sortedSubjects.map((subj) => {
        const score = row.scores[subj.id] || { cm: null, cp: null, score: null, qualitativeCode: null, isAbsent: false };
        if (isMaternelle) {
          const code = score.isAbsent ? '—' : (score.qualitativeCode || '—');
          return `<td class="cell center">${escapeHtml(code)}</td>`;
        }
        if (isSecondaire) {
          const v = score.isAbsent ? '—' : (score.score ?? '—');
          return `<td class="cell center">${escapeHtml(String(v))}</td>`;
        }
        const cm = score.isAbsent ? '—' : (score.cm ?? '—');
        const cp = score.isAbsent ? '—' : (score.cp ?? '—');
        const total = score.isAbsent ? '—' : ((score.cm !== null || score.cp !== null) ? ((score.cm || 0) + (score.cp || 0)).toFixed(2) : '—');
        return `<td class="cell center">${escapeHtml(String(cm))}</td><td class="cell center">${escapeHtml(String(cp))}</td><td class="cell center bold bg-slate">${escapeHtml(String(total))}</td>`;
      }).join('');

      const totalGenCell = !isMaternelle && !isSecondaire
        ? `<td class="cell center bold blue-bg">${hasComposed ? totalGeneral.toFixed(2) : '—'}</td>`
        : '';
      const seuilFixe = isMaternelle ? 'S' : '10';
      const ouiCell = isMaternelle
        ? '<td class="cell center"></td>'
        : `<td class="cell center">${seuilAtteint ? '✓' : ''}</td>`;
      const nonCell = isMaternelle
        ? '<td class="cell center"></td>'
        : `<td class="cell center">${hasComposed && !seuilAtteint ? '✓' : ''}</td>`;

      return `<tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#fff'}">
        <td class="cell center">${idx + 1}</td>
        <td class="cell">${escapeHtml(row.studentName)}</td>
        <td class="cell center">${escapeHtml((row.gender || '').startsWith('F') ? 'F' : 'M')}</td>
        ${cells}
        ${totalGenCell}
        <td class="cell center"></td>
        <td class="cell center">${seuilFixe}</td>
        ${ouiCell}
        ${nonCell}
      </tr>`;
    }).join('');

    // ⭐ Section récapitulatif
    const statsHtml = `
      <table class="stats-table">
        <thead><tr>
          <th>Indicateur</th><th>Garçons</th><th>Filles</th><th>Total</th>
        </tr></thead>
        <tbody>
          <tr><td class="bold">Effectif total de la classe</td>
            <td class="center">${stats.effectifG}</td><td class="center">${stats.effectifF}</td><td class="center bold">${stats.effectifTotal}</td></tr>
          <tr><td class="bold">Nombre d'élèves ayant composé</td>
            <td class="center">${stats.ayantComposeG || '—'}</td><td class="center">${stats.ayantComposeF || '—'}</td><td class="center bold">${stats.ayantComposeTotal || '—'}</td></tr>
          <tr style="background:#ecfdf5"><td class="bold">Ont atteint le seuil de réussite</td>
            <td class="center" style="color:#047857">${stats.ayantAtteintSeuilG || '—'}</td><td class="center" style="color:#047857">${stats.ayantAtteintSeuilF || '—'}</td><td class="center bold" style="color:#047857">${stats.ayantAtteintSeuilTotal || '—'}</td></tr>
          <tr style="background:#fef2f2"><td class="bold">N'ont pas atteint le seuil</td>
            <td class="center" style="color:#b91c1c">${stats.nAyantPasAtteintG || '—'}</td><td class="center" style="color:#b91c1c">${stats.nAyantPasAtteintF || '—'}</td><td class="center bold" style="color:#b91c1c">${stats.nAyantPasAtteintTotal || '—'}</td></tr>
          <tr style="background:#eff6ff"><td class="bold">% de réussite</td>
            <td class="center bold" style="color:#1d4ed8">${stats.pourcentageReussiteG.toFixed(2)}%</td>
            <td class="center bold" style="color:#1d4ed8">${stats.pourcentageReussiteF.toFixed(2)}%</td>
            <td class="center bold" style="color:#1e40af">${stats.pourcentageReussiteTotal.toFixed(2)}%</td></tr>
        </tbody>
      </table>
    `;

    // ⭐ Section signatures
    const signaturesHtml = `
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-label">Le Titulaire de la classe</div>
          <div class="sig-name">${escapeHtml(teacherName || 'Nom du titulaire')} — Signature</div>
          ${sig.teacher
            ? `<div class="sig-img"><img src="${sig.teacher}" alt="Signature Titulaire" style="max-height:80px" /></div>`
            : `<div class="sig-placeholder">Signature en attente</div>`}
        </div>
        <div class="sig-block">
          <div class="sig-label">Le Directeur / La Directrice</div>
          <div class="sig-name">${escapeHtml(directorName || 'Nom du directeur')} — Signature et cachet</div>
          ${sig.director
            ? `<div class="sig-img"><img src="${sig.director}" alt="Signature Directeur" style="max-height:80px" /></div>`
            : `<div class="sig-placeholder">Signature en attente</div>`}
        </div>
      </div>
    `;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Évaluation mensuelle — ${escapeHtml(group.className)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Arial', sans-serif; padding: 20px; font-size: 11px; color: #1e293b; }
.header { text-align: center; margin-bottom: 12px; border-bottom: 3px solid ${G}; padding-bottom: 10px; }
.header .logo { max-height: 60px; margin: 0 auto 8px; display: block; }
.header h1 { color: ${N}; font-size: 14px; }
.header h2 { font-size: 11px; color: ${B}; margin-top: 3px; }
.header .school-info { font-size: 9px; color: #64748b; margin-top: 3px; }
.eval-info { text-align: center; margin: 12px 0; }
.eval-info h2 { color: ${N}; font-size: 13px; }
.eval-info p { font-size: 10px; color: #475569; margin-top: 2px; }
table.notes { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
table.notes th, table.notes td { border: 1px solid #cbd5e1; padding: 3px 5px; font-size: 9px; }
.matiere-th { background: ${N}; color: #fff; font-weight: bold; text-align: center; padding: 4px 2px; font-size: 9px; }
.sub-th { background: #f1f5f9; color: #475569; font-weight: bold; font-size: 8px; padding: 2px; }
.cell { padding: 3px 4px; font-size: 9px; }
.center { text-align: center; }
.bold { font-weight: bold; }
.blue-bg { background: #eff6ff; color: #1d4fa5; }
.bg-slate { background: #f8fafc; }
table.stats-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
table.stats-table th { background: ${N}; color: #fff; padding: 5px 8px; font-size: 9px; font-weight: bold; text-align: center; }
table.stats-table td { border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 9px; }
.signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 30px; }
.sig-block { flex: 1; }
.sig-label { font-weight: bold; font-size: 10px; color: ${N}; }
.sig-name { font-size: 9px; color: #64748b; margin-bottom: 8px; }
.sig-img { border: 1px solid #cbd5e1; padding: 4px; min-height: 80px; text-align: center; }
.sig-placeholder { border: 1px dashed #cbd5e1; padding: 20px; text-align: center; color: #94a3b8; font-style: italic; }
@media print { body { padding: 10px; } .no-print { display: none; } }
.btn-print { display: block; margin: 10px auto 20px; padding: 8px 16px; background: ${N}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; }
</style></head><body>
<div class="header">
  ${SCHOOL_LOGO ? `<img src="${SCHOOL_LOGO}" class="logo" alt="Logo" />` : ''}
  <h1>${escapeHtml(SCHOOL_NAME)}</h1>
  ${SCHOOL_ADDR || SCHOOL_PHONE || SCHOOL_EMAIL ? `<h2>${escapeHtml([SCHOOL_ADDR, SCHOOL_PHONE, SCHOOL_EMAIL].filter(Boolean).join(' · '))}</h2>` : ''}
  <div class="school-info">Évaluation mensuelle — Année académique ${new Date().getFullYear()}</div>
</div>
<button class="btn-print no-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
<div class="eval-info">
  <h2>${escapeHtml(group.firstEvaluation.title || `ÉVALUATION MENSUELLE — ${group.evaluationTypeName}`)}</h2>
  <p>Classe : <strong>${escapeHtml(group.className)}</strong>${group.periodName ? ` — ${escapeHtml(group.periodName)}` : ''}</p>
  <p>${escapeHtml(dateRange)} · ${escapeHtml(group.evaluationTypeName)}</p>
  <p style="font-size:9px;color:#64748b;font-style:italic;margin-top:4px">NB : Pour chaque épreuve, l'élève évalué(e) n'aura de bonus de perfectionnement que lorsqu'il(elle) aura atteint la maîtrise minimale fixée.</p>
</div>
<table class="notes">
  <thead>
    <tr>
      <th rowspan="2">N°</th>
      <th rowspan="2">Nom et prénom</th>
      <th rowspan="2">Sexe</th>
      ${matiereHeader}
      ${!isMaternelle && !isSecondaire ? '<th rowspan="2">Total gén.</th>' : ''}
      <th rowspan="2">Rang</th>
      <th rowspan="2">Seuil fixé</th>
      <th colspan="2">Seuil atteint</th>
    </tr>
    <tr>
      ${subHeader}
      <th>Oui</th><th>Non</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml || `<tr><td colspan="${isMaternelle ? 10 + sortedSubjects.length : 10 + sortedSubjects.length * 3}" class="center" style="padding:20px;color:#94a3b8">Aucun élève</td></tr>`}
  </tbody>
</table>
<h3 style="color:${N};font-size:11px;margin-bottom:6px">Récapitulatif de l'évaluation</h3>
${statsHtml}
${signaturesHtml}
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); };
</script>
</body></html>`);
    printWindow.document.close();
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border-2 border-slate-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span className="text-sm text-slate-600">Chargement des évaluations validées…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border-2 border-red-200 rounded-xl p-8">
        <div className="flex items-start gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erreur de chargement</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={loadEvaluations}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
            >
              <RefreshCw className="h-3 w-3" />
              Réessayer
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
            Aucune évaluation validée pour cette classe
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Aucune évaluation n'a encore été saisie et validée par l'enseignant pour la classe
            <strong> {className}</strong>.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">Procédure :</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>L'administration crée une évaluation dans <strong>Module Examen → Évaluations</strong>.</li>
              <li>L'enseignant saisit les notes dans <strong>Module Examen → Saisie des notes</strong>.</li>
              <li>L'enseignant clique sur <strong>"Valider"</strong> pour valider sa saisie.</li>
              <li>L'évaluation validée apparaît ici automatiquement pour signature et soumission au directeur.</li>
            </ol>
          </div>
          <button
            onClick={loadEvaluations}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Évaluations validées par l'enseignant
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {groups.length} évaluation(s) · Classe : {className}
          </p>
        </div>
        <button
          onClick={loadEvaluations}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
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
            ? `Le ${startDate.toLocaleDateString('fr-FR')}`
            : `Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`
          : 'Date non définie';

        return (
          <div key={group.key} className="bg-white border-2 border-slate-800 rounded-xl p-6 space-y-4">
            {/* En-tête */}
            <div className="text-center border-b border-slate-300 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {group.firstEvaluation.title || `ÉVALUATION MENSUELLE — ${group.evaluationTypeName}`}
              </h2>
              <div className="text-sm text-slate-600 mt-1">
                Classe : <strong>{group.className}</strong>
                {group.periodName && ` — ${group.periodName}`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {dateRange} · {group.evaluationTypeName}
              </div>
              <p className="text-xs text-slate-500 mt-1 italic">
                NB : Pour chaque épreuve, l'élève évalué(e) n'aura de bonus de perfectionnement que lorsqu'il(elle) aura atteint la maîtrise minimale fixée.
              </p>
              {/* Badge de statut */}
              <div className="mt-2">
                {allValidated ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Validée par l'administration — Notes verrouillées
                  </span>
                ) : allSubmitted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                    <Send className="h-3 w-3" />
                    Soumise au directeur — En attente de validation
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Validée par l'enseignant — Prête à signer
                  </span>
                )}
              </div>
            </div>

            {/* Actions : Signature obligatoire + Bouton soumettre */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {allSubmitted
                  ? "Cette évaluation a été soumise au directeur."
                  : allValidated
                  ? "Cette évaluation a été validée par l'administration."
                  : "Vous devez signer avant de soumettre au directeur."}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {/* ⭐ Bouton Export PDF — visible pour tous les statuts */}
                <button
                  onClick={() => handleExportPDF(group)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                  title="Exporter en PDF (imprimable)"
                >
                  <Printer className="h-4 w-4" />
                  Export PDF
                </button>
                {/* ⭐ Bouton Soumettre au directeur — masqué si déjà soumis/validé */}
                {!allSubmitted && !allValidated && (
                  <button
                    onClick={() => handleSubmitToDirector(group)}
                    disabled={submitting === group.key || !sig.teacher || isReadOnly}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    title={!sig.teacher ? "Signature obligatoire avant soumission" : "Soumettre au directeur"}
                  >
                    {submitting === group.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sig.teacher ? "Soumettre au directeur" : "Signature requise"}
                  </button>
                )}
              </div>
            </div>

            {/* ⭐ Tableau IDENTIQUE au Module Examen (GradingSheet) — read-only */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Présence</th>
                    {sortedSubjects.map((subject, idx) => (
                      isMaternelle ? (
                        <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                          {subject.name}
                          <div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                        </th>
                      ) : isSecondaire ? (
                        <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                          {subject.name}
                          <div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                        </th>
                      ) : (
                        <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">
                          {subject.name}
                        </th>
                      )
                    ))}
                    {!isMaternelle && !isSecondaire && (
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
                    )}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil fixé</th>
                    <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Seuil atteint</th>
                    {isMaternelle && (
                      <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation globale</th>
                    )}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Observation</th>
                  </tr>
                  {!isSecondaire && (
                    <tr className="bg-slate-50">
                      {!isMaternelle && sortedSubjects.map((_, idx) => (
                        <>
                          <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                          <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                          <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                        </>
                      ))}
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                      <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
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
                                  <span className="text-[9px] font-bold text-amber-600 ml-0.5" title="Présence mixte">⚠</span>
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
                        {/* Appréciation globale (Maternelle) */}
                        {isMaternelle && (
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                            <span className={cn(
                              'text-xs',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Très Satisfaisant' && 'text-emerald-600',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Satisfaisant' && 'text-blue-600',
                              computeAppreciationGlobale(row.scores, sortedSubjects) === 'Peu Satisfaisant' && 'text-amber-600',
                            )}>
                              {computeAppreciationGlobale(row.scores, sortedSubjects)}
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
                        Aucun élève dans cette classe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Récapitulatif */}
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
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.effectifG}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.effectifF}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.effectifTotal}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Nombre d'élèves ayant composé</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.ayantComposeG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">{stats.ayantComposeF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold">{stats.ayantComposeTotal || "—"}</td>
                    </tr>
                    <tr className="bg-emerald-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-semibold">Ont atteint le seuil de réussite</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.ayantAtteintSeuilG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{stats.ayantAtteintSeuilF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{stats.ayantAtteintSeuilTotal || "—"}</td>
                    </tr>
                    <tr className="bg-red-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-semibold">N'ont pas atteint le seuil</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.nAyantPasAtteintG || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center text-red-700">{stats.nAyantPasAtteintF || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-red-700">{stats.nAyantPasAtteintTotal || "—"}</td>
                    </tr>
                    <tr className="bg-blue-50/50">
                      <td className="border border-slate-300 px-3 py-2 font-bold">% de réussite</td>
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
              {/* Signature Titulaire */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div>
                    <div className="text-xs text-slate-500">{teacherName || 'Nom du titulaire'} — Signature</div>
                  </div>
                  {sig.teacher && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signé
                    </span>
                  )}
                </div>
                {sig.teacher ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={sig.teacher} alt="Signature Titulaire" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <SignatureCanvas
                    width={400}
                    height={120}
                    disabled={isReadOnly || allSubmitted || allValidated}
                    placeholder="Signature du Titulaire"
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
                    Effacer la signature
                  </button>
                )}
              </div>

              {/* Signature Directeur */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div>
                    <div className="text-xs text-slate-500">{directorName || 'Nom du directeur'} — Signature et cachet</div>
                  </div>
                  {sig.director && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Signé
                    </span>
                  )}
                </div>
                {sig.director ? (
                  <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                    <img src={sig.director} alt="Signature Directeur" className="max-h-24 mx-auto" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-400 italic">
                      La signature du directeur sera apposée après validation
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
