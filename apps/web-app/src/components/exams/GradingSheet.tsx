/**
 * ============================================================================
 * GRADING SHEET — COMPOSANT PARTAGÉ (admin + enseignant)
 * ============================================================================
 *
 * Fiche de saisie des notes utilisée à la fois dans :
 *   - /app/exams/grades (UI administration)
 *   - /app/teacher/exams (UI enseignant)
 *
 * Une seule implémentation, partagée — pas de duplication.
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Save, Send, ChevronLeft, Calendar, Users, BookOpen, Loader2,
  Search, School, AlertCircle, CheckCircle2, XCircle,
  Settings, Settings2, X, Plus, Pencil, Lock,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import apiClient from '@/lib/api/client';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Evaluation {
  id: string;
  title: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string };
  subject?: { id: string; name: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

export interface GroupedEvaluation {
  classId: string;
  className: string;
  evaluationTypeId: string;
  evaluationTypeName: string;
  evaluationTypeCode?: string;
  periodId: string;
  periodName: string;
  startDate: string | null;
  endDate: string | null;
  subjects: Array<{ id: string; name: string }>;
  evaluationIds: string[];
  statuses: string[];
  firstEvaluation: Evaluation;
}

export interface GradeRow {
  studentId: string;
  studentName: string;
  matricule?: string;
  gender?: string;
  scores: Record<string, {
    score: number | null;
    cm: number | null;
    cp: number | null;
    qualitativeCode: string | null;
    isAbsent: boolean;
    comment: string;
  }>;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const CLASS_ORDER = [
  'MATERNELLE 1', 'MATERNELLE 2', 'MATERNELLE 3',
  'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
  'PS', 'MS', 'GS',
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6E', '6ÈME', '5E', '5ÈME', '4E', '4ÈME', '3E', '3ÈME',
  'SECONDE', 'PREMIERE', 'PREMIÈRE', 'TERMINALE',
];

export function getClassOrderIndex(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  const exact = CLASS_ORDER.indexOf(upper);
  if (exact >= 0) return exact;
  for (let i = 0; i < CLASS_ORDER.length; i++) {
    if (upper.startsWith(CLASS_ORDER[i])) return i;
  }
  return CLASS_ORDER.length;
}

export const PRIMAIRE_SUBJECT_ORDER = [
  'COMMUNICATION ORALE',
  'DICTEE', 'DICTÉE',
  'PRODUCTION D\'ECRITS', 'PRODUCTION D\'ÉCRITS', 'EXPRESSION ECRITE', 'EXPRESSION ÉCRITE',
  'LECTURE', 'COMPREHENSION DE L\'ECRIT', 'COMPRÉHENSION DE L\'ÉCRIT',
  'MATHEMATIQUES', 'MATHÉMATIQUES', 'MATH',
  'EDUCATION SCIENTIFIQUE ET TECHNOLOGIQUE', 'ÉDUCATION SCIENTIFIQUE ET TECHNOLOGIQUE',
  'EDUCATION SOCIALE', 'ÉDUCATION SOCIALE',
  'EDUCATION ARTISTIQUE ARTS PLASTIQUES', 'ÉDUCATION ARTISTIQUE ARTS PLASTIQUES', 'EA PLASTIQUE',
  'EDUCATION ARTISTIQUE ARTS VIVANTS', 'ÉDUCATION ARTISTIQUE ARTS VIVANTS', 'EA VIVANT',
  'EDUCATION PHYSIQUE ET SPORTIVE', 'ÉDUCATION PHYSIQUE ET SPORTIVE', 'EPS',
];

export const MATERNELLE_SUBJECT_ORDER = [
  'EDUCATION POUR LA SANTE', 'ÉDUCATION POUR LA SANTÉ', 'EDUCATION POUR LA SANTE ET L\'ENVIRONNEMENT',
  'EDUCATION A DES REFLEXES DE SANTE', 'ÉDUCATION À DES RÉFLEXES DE SANTÉ',
  'EXPRESSION ORALE', 'LANGAGE', 'POESIE', 'CHANT', 'COMPTINE', 'CONTE',
  'EXPRESSION CORPORELLE',
  'EXPRESSION PLASTIQUE', 'DESSIN', 'PEINTURE', 'COLORIAGE',
  'EVEIL SCIENTIFIQUE', 'ÉVEIL SCIENTIFIQUE', 'EVEIL SCIENTIFIQUE ET TECHNOLOGIQUE',
  'PRE-LECTURE', 'PRÉ-LECTURE', 'PRELECTURE', 'PRÉLECTURE',
  'PRE-MATHEMATIQUE', 'PRÉ-MATHÉMATIQUE', 'PREMATHEMATIQUE', 'PRÉMATHÉMATIQUE',
  'PRE-ECRITURE', 'PRÉ-ÉCRITURE', 'PREECRITURE', 'PRÉÉCRITURE',
];

export function getSubjectOrderIndex(name: string, isMaternelle: boolean, isPrimaire: boolean): number {
  const upper = (name || '').toUpperCase().trim();
  const order = isMaternelle ? MATERNELLE_SUBJECT_ORDER : isPrimaire ? PRIMAIRE_SUBJECT_ORDER : [];
  for (let i = 0; i < order.length; i++) {
    if (upper === order[i] || upper.includes(order[i])) return i;
  }
  return order.length;
}

// ⭐ Suffixe ordinal français pour le rang
export function formatRang(rank: number, gender?: string): string {
  if (rank <= 0) return '—';
  if (rank === 1) {
    return gender === 'F' ? '1ère' : '1er';
  }
  return `${rank}ème`;
}

// ⭐ Appréciation globale automatique pour la Maternelle
// Calcule la synthèse qualitative à partir des annotations TS/S/PS :
// - Si majorité TS → "Très Satisfaisant"
// - Si (TS + S) ≥ seuil (la plupart) → "Satisfaisant"
// - Sinon → "Peu Satisfaisant"
export function computeAppreciationGlobale(
  scores: Record<string, { qualitativeCode: string | null; isAbsent: boolean }>,
  subjects: Array<{ id: string }>,
): string {
  let ts = 0, s = 0, ps = 0, total = 0;
  subjects.forEach((subj) => {
    const sc = scores[subj.id];
    if (!sc || sc.isAbsent || !sc.qualitativeCode) return;
    total++;
    if (sc.qualitativeCode === 'TS') ts++;
    else if (sc.qualitativeCode === 'S') s++;
    else if (sc.qualitativeCode === 'PS') ps++;
  });
  if (total === 0) return '—';
  // Si la majorité est TS → Très Satisfaisant
  if (ts > total / 2) return 'Très Satisfaisant';
  // Si (TS + S) ≥ la plupart → Satisfaisant
  if ((ts + s) >= total / 2) return 'Satisfaisant';
  // Sinon → Peu Satisfaisant
  return 'Peu Satisfaisant';
}

// ─── Composant GradingSheet ───────────────────────────────────────────────────

export function GradingSheet({
  group,
  isMaternelle,
  isPrimaire,
  isSecondaire,
  scopedSubModules,
  onBack,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  isSecondaire: boolean;
  scopedSubModules: any;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { academicYear } = useModuleContext();
  const [presenceModalStudent, setPresenceModalStudent] = useState<GradeRow | null>(null);
  const { warning, dialog: confirmDialog } = useConfirmDialog();
  // ⭐ Mode d'édition : 'readonly' par défaut, 'add' pour ajouter, 'edit' pour modifier
  const [editMode, setEditMode] = useState<'readonly' | 'add' | 'edit'>('readonly');

  // ⭐ Vérifier si les notes sont verrouillées (soumises ou validées)
  // Si verrouillées, l'enseignant ne peut plus modifier — il doit demander un déverrouillage
  const isLocked = group.statuses.some((s) => s === 'SUBMITTED' || s === 'VALIDATED' || s === 'LOCKED');
  // ⭐ canEdit = pas verrouillé ET mode édition actif
  const canEdit = !isLocked && editMode !== 'readonly';
  // ⭐ canAdd = pas verrouillé ET mode 'add' (seulement les champs vides sont éditables)
  const canAdd = !isLocked && editMode === 'add';
  // ⭐ canModify = pas verrouillé ET mode 'edit' (tous les champs sont éditables)
  const canModify = !isLocked && editMode === 'edit';

  const sortedSubjects = useMemo(() => {
    return [...group.subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [group.subjects, isMaternelle, isPrimaire]);

  useEffect(() => {
    const loadSheet = async () => {
      if (!group.evaluationIds.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sheets = await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              const response = await apiClient.get(`/institutional-exams/grades/evaluation/${evId}`);
              return { evaluationId: evId, students: Array.isArray(response.data) ? response.data : [] };
            } catch {
              return { evaluationId: evId, students: [] };
            }
          })
        );

        const evalToSubject = new Map<string, string>();
        group.evaluationIds.forEach((evId, idx) => {
          const subjectId = group.subjects[idx]?.id;
          if (subjectId) {
            evalToSubject.set(evId, subjectId);
          }
        });

        const studentMap = new Map<string, GradeRow>();
        sheets.forEach(({ evaluationId, students }) => {
          const subjectId = evalToSubject.get(evaluationId);
          if (!subjectId) return;
          students.forEach((student: any) => {
            if (!studentMap.has(student.studentId)) {
              studentMap.set(student.studentId, {
                studentId: student.studentId,
                studentName: student.studentName || 'Inconnu',
                matricule: student.matricule,
                gender: student.gender,
                scores: {},
                status: student.status || 'NEW',
              });
            }
            const row = studentMap.get(student.studentId)!;
            row.scores[subjectId] = {
              score: student.score ?? null,
              cm: student.cm ?? null,
              cp: student.cp ?? null,
              qualitativeCode: student.qualitativeCode ?? null,
              isAbsent: student.isAbsent ?? false,
              comment: student.comment ?? '',
            };
          });
        });

        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            if (!row.scores[subject.id]) {
              row.scores[subject.id] = { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            }
          });
        });

        rowsArray.sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr'));
        setRows(rowsArray);
      } catch (err) {
        console.error('Error loading grading sheet', err);
        toastError('Erreur lors du chargement de la fiche de saisie');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadSheet();
  }, [group, academicYear?.id]);

  const handleScoreChange = (studentId: string, subjectId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
        let updated: any;
        if (isMaternelle) {
          updated = { ...existing, qualitativeCode: value === '' ? null : value };
        } else {
          updated = { ...existing, score: value === '' ? null : parseFloat(value) };
        }
        return { ...row, scores: { ...row.scores, [subjectId]: updated } };
      })
    );
  };

  const handleCmChange = (studentId: string, subjectId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
        const cm = value === '' ? null : Math.min(18, Math.max(0, parseFloat(value) || 0));
        const cp = (cm !== null && cm >= 10) ? existing.cp : 0;
        const total = (cm !== null ? cm : 0) + (cp !== null ? cp : 0);
        return {
          ...row,
          scores: {
            ...row.scores,
            [subjectId]: { ...existing, cm, cp, score: total, isAbsent: false },
          },
        };
      })
    );
  };

  const handleCpChange = (studentId: string, subjectId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
        if (existing.cm === null || existing.cm < 10) return row;
        const cp = value === '' ? null : Math.min(2, Math.max(0, parseFloat(value) || 0));
        const total = (existing.cm || 0) + (cp !== null ? cp : 0);
        return {
          ...row,
          scores: {
            ...row.scores,
            [subjectId]: { ...existing, cp, score: total },
          },
        };
      })
    );
  };

  const handleSave = async (submit = false) => {
    setSaving(true);
    try {
      // 1. Sauvegarder les notes
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          const evIndex = group.evaluationIds.indexOf(evId);
          const subjectId = group.subjects[evIndex]?.id;
          if (!subjectId) {
            console.warn(`No subjectId found for evaluation ${evId}, skipping`);
            return;
          }
          const gradesForEval = rows
            .filter((row) => row.scores[subjectId])
            .map((row) => ({
              studentId: row.studentId,
              subjectId,
              score: row.scores[subjectId].score,
              cm: row.scores[subjectId].cm,
              cp: row.scores[subjectId].cp,
              qualitativeCode: row.scores[subjectId].qualitativeCode,
              isAbsent: row.scores[subjectId].isAbsent,
              comment: row.scores[subjectId].comment,
              status: submit ? 'SUBMITTED' : 'DRAFT',
            }));
          if (gradesForEval.length === 0) return;
          try {
            await apiClient.post(`/institutional-exams/grades/evaluation/${evId}/bulk`, gradesForEval);
          } catch (err: any) {
            console.error(`Failed to save evaluation ${evId}:`, err.response?.data || err.message);
            throw err;
          }
        })
      );

      // 2. Si soumission : changer le statut de l'évaluation à SUBMITTED
      if (submit) {
        const submitErrors: string[] = [];
        await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              await apiClient.patch(`/institutional-exams/evaluations/${evId}/submit`);
            } catch (err: any) {
              console.error(`Failed to submit evaluation ${evId}:`, err.response?.data || err.message);
              submitErrors.push(evId);
            }
          })
        );
        if (submitErrors.length > 0) {
          throw new Error(`Échec de la soumission pour ${submitErrors.length} évaluation(s). Vérifiez la console.`);
        }
      }

      toastSuccess(submit ? 'Notes soumises pour validation' : 'Notes enregistrées', {
        description: `${rows.length} élève(s) · ${group.subjects.length} matière(s)`,
      });
      if (submit) onBack();
    } catch (err: any) {
      toastError('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) =>
      r.studentName.toLowerCase().includes(q) ||
      (r.matricule || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // ⭐ Pagination automatique : 100 élèves par page
  const PAGE_SIZE = 100;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { filled: 0, total: 0, absent: 0, studentsAbsent: 0 };
    let filled = 0;
    let absent = 0;
    let total = 0;
    const absentStudentIds = new Set<string>();
    rows.forEach((row) => {
      group.subjects.forEach((subject) => {
        const score = row.scores[subject.id];
        if (!score) return;
        total++;
        if (score.isAbsent) {
          absent++;
          absentStudentIds.add(row.studentId);
        } else if (isMaternelle ? score.qualitativeCode : (score.score !== null || score.cm !== null)) {
          filled++;
        }
      });
    });
    return { filled, total, absent, studentsAbsent: absentStudentIds.size };
  }, [rows, group.subjects, isMaternelle]);

  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  const sameDay = startDate && endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  const fmtLong = (d: Date) => format(d, 'd MMM yyyy', { locale: fr });
  const dateRange = startDate
    ? sameDay || !endDate
      ? `Le ${fmtLong(startDate)}`
      : `Du ${fmtLong(startDate)} au ${fmtLong(endDate)}`
    : 'Date non définie';

  return (
    <>
    <ModuleContainer
      subModules={{ modules: scopedSubModules, activeModuleId: 'grades' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* ⭐ Titre de la fiche à l'intérieur de l'onglet */}
            <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
              <h2 className="text-lg font-bold text-slate-900">
                FICHE DE SAISIE DES NOTES — {group.evaluationTypeName}
              </h2>
              <div className="text-sm text-slate-600 mt-1">
                Classe : <strong>{group.className}</strong> • {group.periodName} • {dateRange}
              </div>
            </div>
            {/* ⭐ Bannière de verrouillage si notes soumises/validées */}
            {isLocked && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Notes verrouillées</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Ces notes ont été soumises pour validation. Pour les modifier, vous devez demander un déverrouillage auprès de l'administration.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const reason = prompt('Justificatif de la demande de déverrouillage (obligatoire) :');
                    if (reason && reason.trim()) {
                      // ⭐ Envoyer la demande de déverrouillage
                      Promise.all(
                        group.evaluationIds.map((evId) =>
                          apiClient.post(`/institutional-exams/evaluations/${evId}/unlock-request`, {
                            reason: reason.trim(),
                          }).catch(() => null)
                        )
                      ).then(() => {
                        toastSuccess('Demande de déverrouillage envoyée', {
                          description: 'L\'administration examinera votre demande.',
                        });
                      });
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                >
                  Demander un déverrouillage
                </button>
              </div>
            )}
            {/* Action Bar */}
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Retour à la liste
                </Button>
                {/* ⭐ Boutons Mode édition */}
                {!isLocked && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setEditMode('add')}
                      disabled={editMode === 'add' || saving || loading}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                        editMode === 'add'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter
                    </button>
                    <button
                      onClick={() => setEditMode('edit')}
                      disabled={editMode === 'edit' || saving || loading}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                        editMode === 'edit'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                      )}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    {editMode !== 'readonly' && (
                      <button
                        onClick={() => setEditMode('readonly')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Verrouiller
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {rows.length} élèves
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <BookOpen className="w-3 h-3" />
                  {group.subjects.length} matières
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs">
                  {isMaternelle ? 'TS/S/PS' : `/20`}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving || loading || isLocked || editMode === 'readonly'}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Sauvegarder
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const ok = await warning(
                      `Soumettre les notes de ${group.className} pour validation ?\n\n` +
                      `Évaluation : ${group.evaluationTypeName}\n` +
                      `${rows.length} élève(s) · ${group.subjects.length} matière(s)\n\n` +
                      `⚠️ Après soumission, les notes seront verrouillées. Pour les modifier, vous devrez demander un déverrouillage à l'administration.`,
                      'Soumettre pour validation',
                      'Cette action rendra les notes non modifiables jusqu\'à validation par l\'administration.'
                    );
                    if (ok) handleSave(true);
                  }}
                  disabled={saving || loading || isLocked || editMode === 'readonly'}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Soumettre
                </Button>
              </div>
            </div>
            {/* Stats rapides */}
            {!loading && rows.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-none shadow-sm bg-blue-50">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Notes saisies</p>
                    <p className="text-2xl font-black mt-1 text-blue-700">
                      {stats.filled}/{stats.total}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-emerald-50">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Taux de remplissage</p>
                    <p className="text-2xl font-black mt-1 text-emerald-700">
                      {stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-rose-50">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Absents (élèves)</p>
                    <p className="text-2xl font-black mt-1 text-rose-700">{stats.studentsAbsent}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{stats.absent} absence(s) par matière</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-violet-50">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Matières</p>
                    <p className="text-2xl font-black mt-1 text-violet-700">{group.subjects.length}</p>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="ml-3 text-sm text-gray-500">Chargement des élèves et notes…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucun élève dans cette classe</p>
                <p className="text-sm text-gray-400 mt-1">
                  Vérifiez que des élèves sont inscrits dans la classe {group.className}.
                </p>
              </div>
            ) : (
              <>
                {/* Recherche */}
                <div className="relative max-w-xs">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un élève…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {/* Tableau registre */}
                <div className={cn(
                  "bg-white border-2 border-slate-800 rounded-xl overflow-x-auto",
                  (isLocked || editMode === 'readonly') && "pointer-events-none opacity-70"
                )}>
                  {/* ⭐ Bannière mode édition */}
                  {editMode === 'add' && (
                    <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-700 font-semibold">
                      Mode Ajout : seules les cellules vides sont éditables. Les notes existantes sont grisées.
                    </div>
                  )}
                  {editMode === 'edit' && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold">
                      Mode Modification : toutes les cellules sont éditables.
                    </div>
                  )}
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
                      {paginatedRows.map((row, idx) => {
                        const totalGeneral = isMaternelle ? null : sortedSubjects.reduce((sum, subj) => {
                          const s = row.scores[subj.id];
                          return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
                        }, 0);
                        const seuilAtteint = isMaternelle ? null : (
                          totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length * 0.5)
                        );
                        // ⭐ Calcul du rang avec formatRang
                        const rang = (() => {
                          // Pour Maternelle : calculer avec valeurs qualitatives TS=3, S=2, PS=1
                          // Pour Primaire/Secondaire : calculer avec score numérique
                          const sortedByTotal = [...filteredRows]
                            .map((r) => ({
                              id: r.studentId,
                              total: sortedSubjects.reduce((sum, subj) => {
                                const s = r.scores[subj.id];
                                if (!s || s.isAbsent) return sum;
                                if (isMaternelle) {
                                  // TS=3, S=2, PS=1
                                  if (s.qualitativeCode === 'TS') return sum + 3;
                                  if (s.qualitativeCode === 'S') return sum + 2;
                                  if (s.qualitativeCode === 'PS') return sum + 1;
                                  return sum;
                                }
                                return sum + (typeof s.score === 'number' ? s.score : 0);
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
                              {row.gender === 'M' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                              ) : row.gender === 'F' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                              ) : '—'}
                            </td>
                            {/* Colonne Présence */}
                            <td className="border border-slate-300 px-1 py-1 text-center">
                              {(() => {
                                const allPresent = !Object.values(row.scores).some((s) => s?.isAbsent);
                                const allAbsent = sortedSubjects.every((subj) => row.scores[subj.id]?.isAbsent);
                                const isMixed = !allPresent && !allAbsent;
                                return (
                                  <div className="flex gap-0.5 justify-center items-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRows((prev) => prev.map((r) => {
                                          if (r.studentId !== row.studentId) return r;
                                          const newScores = { ...r.scores };
                                          sortedSubjects.forEach((subj) => {
                                            newScores[subj.id] = { ...newScores[subj.id], isAbsent: false };
                                          });
                                          return { ...r, scores: newScores };
                                        }));
                                      }}
                                      title="Présent (toutes matières)"
                                      className={cn(
                                        'px-2 py-1 rounded text-xs font-bold transition',
                                        allPresent ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'
                                      )}
                                    >P</button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRows((prev) => prev.map((r) => {
                                          if (r.studentId !== row.studentId) return r;
                                          const newScores = { ...r.scores };
                                          sortedSubjects.forEach((subj) => {
                                            newScores[subj.id] = { ...newScores[subj.id], isAbsent: true, score: null, qualitativeCode: null };
                                          });
                                          return { ...r, scores: newScores };
                                        }));
                                      }}
                                      title="Absent (toutes matières)"
                                      className={cn(
                                        'px-2 py-1 rounded text-xs font-bold transition',
                                        allAbsent ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                      )}
                                    >A</button>
                                    <button
                                      type="button"
                                      onClick={() => setPresenceModalStudent(row)}
                                      title="Détailler la présence par matière"
                                      className={cn(
                                        'px-1.5 py-1 rounded text-xs transition',
                                        isMixed ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-amber-100'
                                      )}
                                    >
                                      <Settings2 className="w-3 h-3" />
                                    </button>
                                    {isMixed && (
                                      <span className="text-[9px] font-bold text-amber-600 ml-0.5" title="Présence mixte">⚠</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            {/* Matières */}
                            {sortedSubjects.map((subject) => {
                              const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                              // ⭐ hasNote = la cellule a déjà une note (pour le mode 'add')
                              const hasNote = isMaternelle
                                ? !!score.qualitativeCode
                                : (score.cm !== null || score.score !== null);
                              if (isMaternelle) {
                                return (
                                  <td key={subject.id} className={cn("border border-slate-300 px-1 py-1 text-center", canAdd && hasNote && "bg-gray-100")}>
                                    <div className="flex gap-1 justify-center">
                                      {['TS', 'S', 'PS'].map((opt) => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => !score.isAbsent && !(canAdd && hasNote) && handleScoreChange(row.studentId, subject.id, opt)}
                                          disabled={score.isAbsent || (canAdd && hasNote)}
                                          title={opt === 'TS' ? 'Très Satisfaisant' : opt === 'S' ? 'Satisfaisant' : 'Peu Satisfaisant'}
                                          className={cn(
                                            'px-2 py-1 rounded text-xs font-bold transition',
                                            score.qualitativeCode === opt
                                              ? opt === 'TS' ? 'bg-emerald-600 text-white' : opt === 'S' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                                            (score.isAbsent || (canAdd && hasNote)) && 'opacity-30 cursor-not-allowed'
                                          )}
                                        >{opt}</button>
                                      ))}
                                    </div>
                                  </td>
                                );
                              }
                              if (isSecondaire) {
                                return (
                                  <td key={subject.id} className={cn("border border-slate-300 p-0", canAdd && hasNote && "bg-gray-100")}>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="20"
                                      value={score.isAbsent ? '' : (score.score ?? '')}
                                      onChange={(e) => handleScoreChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent || (canAdd && hasNote)}
                                      placeholder="—"
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                        !score.isAbsent && score.score !== null && typeof score.score === 'number' &&
                                          (Number(score.score) < 10 ? 'text-rose-600' : Number(score.score) >= 14 ? 'text-emerald-600' : 'text-slate-900')
                                      )}
                                    />
                                  </td>
                                );
                              }
                              // Primaire : CM/CP/Total
                              const cmValue = score.cm ?? null;
                              const cpValue = score.cp ?? null;
                              const totalValue = (cmValue !== null ? cmValue : 0) + (cpValue !== null ? cpValue : 0);
                              const cpEnabled = cmValue !== null && cmValue >= 10;
                              return (
                                <>
                                  <td key={`cm-${subject.id}`} className={cn("border border-slate-300 p-0", canAdd && hasNote && "bg-gray-100")}>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="18"
                                      value={score.isAbsent ? '' : (cmValue ?? '')}
                                      onChange={(e) => handleCmChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent || (canAdd && hasNote)}
                                      placeholder="—"
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                        !score.isAbsent && cmValue !== null && typeof cmValue === 'number' &&
                                          (Number(cmValue) < 10 ? 'text-rose-600' : Number(cmValue) >= 14 ? 'text-emerald-600' : 'text-slate-900')
                                      )}
                                    />
                                  </td>
                                  <td key={`cp-${subject.id}`} className={cn("border border-slate-300 p-0", canAdd && hasNote && "bg-gray-100")}>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="2"
                                      value={score.isAbsent ? '' : (cpValue ?? '')}
                                      onChange={(e) => handleCpChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent || !cpEnabled || (canAdd && hasNote)}
                                      placeholder="—"
                                      title={cpEnabled ? 'Critère de Perfectionnement (0, 1 ou 2)' : 'CP disponible uniquement si CM ≥ 10'}
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        (score.isAbsent || !cpEnabled) && 'opacity-30 cursor-not-allowed bg-slate-50'
                                      )}
                                    />
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
                                {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                              </td>
                            )}
                            {/* Rang avec suffixe français */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                              {formatRang(rang, row.gender)}
                            </td>
                            {/* Seuil fixé — Maternelle: 'S' (qualitatif), Primaire/Secondaire: 10 */}
                            <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 font-semibold">
                              {isMaternelle ? 'S' : '10'}
                            </td>
                            {/* Seuil atteint Oui/Non (automatique) */}
                            <td className="border border-slate-300 px-1 py-1 text-center">
                              {(() => {
                                if (isMaternelle) {
                                  // Maternelle : seuil atteint si (TS + S) ≥ la plupart des matières
                                  const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                                  return (appreciation === 'Très Satisfaisant' || appreciation === 'Satisfaisant') ? '✓' : '';
                                }
                                return seuilAtteint ? '✓' : '';
                              })()}
                            </td>
                            <td className="border border-slate-300 px-1 py-1 text-center">
                              {(() => {
                                if (isMaternelle) {
                                  const appreciation = computeAppreciationGlobale(row.scores, sortedSubjects);
                                  return appreciation === 'Peu Satisfaisant' ? '✓' : '';
                                }
                                return !seuilAtteint && totalGeneral !== null ? '✓' : '';
                              })()}
                            </td>
                            {/* Appréciation globale (Maternelle) — calcul automatique */}
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
                            <td className="border border-slate-300 p-0">
                              <input
                                type="text"
                                value={(() => {
                                  const firstSubj = sortedSubjects[0];
                                  return firstSubj ? (row.scores[firstSubj.id]?.comment || '') : '';
                                })()}
                                onChange={(e) => {
                                  const subjId = sortedSubjects[0]?.id;
                                  if (!subjId) return;
                                  setRows(prev => prev.map(r => {
                                    if (r.studentId !== row.studentId) return r;
                                    const existing = r.scores[subjId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                                    return { ...r, scores: { ...r.scores, [subjId]: { ...existing, comment: e.target.value } } };
                                  }));
                                }}
                                placeholder="—"
                                className="w-full px-1 py-1 text-center text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={isMaternelle ? 10 + group.subjects.length : isSecondaire ? 9 + group.subjects.length : 10 + group.subjects.length * 3}
                            className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                          >
                            Aucun élève trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-500">
                      Page {currentPage} sur {totalPages} — {filteredRows.length} élève(s) au total
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ← Précédent
                      </button>
                      <span className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Suivant →
                      </button>
                    </div>
                  </div>
                )}
                {/* Légende */}
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                  <p className="font-semibold mb-1">
                    {isMaternelle
                      ? 'Légende — Évaluation qualitative (Maternelle)'
                      : isSecondaire
                        ? 'Légende — Évaluation quantitative (Secondaire)'
                        : 'Légende — Évaluation quantitative (Primaire)'}
                  </p>
                  {isMaternelle ? (
                    <ul className="space-y-0.5 ml-4">
                      <li><strong className="text-emerald-700">TS</strong> = Très Satisfaisant</li>
                      <li><strong className="text-blue-700">S</strong> = Satisfaisant</li>
                      <li><strong className="text-amber-700">PS</strong> = Peu Satisfaisant</li>
                      <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
                      <li className="mt-1 text-gray-500">Réussite : (TS + S) ≥ seuil fixé par l'établissement.</li>
                    </ul>
                  ) : isSecondaire ? (
                    <ul className="space-y-0.5 ml-4">
                      <li>Saisissez la note sur /20 (ex: 15.5, 12, 8.25).</li>
                      <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
                      <li className="text-emerald-700">Notes ≥ 10 : admis (en vert).</li>
                      <li className="text-rose-700">Notes &lt; 10 : échec (en rouge).</li>
                    </ul>
                  ) : (
                    <ul className="space-y-0.5 ml-4">
                      <li><strong>CM</strong> = Critère Maximal, noté sur /18</li>
                      <li><strong>CP</strong> = Critère de Perfectionnement, noté sur /2</li>
                      <li className="text-amber-700">⭐ CP disponible uniquement si CM ≥ 10/18</li>
                      <li><strong>Total</strong> = CM + CP (max /20)</li>
                      <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
                      <li className="text-emerald-700">CM ≥ 10 : admis (en vert).</li>
                      <li className="text-rose-700">CM &lt; 10 : échec (en rouge).</li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        ),
      }}
    />
    {/* Modal Présence par matière */}
    {presenceModalStudent && (
      <PresenceModal
        student={presenceModalStudent}
        subjects={sortedSubjects}
        onClose={() => setPresenceModalStudent(null)}
        onUpdate={(studentId, subjectId, isAbsent) => {
          setRows((prev) => prev.map((r) => {
            if (r.studentId !== studentId) return r;
            const existing = r.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            return {
              ...r,
              scores: {
                ...r.scores,
                [subjectId]: {
                  ...existing,
                  isAbsent,
                  ...(isAbsent ? { score: null, cm: null, cp: null, qualitativeCode: null } : {}),
                },
              },
            };
          }));
          setPresenceModalStudent((prev) => {
            if (!prev || prev.studentId !== studentId) return prev;
            const existing = prev.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
            return {
              ...prev,
              scores: {
                ...prev.scores,
                [subjectId]: {
                  ...existing,
                  isAbsent,
                  ...(isAbsent ? { score: null, cm: null, cp: null, qualitativeCode: null } : {}),
                },
              },
            };
          });
        }}
        onAllPresent={(studentId) => {
          setRows((prev) => prev.map((r) => {
            if (r.studentId !== studentId) return r;
            const newScores = { ...r.scores };
            sortedSubjects.forEach((subj) => {
              newScores[subj.id] = { ...newScores[subj.id], isAbsent: false };
            });
            return { ...r, scores: newScores };
          }));
          setPresenceModalStudent((prev) => {
            if (!prev || prev.studentId !== studentId) return prev;
            const newScores = { ...prev.scores };
            sortedSubjects.forEach((subj) => {
              newScores[subj.id] = { ...newScores[subj.id], isAbsent: false };
            });
            return { ...prev, scores: newScores };
          });
        }}
        onAllAbsent={(studentId) => {
          setRows((prev) => prev.map((r) => {
            if (r.studentId !== studentId) return r;
            const newScores = { ...r.scores };
            sortedSubjects.forEach((subj) => {
              newScores[subj.id] = { ...newScores[subj.id], isAbsent: true, score: null, cm: null, cp: null, qualitativeCode: null };
            });
            return { ...r, scores: newScores };
          }));
          setPresenceModalStudent((prev) => {
            if (!prev || prev.studentId !== studentId) return prev;
            const newScores = { ...prev.scores };
            sortedSubjects.forEach((subj) => {
              newScores[subj.id] = { ...newScores[subj.id], isAbsent: true, score: null, cm: null, cp: null, qualitativeCode: null };
            });
            return { ...prev, scores: newScores };
          });
        }}
      />
    )}
    {confirmDialog}
    </>
  );
}

