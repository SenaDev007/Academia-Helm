"use client";

/**
 * ============================================================================
 * ÉVALUATION MENSUELLE — Récupération dynamique depuis le Module Examen
 * ============================================================================
 *
 * Cette API remplace l'ancien modèle local (pedagogy-space/monthly-evaluations).
 * Elle récupère dynamiquement les évaluations validées par l'enseignant depuis
 * le Module Examen (status=OPEN_FOR_GRADING ou SUBMITTED).
 *
 * Flux :
 *   1. L'admin crée une évaluation (Module Examen → Évaluations) → status=PLANNED
 *   2. L'enseignant saisit les notes + clique "Valider" (Module Examen → Saisie
 *      des notes) → status=OPEN_FOR_GRADING (les notes sont validées par l'enseignant)
 *   3. L'enseignant ouvre l'Espace Pédagogique → Registre d'Appel → Évaluation
 *      mensuelle : cette page récupère dynamiquement les évaluations OPEN_FOR_GRADING
 *      + affiche le même tableau (matières × élèves × scores)
 *   4. L'enseignant signe + clique "Soumettre au directeur" → status=SUBMITTED
 *   5. L'admin valide → status=VALIDATED (verrouillé)
 *
 * Lorsque RIEN n'est encore soumis → message clair "Aucune évaluation validée
 * par l'enseignant pour cette classe ce mois-ci".
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, FileText, AlertCircle, CheckCircle2, XCircle,
  Send, RefreshCw, Calendar, BookOpen, Users, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import apiClient from "@/lib/api/client";
import { institutionalExamsService } from "@/services/institutional-exams.service";

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

interface GradeRow {
  studentId: string;
  matricule?: string;
  studentName: string;
  firstName?: string;
  lastName?: string;
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
  // Grades fetched per evaluation (evaluationId → GradeRow[])
  gradesByEvaluation: Record<string, any[]>;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Helpers pour les notes ─────────────────────────────────────────────────

// Calcule le total d'une matière pour un élève
function computeTotal(score: { cm?: number | null; cp?: number | null; score?: number | null } | undefined): number {
  if (!score) return 0;
  // Si on a cm + cp (primaire), on les utilise
  if (score.cm !== null && score.cm !== undefined && score.cp !== null && score.cp !== undefined) {
    return (score.cm || 0) + (score.cp || 0);
  }
  // Sinon on utilise score directement
  return score.score || 0;
}

// Calcule le total général d'un élève (somme des totaux par matière, modulo coef)
function computeTotalGeneral(row: GradeRow, subjects: Array<{ id: string; coefficient?: number }>): number {
  let total = 0;
  for (const subj of subjects) {
    const score = row.scores[subj.id];
    if (!score || score.isAbsent) continue;
    const t = computeTotal(score);
    total += t * (subj.coefficient || 1);
  }
  return total;
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
      // Puis on filtrera côté client par status et par mois
      const response = await apiClient.get(`/institutional-exams/evaluations`, {
        params: {
          academicYearId,
          classId,
          // ⭐ On veut les évaluations validées par l'enseignant (OPEN_FOR_GRADING)
          //    et celles déjà soumises au directeur (SUBMITTED)
          //    ainsi que celles validées par l'admin (VALIDATED)
          status: 'OPEN_FOR_GRADING,SUBMITTED,VALIDATED',
        },
      });
      const allEvaluations: Evaluation[] = Array.isArray(response.data) ? response.data : [];

      // ⭐ Filtrer par mois/année (basé sur evaluationDate)
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      const filtered = allEvaluations.filter(ev => {
        const d = new Date(ev.evaluationDate || ev.startDate || ev.endDate || '');
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

      setGroups(groupsWithGrades);
    } catch (err: any) {
      console.error('Erreur lors du chargement des évaluations:', err);
      setError(err.message || 'Erreur lors du chargement des évaluations');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [classId, academicYearId, selectedMonth, selectedYear, className]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // ─── Construire les lignes d'élèves pour un groupe ────────────────────────
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
          const firstName = grade.student?.firstName || grade.firstName || '';
          const lastName = grade.student?.lastName || grade.lastName || '';
          rowMap.set(studentId, {
            studentId,
            matricule: grade.student?.matricule || grade.matricule || '',
            studentName: `${lastName} ${firstName}`.trim(),
            firstName,
            lastName,
            gender: grade.student?.gender || grade.gender || '',
            scores: {},
          });
        }
        const row = rowMap.get(studentId)!;
        // ⭐ Les grades sont stockés avec cm/cp dans comment JSON côté backend
        //    (voir grades.service.ts bulkSave)
        let cm: number | null = grade.cm ?? null;
        let cp: number | null = grade.cp ?? null;
        // Si cm/cp ne sont pas dans le grade directement, essayer de les parser depuis comment
        if ((cm === null || cp === null) && grade.comment) {
          try {
            const parsed = typeof grade.comment === 'string' ? JSON.parse(grade.comment) : grade.comment;
            if (cm === null && parsed?.cm !== undefined) cm = parsed.cm;
            if (cp === null && parsed?.cp !== undefined) cp = parsed.cp;
          } catch { /* ignore */ }
        }
        row.scores[subjectId] = {
          score: grade.score ?? null,
          cm,
          cp,
          qualitativeCode: grade.qualitativeCode || null,
          isAbsent: grade.isAbsent || false,
          comment: grade.comment,
        };
      }
    }
    // Trier par nom
    return Array.from(rowMap.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName, 'fr')
    );
  }, []);

  // ─── Statistiques par groupe ────────────────────────────────────────────────
  const computeStats = useCallback((group: GroupedEvaluation, rows: GradeRow[]) => {
    let totalG = 0, totalF = 0;
    let composeG = 0, composeF = 0;
    let atteintG = 0, atteintF = 0;
    // Seuil de réussite = 50% du score max total (somme des maxScore par matière)
    // Pour Primaire : 10/20 par défaut (mais calculé sur total général / (nb matières × 20))
    const seuilReussite = group.subjects.length * 10; // 10/20 par matière

    for (const row of rows) {
      const sexe = (row.gender || '').toUpperCase();
      const tot = computeTotalGeneral(row, group.subjects);
      if (sexe === 'M' || sexe === 'G' || sexe === 'MALE') {
        totalG++;
        if (tot > 0) composeG++;
        if (tot >= seuilReussite) atteintG++;
      } else if (sexe === 'F' || sexe === 'FEMALE') {
        totalF++;
        if (tot > 0) composeF++;
        if (tot >= seuilReussite) atteintF++;
      }
    }
    const totalC = totalG + totalF;
    const composeC = composeG + composeF;
    const atteintC = atteintG + atteintF;
    const nAtteintC = totalC - atteintC;
    const nAtteintG = totalG - atteintG;
    const nAtteintF = totalF - atteintF;
    return {
      effectifG: totalG, effectifF: totalF, effectifTotal: totalC,
      ayantComposeG: composeG, ayantComposeF: composeF, ayantComposeTotal: composeC,
      ayantAtteintSeuilG: atteintG, ayantAtteintSeuilF: atteintF, ayantAtteintSeuilTotal: atteintC,
      nAyantPasAtteintG: nAtteintG, nAyantPasAtteintF: nAtteintF, nAyantPasAtteintTotal: nAtteintC,
      pourcentageReussiteG: totalG > 0 ? (atteintG / totalG) * 100 : 0,
      pourcentageReussiteF: totalF > 0 ? (atteintF / totalF) * 100 : 0,
      pourcentageReussiteTotal: totalC > 0 ? (atteintC / totalC) * 100 : 0,
      seuilReussite,
    };
  }, []);

  // ─── Soumettre au directeur ─────────────────────────────────────────────────
  const handleSubmitToDirector = async (group: GroupedEvaluation) => {
    const sig = signatures[group.key];
    if (!sig?.teacher) {
      toast.error("Signature obligatoire", {
        description: "Vous devez signer avant de soumettre au directeur.",
      });
      return;
    }
    const ok = window.confirm(
      `Soumettre cette évaluation au directeur ?\n\n` +
      `Classe : ${group.className}\n` +
      `Période : ${group.periodName || '—'}\n` +
      `Type : ${group.evaluationTypeName}\n\n` +
      `Cette action est irréversible.`
    );
    if (!ok) return;
    setSubmitting(group.key);
    try {
      // Appeler /submit sur chaque évaluation du groupe
      // ⭐ Transition : OPEN_FOR_GRADING → SUBMITTED
      const errors: string[] = [];
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          try {
            await apiClient.patch(`/institutional-exams/evaluations/${evId}/submit`);
          } catch (err: any) {
            const msg = err.response?.data?.message || err.message || '';
            // Si déjà SUBMITTED, on ignore
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
      // Recharger les évaluations
      await loadEvaluations();
    } catch (err: any) {
      toast.error("Erreur lors de la soumission", { description: err.message });
    } finally {
      setSubmitting(null);
    }
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
            Aucune évaluation validée pour {MONTH_NAMES[selectedMonth]} {selectedYear}
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Aucune évaluation n'a encore été saisie et validée par l'enseignant pour la classe
            <strong> {className}</strong> ce mois-ci.
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
            Évaluations validées par l'enseignant — {MONTH_NAMES[selectedMonth]} {selectedYear}
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
        const stats = computeStats(group, rows);
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
                Classe : <strong>{group.className}</strong> — {group.periodName || MONTH_NAMES[selectedMonth]} {selectedYear}
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
              {!allSubmitted && !allValidated && (
                <button
                  onClick={() => handleSubmitToDirector(group)}
                  disabled={submitting === group.key || !sig.teacher || isReadOnly}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
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

            {/* Tableau d'évaluation : matières × CM/CP/Total (Primaire) ou TS/S/PS (Maternelle) */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                    {group.subjects.map((subj, idx) => (
                      isMaternelle ? (
                        <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center" style={{ minWidth: "80px" }}>
                          {subj.name}
                        </th>
                      ) : (
                        <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">
                          {subj.name}
                        </th>
                      )
                    ))}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total général</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil atteint</th>
                  </tr>
                  {!isMaternelle && (
                    <tr className="bg-slate-50">
                      {group.subjects.flatMap((_, idx) => ([
                        <th key={`cm-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>,
                        <th key={`cp-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>,
                        <th key={`tot-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>,
                      ]))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((student, sIdx) => {
                    const totalGeneral = computeTotalGeneral(student, group.subjects);
                    const seuilAtteint = totalGeneral >= stats.seuilReussite;
                    return (
                      <tr key={student.studentId || sIdx} className={cn("hover:bg-slate-50", sIdx % 2 === 1 && "bg-slate-50/50")}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{sIdx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-medium">{student.studentName}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {student.gender?.startsWith('F') ? 'F' : 'M'}
                        </td>
                        {group.subjects.map((subj, subIdx) => {
                          const score = student.scores[subj.id];
                          if (isMaternelle) {
                            // Maternelle : afficher TS/S/PS qualitatif
                            const code = score?.qualitativeCode;
                            const codeColor = code === 'TS' ? 'bg-emerald-100 text-emerald-700 font-bold' :
                                              code === 'S' ? 'bg-blue-100 text-blue-700 font-bold' :
                                              code === 'PS' ? 'bg-amber-100 text-amber-700 font-bold' :
                                              'text-slate-400';
                            return (
                              <td key={`s${sIdx}-q${subIdx}`} className="border border-slate-300 px-2 py-1 text-center">
                                <span className={cn("inline-block px-2 py-0.5 rounded text-[10px]", codeColor)}>
                                  {code || '—'}
                                </span>
                              </td>
                            );
                          }
                          // Primaire : CM / CP / Total
                          return (
                            <>
                              <td key={`s${sIdx}-cm${subIdx}`} className="border border-slate-300 px-2 py-1 text-center">
                                {score?.cm ?? '—'}
                              </td>
                              <td key={`s${sIdx}-cp${subIdx}`} className="border border-slate-300 px-2 py-1 text-center">
                                {score?.cp ?? '—'}
                              </td>
                              <td key={`s${sIdx}-tot${subIdx}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                                {score ? computeTotal(score) : '—'}
                              </td>
                            </>
                          );
                        })}
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                          {totalGeneral}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {seuilAtteint ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isMaternelle ? 4 + group.subjects.length + 2 : 4 + group.subjects.length * 3 + 2} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">
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
    </div>
  );
}