// ─── Modal Présence par matière ───────────────────────────────────────────────

function PresenceModal({
  student,
  subjects,
  onClose,
  onUpdate,
  onAllPresent,
  onAllAbsent,
}: {
  student: GradeRow;
  subjects: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdate: (studentId: string, subjectId: string, isAbsent: boolean) => void;
  onAllPresent: (studentId: string) => void;
  onAllAbsent: (studentId: string) => void;
}) {
  const absentCount = subjects.filter((s) => student.scores[s.id]?.isAbsent).length;
  const presentCount = subjects.length - absentCount;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Présence par matière
            </h3>
            <p className="text-sm text-blue-100 mt-0.5">{student.studentName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              {presentCount} présent{presentCount > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              {absentCount} absent{absentCount > 1 ? 's' : ''}
            </span>
            <span className="text-gray-400">/ {subjects.length} matière{subjects.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAllPresent(student.studentId)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              Tout présent
            </button>
            <button
              onClick={() => onAllAbsent(student.studentId)}
              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
            >
              Tout absent
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {subjects.map((subject) => {
            const score = student.scores[subject.id];
            const isAbsent = score?.isAbsent ?? false;
            return (
              <div
                key={subject.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border transition-colors',
                  isAbsent ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className={cn('w-4 h-4', isAbsent ? 'text-red-400' : 'text-emerald-500')} />
                  <span className="text-sm font-medium text-gray-900">{subject.name}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onUpdate(student.studentId, subject.id, false)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                      !isAbsent ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-emerald-100'
                    )}
                  >P</button>
                  <button
                    onClick={() => onUpdate(student.studentId, subject.id, true)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                      isAbsent ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-red-100'
                    )}
                  >A</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
