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

import { Fragment, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Save, Send, ChevronLeft, Calendar, Users, BookOpen, Loader2,
  Search, School, AlertCircle, CheckCircle2, XCircle,
  Settings, Settings2, X, Plus, Pencil, Lock, FileText, ClipboardCheck,
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
import { UnlockRequestModal } from '@/components/exams/UnlockRequestModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  getLabels, getMaxScoreForType, translatePeriodName,
} from '@/lib/exam-anglophone-config';

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
  /** ⭐ Identifiant stable du groupe (classId|typeId|periodId|start|end) — sélection multiple */
  key?: string;
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
  /**
   * ⭐ V10d — Mapping ROBUSTE evaluationId → subjectId.
   * L'ancien mapping positionnel (evaluationIds[idx] → subjects[idx]) se
   * désynchronise dès qu'un doublon de session existe (même classe × type ×
   * période × dates créé deux fois) : subjects est dédupliqué mais pas
   * evaluationIds → les notes partaient dans les mauvaises évaluations.
   * Ce map est rempli au moment du regroupement (1 entrée par évaluation).
   */
  subjectByEvalId?: Record<string, string>;
}

/**
 * ⭐ Résout la matière d'une évaluation dans un groupe :
 * 1. via subjectByEvalId (mapping explicite, fiable)
 * 2. sinon par position (fallback historique — sujet à doublons près)
 */
export function getSubjectIdForEvaluation(
  group: GroupedEvaluation,
  evaluationId: string,
): string | undefined {
  const mapped = group.subjectByEvalId?.[evaluationId];
  if (mapped) return mapped;
  const idx = group.evaluationIds.indexOf(evaluationId);
  return idx >= 0 ? group.subjects[idx]?.id : undefined;
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

// ⭐ SECONDARY — Appréciation automatique (mentions standard bénino-françaises)
// Utilisée à la fois par la fiche de saisie ET le registre des notes du
// secondaire pour garantir des appréciations identiques partout :
//   ≥16 Très Bien · 14-16 Bien · 12-14 Assez Bien · 10-12 Passable
//   8-10 Insuffisant · <8 Faible · null (aucune note) → —
export function computeAppreciationSecondaire(avg: number | null): string {
  if (avg === null || isNaN(avg)) return '—';
  if (avg >= 16) return 'Très Bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez Bien';
  if (avg >= 10) return 'Passable';
  if (avg >= 8) return 'Insuffisant';
  return 'Faible';
}

// ⭐ SECONDARY — Couleur de la mention d'appréciation
export function appreciationSecondaireClassName(appreciation: string): string {
  switch (appreciation) {
    case 'Très Bien': return 'text-emerald-600';
    case 'Bien': return 'text-emerald-700';
    case 'Assez Bien': return 'text-blue-600';
    case 'Passable': return 'text-slate-700';
    case 'Insuffisant': return 'text-amber-600';
    case 'Faible': return 'text-rose-600';
    default: return 'text-slate-300'; // '—'
  }
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
  language,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  isSecondaire: boolean;
  scopedSubModules: any;
  onBack: () => void;
  language?: 'FR' | 'EN';
}) {
  const isEN = language === 'EN';
  const labels = getLabels(language);
  // ⭐ Déterminer le barème maximal selon le type d'évaluation
  //    1. Priorité : maxScore stocké sur l'évaluation (group.firstEvaluation.maxScore)
  //       — c'est la valeur configurée par l'école dans Settings > Calculation Rules
  //    2. Fallback : getMaxScoreForType (valeurs par défaut du système anglophone)
  //    3. Fallback final : 20 (système francophone)
  const evalTypeCode = group.evaluationTypeCode || '';
  const evalMaxScore = group.firstEvaluation?.maxScore || 0;
  const maxScore = evalMaxScore > 0
    ? evalMaxScore
    : (isEN ? getMaxScoreForType(evalTypeCode, language) : 20);
  const [rows, setRows] = useState<GradeRow[]>([]);
  // ⭐ FIX 2026-11-17 — Snapshot des cellules portant une note ENREGISTRÉE
  //    (chargée depuis l'API ou fraîchement sauvegardée). Le verrou du mode
  //    'add' (« seules les cellules vides sont éditables, les notes
  //    existantes sont grisées ») doit s'appuyer sur ce snapshot et NON sur
  //    la valeur live : l'ancien code testait score.score !== null, donc
  //    dès le PREMIER chiffre saisi (onChange → setState → re-render) la
  //    cellule elle-même se verrouillait et se grisait — le bug « ça grise
  //    dès le premier chiffre en mode Ajouter » (toutes les tables :
  //    secondaire, primaire CM, maternelle, broadsheet EN).
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { academicYear } = useModuleContext();
  const [presenceModalStudent, setPresenceModalStudent] = useState<GradeRow | null>(null);
  const { warning, dialog: confirmDialog } = useConfirmDialog();
  // ⭐ Mode d'édition : 'readonly' par défaut, 'add' pour ajouter, 'edit' pour modifier
  const [editMode, setEditMode] = useState<'readonly' | 'add' | 'edit'>('readonly');
  // ⭐ Modal de demande de déverrouillage (remplace prompt())
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);

  // ═══ V10f — BROADSHEET ANGLOPHONE (piste EN : Nursery & Primary) ═════════
  // Modèle « Examination results and teacher's report » (feuille nigériane) :
  //   Page 1 « Examination Results » — saisie (élèves en lignes, matières en
  //   colonnes, colonnes finales AVERAGE / POSITION / TOTAL). Les lignes
  //   MARKS OBTAINABLE / MARKS OBTAINED figurent AVANT la liste des élèves
  //   (position exacte du modèle PDF).
  //   Page 2 « Head Teacher's Report » — PAS de tableau : une zone de
  //   commentaires PAR MATIÈRE (≈ 6 lignes réglées par matière, comme le
  //   PDF) + zone « EXTRA SUBJECT » ; persistée via l'API broadsheet-remarks.
  const [broadsheetPage, setBroadsheetPage] = useState<'exam' | 'report'>('exam');
  const [subjectRemarks, setSubjectRemarks] = useState<Record<string, string>>({});
  const [extraRemark, setExtraRemark] = useState<{ name: string; comment: string }>({ name: '', comment: '' });
  const [remarksLoaded, setRemarksLoaded] = useState(false);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarksSaving, setRemarksSaving] = useState(false);

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
        // ⭐ V10d — Priorité au mapping explicite subjectByEvalId (robuste aux
        // doublons de sessions) ; le fallback positionnel reste pour compat.
        group.evaluationIds.forEach((evId) => {
          const subjectId = getSubjectIdForEvaluation(group, evId);
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
            const incoming = {
              score: student.score ?? null,
              cm: student.cm ?? null,
              cp: student.cp ?? null,
              qualitativeCode: student.qualitativeCode ?? null,
              isAbsent: student.isAbsent ?? false,
              comment: student.comment ?? '',
            };
            const existing = row.scores[subjectId];
            // ⭐ V10d — Doublons de session (2 évaluations pour la même matière
            // dans le même groupe) : une valeur vide ne doit JAMAIS écraser une
            // valeur déjà saisie. La première valeur non vide gagne.
            const hasValue = (s: typeof incoming) =>
              s.qualitativeCode !== null || s.score !== null || s.cm !== null || s.cp !== null || s.isAbsent;
            if (!existing) {
              row.scores[subjectId] = incoming;
            } else if (!hasValue(existing) && hasValue(incoming)) {
              row.scores[subjectId] = incoming;
            } else if (!existing.comment && incoming.comment) {
              row.scores[subjectId] = { ...existing, comment: incoming.comment };
            }
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
        // ⭐ FIX 2026-11-17 — Snapshot des notes chargées (verrou du mode 'add')
        const saved = new Set<string>();
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            const s = row.scores[subject.id];
            if (s && (s.score !== null || s.cm !== null || s.cp !== null || s.qualitativeCode !== null || s.isAbsent)) {
              saved.add(`${row.studentId}|${subject.id}`);
            }
          });
        });
        setSavedCells(saved);
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
          // ⭐ 2026-10-01 — Bloquer les notes qui excèdent le maxScore de l'évaluation
          //    (configuré dans Settings > Calculation Rules). Le input HTML a déjà
          //    max={maxScore} mais on ajoute une validation côté JS pour empêcher
          //    les saisies manuelles (copier-coller, édition directe du DOM).
          const numValue = value === '' ? null : parseFloat(value);
          if (numValue !== null && numValue > maxScore) {
            // Clamp au maxScore — la note ne peut pas dépasser le maximum
            updated = { ...existing, score: maxScore, isAbsent: false };
          } else if (numValue !== null && numValue < 0) {
            updated = { ...existing, score: 0, isAbsent: false };
          } else {
            updated = { ...existing, score: numValue, isAbsent: false };
          }
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
      // 0. ⭐ V10f — Piste EN : sauvegarder aussi les commentaires du Head
      //    Teacher par matière (page 2 du broadsheet) avec les notes.
      //    ⚠️ Uniquement si les commentaires ont été CHARGÉS (remarksLoaded)
      //    — sinon on écraserait des commentaires existants avec un payload
      //    vide (l'utilisateur n'aurait jamais ouvert la page 2).
      if (isEN && remarksLoaded) {
        await saveSubjectRemarks(true);
      }

      // ⭐ 2026-10-01 — Valider les notes avant sauvegarde : rejeter les
      //    notes qui excèdent le maxScore de l'évaluation.
      if (!isMaternelle) {
        const violations: string[] = [];
        for (const row of rows) {
          for (const [subjectId, score] of Object.entries(row.scores)) {
            if (score.score !== null && typeof score.score === 'number' && !score.isAbsent) {
              if (score.score > maxScore) {
                violations.push(`${row.studentName}: ${score.score} > ${maxScore}`);
              }
            }
          }
        }
        if (violations.length > 0) {
          toastError(
            isEN ? 'Grades exceed maximum score' : 'Notes supérieures au barème',
            {
              description: isEN
                ? `${violations.length} grade(s) exceed the maximum (${maxScore}). Please correct before saving.`
                : `${violations.length} note(s) dépassent le barème (${maxScore}). Veuillez corriger avant de sauvegarder.`,
            }
          );
          setSaving(false);
          return;
        }
      }

      // 1. Sauvegarder les notes
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          const subjectId = getSubjectIdForEvaluation(group, evId);
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

      // 2. Si validation : changer le statut de l'évaluation à OPEN_FOR_GRADING
      //    (les notes sont validées par l'enseignant — pas encore soumises au directeur)
      //    La soumission au directeur se fera depuis l'Espace Pédagogique
      if (submit) {
        const submitErrors: string[] = [];
        await Promise.all(
          group.evaluationIds.map(async (evId) => {
            try {
              // ⭐ Ouvrir pour saisie = validation de l'enseignant
              // Le statut passe à OPEN_FOR_GRADING (les notes sont saisies et validées)
              await apiClient.post(`/institutional-exams/evaluations/${evId}/open`);
            } catch (err: any) {
              console.error(`Failed to validate evaluation ${evId}:`, err.response?.data || err.message);
              submitErrors.push(evId);
            }
          })
        );
        if (submitErrors.length > 0) {
          throw new Error(`Échec de la validation pour ${submitErrors.length} évaluation(s). Vérifiez la console.`);
        }
      }

      // ⭐ FIX 2026-11-17 — Après une sauvegarde réussie, rafraîchir le
      //    snapshot des cellules enregistrées : les notes fraîchement
      //    sauvegardées deviennent verrouillées en mode 'add' (cohérent avec
      //    la bannière « les notes existantes sont grisées »), sans verrouiller
      //    les cellules en cours de frappe AVANT sauvegarde.
      setSavedCells(() => {
        const next = new Set<string>();
        rows.forEach((row) => {
          group.subjects.forEach((subject) => {
            const s = row.scores[subject.id];
            if (s && (s.score !== null || s.cm !== null || s.cp !== null || s.qualitativeCode !== null || s.isAbsent)) {
              next.add(`${row.studentId}|${subject.id}`);
            }
          });
        });
        return next;
      });

      toastSuccess(submit ? 'Notes validées' : 'Notes enregistrées', {
        description: submit
          ? 'Les notes sont disponibles dans l\'Espace Pédagogique pour soumission au directeur.'
          : `${rows.length} élève(s) · ${group.subjects.length} matière(s)`,
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

  // ═══ V10e — BROADSHEET EN : calculs par élève / par matière ══════════════
  // TOTAL = somme des notes · AVERAGE = moyenne des notes saisies ·
  // POSITION = rang (1st, 2nd, 3rd…) · MARKS OBTAINED = meilleure note de la
  // classe pour la matière · MARKS OBTAINABLE = barème (First/Second CA /20, Examination /60).
  const enTotalOf = useCallback((row: GradeRow): number =>
    sortedSubjects.reduce((sum, subj) => {
      const s = row.scores[subj.id];
      return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
    }, 0), [sortedSubjects]);

  // ⭐ 2026-10-01 — Moyenne = Total / nombre TOTAL de matières (pas seulement
  //    les matières avec note). Un élève absent à une matière a 0 pour cette
  //    matière → sa moyenne est pénalisée. C'est la règle du système anglophone.
  const enAverageOf = useCallback((row: GradeRow): number | null => {
    const totalSubjects = sortedSubjects.length;
    if (totalSubjects === 0) return null;
    const hasAnyScore = sortedSubjects.some((subj) => {
      const s = row.scores[subj.id];
      return s && typeof s.score === 'number';
    });
    if (!hasAnyScore) return null;
    return enTotalOf(row) / totalSubjects;
  }, [sortedSubjects, enTotalOf]);

  // ⭐ 2026-10-01 — Rang basé sur la MOYENNE (pas le total). Le classement
  //    est dynamique : tri par moyenne décroissante → 1er = meilleure moyenne.
  //    Les ex aequo ont le même rang (rank gap).
  const enRankMap = useMemo(() => {
    const students = filteredRows.map((r) => ({ id: r.studentId, avg: enAverageOf(r) }));
    // Trier par moyenne décroissante (null = pas de note → en dernier)
    students.sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });
    const map: Record<string, number> = {};
    let lastAvg: number | null = null;
    let lastRank = 0;
    students.forEach((s, i) => {
      if (s.avg === null) {
        map[s.id] = 0; // pas de rang si pas de note
        return;
      }
      const rank = lastAvg !== null && s.avg === lastAvg ? lastRank : i + 1;
      map[s.id] = rank;
      lastAvg = s.avg;
      lastRank = rank;
    });
    return map;
  }, [filteredRows, enAverageOf]);

  const enSubjectMaxOf = useCallback((subjectId: string): number | null => {
    let max: number | null = null;
    rows.forEach((r) => {
      const s = r.scores[subjectId];
      if (s && typeof s.score === 'number' && !s.isAbsent && (max === null || s.score > max)) {
        max = s.score;
      }
    });
    return max;
  }, [rows]);

  // Suffixe ordinal anglais : 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st…
  const formatOrdinalEn = (n: number): string => {
    if (n <= 0) return '—';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // ═══ SECONDARY — Moyenne par élève (notes présentes, non absentes) ═════
  // La moyenne alimente « Seuil atteint » (≥ 10/20), « Rang » et
  // « Appréciation » de la fiche de saisie du secondaire.
  const secAverageMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    rows.forEach((r) => {
      const vals: number[] = [];
      sortedSubjects.forEach((subj) => {
        const s = r.scores[subj.id];
        if (s && !s.isAbsent && typeof s.score === 'number') vals.push(s.score);
      });
      map[r.studentId] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return map;
  }, [rows, sortedSubjects]);

  // ═══ SECONDARY — Rang dense par moyenne (ex æquo) ═══════════════════════
  // Seuls les élèves ayant au moins une note sont classés.
  const secRankMap = useMemo(() => {
    const entries = rows
      .map((r) => ({ id: r.studentId, avg: secAverageMap[r.studentId] }))
      .filter((e): e is { id: string; avg: number } => e.avg !== null)
      .sort((a, b) => b.avg - a.avg);
    const map: Record<string, number> = {};
    let lastAvg: number | null = null;
    let lastRank = 0;
    entries.forEach((e, i) => {
      const rank = lastAvg !== null && e.avg === lastAvg ? lastRank : i + 1;
      map[e.id] = rank;
      lastAvg = e.avg;
      lastRank = rank;
    });
    return map;
  }, [rows, secAverageMap]);

  // ═══ SECONDARY — Présence par élève (colonne dédiée) ═══════
  // Même méthode que maternelle/primaire : colonne « Présence » avec
  // P (présent partout) / A (absent partout) + réglage fin par matière via
  // la modale (bouton ⚙). Les cellules des matières absentes se verrouillent
  // et s'affichent en rouge pâle — plus de bouton « Abs » par cellule.

  // ── V10f — Chargement des commentaires du Head Teacher par matière ────────
  // (page 2 du broadsheet). Une seule ligne par fiche en base :
  // en_broadsheet_remarks (classe × période × type d'évaluation).
  // remarks = { "<subjectId>": "comment", "__extra__": { name, comment } }.
  useEffect(() => {
    if (!isEN || broadsheetPage !== 'report' || remarksLoaded || !group.classId || !group.periodId || !group.evaluationTypeId) return;
    let cancelled = false;
    setRemarksLoading(true);
    (async () => {
      try {
        const res = await apiClient.get(
          `/institutional-exams/evaluations/broadsheet-remarks`
          + `?classId=${group.classId}&periodId=${group.periodId}&evaluationTypeId=${group.evaluationTypeId}`,
        );
        if (!cancelled) {
          const remarks = (res.data?.remarks as Record<string, any>) || {};
          const extra = remarks.__extra__ || {};
          const perSubject: Record<string, string> = {};
          Object.entries(remarks).forEach(([k, v]) => {
            if (k !== '__extra__' && typeof v === 'string') perSubject[k] = v;
          });
          setSubjectRemarks(perSubject);
          setExtraRemark({
            name: typeof extra.name === 'string' ? extra.name : '',
            comment: typeof extra.comment === 'string' ? extra.comment : '',
          });
          setRemarksLoaded(true);
        }
      } catch {
        // Silencieux : la page 2 reste utilisable sans persistance.
        // ⚠️ remarksLoaded reste false → handleSave (page 1) ne touchera
        // PAS aux commentaires existants — aucune perte de données.
      } finally {
        if (!cancelled) setRemarksLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEN, broadsheetPage, remarksLoaded, group.classId, group.periodId, group.evaluationTypeId]);

  // ── V10f — Sauvegarde des commentaires du Head Teacher par matière ─────────
  // silent=true (appel depuis handleSave : échec non bloquant, comme avant) ;
  // silent=false (bouton « Save Remarks » de la page 2) : toast de retour.
  const saveSubjectRemarks = useCallback(async (silent = true) => {
    if (!group.classId || !group.periodId || !group.evaluationTypeId) return;
    setRemarksSaving(true);
    try {
      const payload: Record<string, any> = { ...subjectRemarks };
      if (extraRemark.name.trim() !== '' || extraRemark.comment.trim() !== '') {
        payload.__extra__ = extraRemark;
      }
      await apiClient.patch('/institutional-exams/evaluations/broadsheet-remarks', {
        classId: group.classId,
        periodId: group.periodId,
        evaluationTypeId: group.evaluationTypeId,
        remarks: payload,
      });
      if (!silent) {
        toastSuccess("Head Teacher's remarks saved", {
          description: `${sortedSubjects.length} subject(s) · ${group.className}`,
        });
      }
    } catch (err: any) {
      if (!silent) {
        toastError('Error while saving the remarks', {
          description: err?.response?.data?.message || err?.message || 'Unknown error',
        });
      } else {
        console.warn('[headRemarks] save failed:', err?.message);
      }
    } finally {
      setRemarksSaving(false);
    }
  }, [subjectRemarks, extraRemark, group.classId, group.periodId, group.evaluationTypeId, group.className, sortedSubjects.length]);

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
                {isEN
                  ? (broadsheetPage === 'exam'
                      ? 'EXAMINATION RESULTS'
                      : "HEAD TEACHER'S REPORT")
                  : 'FICHE DE SAISIE DES NOTES'}
                {' — '}{group.evaluationTypeName}
              </h2>
              <div className="text-sm text-slate-600 mt-1">
                {isEN ? 'Class' : 'Classe'} : <strong>{group.className}</strong> • {isEN ? translatePeriodName(group.periodName, language) : group.periodName} • {isEN ? dateRange.replace(/^Le\s/, '').replace(/^Du\s/, 'From ').replace(/\sau\s/, ' to ').replace(/^Du /, '') : dateRange}
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
                  onClick={() => setUnlockModalOpen(true)}
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
                  {isEN ? 'Back to list' : 'Retour à la liste'}
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
                      {isEN ? 'Add' : 'Ajouter'}
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
                      {isEN ? 'Modify' : 'Modifier'}
                    </button>
                    {editMode !== 'readonly' && (
                      <button
                        onClick={() => setEditMode('readonly')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {isEN ? 'Lock' : 'Verrouiller'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {rows.length} {isEN ? 'pupils' : 'élèves'}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <BookOpen className="w-3 h-3" />
                  {group.subjects.length} {isEN ? 'subjects' : 'matières'}
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs">
                  {isMaternelle ? 'TS/S/PS' : isEN ? `/${maxScore}` : `/20`}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (isEN && broadsheetPage === 'report' ? saveSubjectRemarks(false) : handleSave(false))}
                  disabled={
                    saving || loading || remarksSaving ||
                    (isEN && broadsheetPage === 'report' ? false : (isLocked || editMode === 'readonly'))
                  }
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {saving || (remarksSaving && isEN && broadsheetPage === 'report') ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  {isEN && broadsheetPage === 'report' ? 'Save Remarks' : isEN ? 'Save' : 'Sauvegarder'}
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const ok = await warning(
                      isEN
                        ? `Validate the marks of ${group.className}?\n\n` +
                          `Assessment: ${group.evaluationTypeName}\n` +
                          `${rows.length} pupil(s) · ${group.subjects.length} subject(s)\n\n` +
                          `Validated marks become available in the Pedagogical Space for submission to the Director.`
                        : `Valider la saisie des notes de ${group.className} ?\n\n` +
                          `Évaluation : ${group.evaluationTypeName}\n` +
                          `${rows.length} élève(s) · ${group.subjects.length} matière(s)\n\n` +
                          `Les notes validées seront disponibles dans l'Espace Pédagogique pour soumission au directeur.`,
                      isEN ? 'Validate marks' : 'Valider la saisie',
                      isEN
                        ? 'Marks will be locked for modification from this module. Final submission happens in the Pedagogical Space.'
                        : 'Les notes seront verrouillées pour modification depuis ce module. La soumission finale se fait depuis l\'Espace Pédagogique.'
                    );
                    if (ok) handleSave(true);
                  }}
                  disabled={saving || loading || isLocked || editMode === 'readonly'}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  {isEN ? 'Validate' : 'Valider'}
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
                {/* Recherche (page 1 uniquement — la page 2 n'affiche pas d'élèves) */}
                {!(isEN && broadsheetPage === 'report') && (
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
                )}
                {/* ═══ V10e — Switcher de pages du broadsheet anglophone ═══ */}
                {isEN && (
                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setBroadsheetPage('exam')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
                        broadsheetPage === 'exam'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      Examination Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadsheetPage('report')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
                        broadsheetPage === 'report'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Head Teacher's Report
                    </button>
                    {broadsheetPage === 'report' && (remarksLoading || remarksSaving) && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {remarksSaving ? 'Saving remarks…' : 'Loading remarks…'}
                      </span>
                    )}
                  </div>
                )}
                {/* Tableau registre */}
                <div className={cn(
                  "bg-white border-2 border-slate-800 rounded-xl overflow-x-auto",
                  (isLocked || editMode === 'readonly') && !(isEN && broadsheetPage === 'report') && "opacity-90"
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
                  {isEN && broadsheetPage === 'report' ? (
                    /* ══════════════════════════════════════════════════════════════
                     * ⭐ V10f — Page 2 « HEAD TEACHER'S REPORT » (modèle PDF) :
                     * PAS de tableau — une zone de commentaires PAR MATIÈRE
                     * (≈ 6 lignes réglées par matière, comme la feuille
                     * nigériane) + zone « EXTRA SUBJECT » en fin de page.
                     * Matières récupérées automatiquement (celles de
                     * l'évaluation, comme les colonnes de la page 1).
                     * Persistance : API broadsheet-remarks (une ligne par
                     * classe × période × type d'évaluation).
                     * ════════════════════════════════════════════════════════ */
                    <>
                      {/* Bandeau titre — même style que la page 1 */}
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black uppercase tracking-wider text-sm">
                          Head Teacher's Report
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {translatePeriodName(group.periodName, language)}
                          {group.evaluationTypeName ? ' · ' + group.evaluationTypeName : ''}
                          {' · '}{group.className}
                        </span>
                      </div>
                      {remarksLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                          <span className="ml-3 text-sm text-slate-500">Loading remarks…</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {sortedSubjects.map((subject, idx) => (
                            <div key={subject.id}>
                              <div className="bg-slate-100/80 px-4 py-1.5 flex items-baseline justify-between gap-3">
                                <span className="font-bold uppercase text-[11px] tracking-wide text-slate-700">
                                  <span className="text-slate-400 font-semibold mr-2">{idx + 1}.</span>
                                  {subject.name}
                                </span>
                                <span className="text-[9px] uppercase text-slate-400 font-semibold whitespace-nowrap">
                                  Head Teacher's remarks
                                </span>
                              </div>
                              <textarea
                                value={subjectRemarks[subject.id] || ''}
                                onChange={(e) => setSubjectRemarks((prev) => ({ ...prev, [subject.id]: e.target.value }))}
                                rows={6}
                                placeholder="Write the head teacher's remarks for this subject…"
                                style={{
                                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)',
                                  backgroundAttachment: 'local',
                                }}
                                className="w-full border-0 px-4 py-1 text-sm text-slate-800 leading-7 resize-y focus:outline-none focus:ring-1 focus:ring-amber-300"
                              />
                            </div>
                          ))}
                          {/* ⭐ EXTRA SUBJECT (présente sur le modèle PDF) */}
                          <div>
                            <div className="bg-amber-50/80 px-4 py-1.5 flex items-center justify-between gap-3 border-b border-amber-200/60">
                              <span className="font-bold uppercase text-[11px] tracking-wide text-amber-700">
                                Extra Subject
                              </span>
                              <input
                                type="text"
                                value={extraRemark.name}
                                onChange={(e) => setExtraRemark((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Optional subject name…"
                                className="text-xs font-semibold text-amber-800 text-right bg-transparent border-0 border-b border-amber-300/60 focus:outline-none focus:border-amber-500 px-1 py-0.5 w-56"
                              />
                            </div>
                            <textarea
                              value={extraRemark.comment}
                              onChange={(e) => setExtraRemark((prev) => ({ ...prev, comment: e.target.value }))}
                              rows={6}
                              placeholder="Remarks for the extra subject…"
                              style={{
                                backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)',
                                backgroundAttachment: 'local',
                              }}
                              className="w-full border-0 px-4 py-1 text-sm text-slate-800 leading-7 resize-y focus:outline-none focus:ring-1 focus:ring-amber-300"
                            />
                          </div>
                        </div>
                      )}
                      {/* Pied de fiche — rappel (même pattern de boutons que la page 1) */}
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {sortedSubjects.length} subject(s) · save with the « Save Remarks » button
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                          Model: Examination results &amp; teacher's report
                        </span>
                      </div>
                    </>
                  ) : isEN ? (
                    /* ══════════════════════════════════════════════════════════════
                     * ⭐ V10f — Page 1 « EXAMINATION RESULTS » (saisie) :
                     * NO | NAMES OF SCHOLARS | matières (auto) | AVERAGE |
                     * POSITION | TOTAL — Nursery & Primary partagent
                     * EXACTEMENT la même table. Les lignes MARKS OBTAINABLE /
                     * MARKS OBTAINED figurent AVANT la liste des élèves
                     * (position exacte du modèle PDF).
                     * ════════════════════════════════════════════════════════ */
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th
                            colSpan={2 + sortedSubjects.length + 4}
                            className="border border-slate-700 px-3 py-2 text-center font-black uppercase tracking-wider text-sm"
                          >
                            {'Examination Results — ' + translatePeriodName(group.periodName, language)
                              + (group.evaluationTypeName ? ' — ' + group.evaluationTypeName : '')}
                          </th>
                        </tr>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">No</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase min-w-[180px]">Names of Scholars</th>
                          {/* ⭐ 2026-10-01 — Attendance column moved to be right after Names of Scholars */}
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-20 bg-amber-50">Attendance</th>
                          {sortedSubjects.map((subject) => (
                            <th key={subject.id} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                              {subject.name}
                              <div className="text-[9px] text-slate-400 font-normal">/{maxScore}</div>
                            </th>
                          ))}
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-blue-50">Average</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-violet-50">Position</th>
                          <th className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-16 bg-emerald-50">Total</th>
                        </tr>
                        {/* ⭐ MARKS OBTAINABLE — barème par matière — AVANT la liste des élèves (modèle PDF) */}
                        <tr className="bg-slate-100 font-bold">
                          <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtainable</th>
                          {/* Attendance column in Marks Obtainable */}
                          <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-amber-50">—</th>
                          {sortedSubjects.map((s) => (
                            <th key={'ob-' + s.id} className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{maxScore}</th>
                          ))}
                          <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-blue-50">{maxScore}</th>
                          <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
                          <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-600 bg-emerald-50">{maxScore * sortedSubjects.length}</th>
                        </tr>
                        {/* ⭐ MARKS OBTAINED — meilleure note de la classe par matière — AVANT la liste des élèves (modèle PDF) */}
                        <tr className="bg-slate-50 font-bold">
                          <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-right uppercase text-[11px] text-slate-600">Marks Obtained</th>
                          {/* Attendance column in Marks Obtained */}
                          <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-amber-50">—</th>
                          {sortedSubjects.map((s) => {
                            const max = enSubjectMaxOf(s.id);
                            return (
                              <th key={`mo-${s.id}`} className="border border-slate-300 px-2 py-1.5 text-center text-slate-700">
                                {max !== null ? Number(max).toFixed(2).replace(/\.00$/, '') : '—'}
                              </th>
                            );
                          })}
                          {(() => {
                            const maxes = sortedSubjects.map((s) => enSubjectMaxOf(s.id)).filter((m): m is number => m !== null);
                            const sum = maxes.reduce((a, b) => a + b, 0);
                            const avg = maxes.length ? sum / maxes.length : null;
                            return (
                              <>
                                <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-blue-50">{avg !== null ? avg.toFixed(2) : '—'}</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-400 bg-violet-50">—</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center text-slate-700 bg-emerald-50">{maxes.length ? Number(sum).toFixed(2).replace(/\.00$/, '') : '—'}</th>
                              </>
                            );
                          })()}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row, idx) => {
                          const total = enTotalOf(row);
                          const average = enAverageOf(row);
                          const position = enRankMap[row.studentId] || 0;
                          const rowNo = (currentPage - 1) * 100 + idx + 1;
                          const hasAnyScore = sortedSubjects.some((subj) => {
                            const s = row.scores[subj.id];
                            return s && typeof s.score === 'number';
                          });
                          return (
                            <tr
                              key={row.studentId}
                              className={cn(
                                'hover:bg-slate-50 transition-colors',
                                idx % 2 === 1 && 'bg-slate-50/50',
                                !hasAnyScore && 'bg-amber-50/30',
                              )}
                            >
                              <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{rowNo}</td>
                              <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{row.studentName}</td>
                              {/* ⭐ 2026-10-01 — Attendance column (moved after Names of Scholars) */}
                              <td className="border border-slate-300 px-2 py-1 text-center bg-amber-50">
                                {(() => {
                                  const absentSubjects = sortedSubjects.filter((subj) => row.scores[subj.id]?.isAbsent);
                                  const allAbsent = absentSubjects.length === sortedSubjects.length && sortedSubjects.length > 0;
                                  const allPresent = absentSubjects.length === 0;
                                  return (
                                    <div className="flex items-center justify-center gap-1">
                                      <span
                                        className={cn(
                                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold cursor-pointer',
                                          allPresent ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                            : allAbsent ? 'bg-red-100 text-red-700 border border-red-300'
                                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                                        )}
                                        onClick={() => setPresenceModalStudent(row)}
                                        title={isEN ? (allPresent ? 'Present' : allAbsent ? 'Absent' : absentSubjects.length + '/' + sortedSubjects.length + ' absent') : (allPresent ? 'Présent' : allAbsent ? 'Absent' : absentSubjects.length + '/' + sortedSubjects.length + ' absent')}
                                      >
                                        {allPresent ? 'P' : allAbsent ? 'A' : (sortedSubjects.length - absentSubjects.length) + '/' + sortedSubjects.length}
                                      </span>
                                      <button
                                        onClick={() => setPresenceModalStudent(row)}
                                        className="p-0.5 rounded hover:bg-amber-200"
                                        title={isEN ? 'Attendance details' : 'Détails de présence'}
                                      >
                                        <Settings className="w-3 h-3 text-slate-500" />
                                      </button>
                                    </div>
                                  );
                                })()}
                              </td>
                              {sortedSubjects.map((subject) => {
                                const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                                // ⭐ FIX 2026-11-17 — verrou basé sur le snapshot des notes
                                //    ENREGISTRÉES (pas la valeur live) + correction du mode :
                                //    'edit' (l'ancien 'modify' ne matchait JAMAIS → en mode
                                //    Modifier TOUTES les cellules restaient disabled).
                                const hasNote = savedCells.has(`${row.studentId}|${subject.id}`);
                                const isEditable = editMode === 'edit' || (editMode === 'add' && !hasNote);
                                return (
                                  <td key={subject.id} className={cn("border border-slate-300 p-0", canAdd && hasNote && "bg-gray-100")}>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max={String(maxScore)}
                                      value={score.isAbsent ? '' : (score.score ?? '')}
                                      onChange={(e) => handleScoreChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent || !isEditable || (isLocked || editMode === 'readonly')}
                                      placeholder="—"
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        (!isEditable || (isLocked || editMode === 'readonly')) && !score.isAbsent && 'cursor-not-allowed bg-slate-50 text-slate-400',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                        !score.isAbsent && score.score !== null && typeof score.score === 'number' &&
                                          (Number(score.score) < maxScore * 0.5 ? 'text-rose-600' : Number(score.score) >= maxScore * 0.7 ? 'text-emerald-600' : 'text-slate-900'),
                                      )}
                                    />
                                  </td>
                                );
                              })}
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                                {average !== null ? average.toFixed(2) : '—'}
                              </td>
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-violet-700 bg-violet-50">
                                {position > 0 ? formatOrdinalEn(position) : '—'}
                              </td>
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50">
                                {average !== null ? total.toFixed(2).replace(/\.00$/, '') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={2 + sortedSubjects.length + 4}
                              className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                            >
                              No pupil found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : isSecondaire ? (
                  /* ══════════════════════════════════════════════════════════════
                   * ⭐ FICHE DE SAISIE DES NOTES — NIVEAU SECONDAIRE (FR)
                   * Modèle unique pour TOUTES les évaluations (Interrogation 1/2,
                   * Devoir surveillé 1/2) et TOUTES les classes du secondaire :
                   *
                   *   N° | Nom et prénom | PRÉSENCE | NOTES OBTENUES (une
                   *      colonne par matière programmée, /20) | Seuil atteint |
                   *      Rang | Appréciation
                   *
                   * - Présence : P / A par élève + détail par matière (modale ⚙),
                   *   exactement comme maternelle et primaire
                   * - Seuil atteint : moyenne des notes saisies ≥ 10/20
                   * - Rang : classement par moyenne (ex æquo gérés)
                   * - Appréciation : mention automatique (Très Bien → Faible)
                   * ══════════════════════════════════════════════════════════════
                   */
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Présence</th>
                        <th colSpan={sortedSubjects.length} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center bg-blue-50">Notes obtenues</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-20 bg-emerald-50">Seuil atteint</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-14 bg-violet-50">Rang</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-28 bg-amber-50">Appréciation</th>
                      </tr>
                      <tr className="bg-slate-50">
                        {sortedSubjects.map((subject, idx) => (
                          <th key={`sec-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] text-center min-w-[90px]">
                            {subject.name}
                            <div className="text-[9px] text-slate-400 font-normal">/20</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, idx) => {
                        const avg = secAverageMap[row.studentId] ?? null;
                        const rank = secRankMap[row.studentId];
                        const rowNo = (currentPage - 1) * 100 + idx + 1;
                        const hasAnyScore = sortedSubjects.some((subj) => {
                          const s = row.scores[subj.id];
                          return s && !s.isAbsent && typeof s.score === 'number';
                        });
                        const appreciation = computeAppreciationSecondaire(avg);
                        return (
                          <tr
                            key={row.studentId}
                            className={cn(
                              'hover:bg-slate-50 transition-colors',
                              idx % 2 === 1 && 'bg-slate-50/50',
                              !hasAnyScore && 'bg-amber-50/30',
                              Object.values(row.scores).some(s => s?.isAbsent) && 'bg-red-50/30'
                            )}
                          >
                            <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">{rowNo}</td>
                            <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900 whitespace-nowrap">{row.studentName}</td>
                            {/* Colonne Présence — identique maternelle/primaire :
                                P (présent partout) · A (absent partout) · ⚙ détail par matière */}
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
                            {/* Notes obtenues — une cellule par matière */}
                            {sortedSubjects.map((subject) => {
                              const score = row.scores[subject.id] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
                              // ⭐ FIX 2026-11-17 — verrou du mode 'add' basé sur le snapshot des
                              //    notes ENREGISTRÉES : avant, hasNote = score.score !== null
                              //    (valeur live) → dès le premier chiffre saisi la cellule se
                              //    verrouillait et se grisait (disabled + bg-gray-100).
                              //    Désormais la cellule saisie reste éditable tant qu'elle
                              //    n'est pas sauvegardée ; en mode 'edit' tout reste éditable.
                              const hasNote = savedCells.has(`${row.studentId}|${subject.id}`);
                              const cellLocked = isLocked || editMode === 'readonly' || (canAdd && hasNote);
                              return (
                                <td key={subject.id} className={cn("border border-slate-300 p-0", canAdd && hasNote && "bg-gray-100")}>
                                  <input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    max="20"
                                    value={score.isAbsent ? '' : (score.score ?? '')}
                                    onChange={(e) => handleScoreChange(row.studentId, subject.id, e.target.value)}
                                    disabled={score.isAbsent || cellLocked}
                                    placeholder={score.isAbsent ? 'ABS' : '—'}
                                    title={score.isAbsent ? 'Absent — géré via la colonne Présence' : undefined}
                                    className={cn(
                                      'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                      'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                      score.isAbsent && 'opacity-40 cursor-not-allowed bg-red-50 text-red-600',
                                      !score.isAbsent && !cellLocked && score.score !== null && typeof score.score === 'number' &&
                                        (Number(score.score) < 10 ? 'text-rose-600' : Number(score.score) >= 14 ? 'text-emerald-600' : 'text-slate-900'),
                                    )}
                                  />
                                </td>
                              );
                            })}
                            {/* Seuil atteint — Oui si moyenne ≥ 10/20 */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                              {avg === null ? (
                                <span className="text-slate-300">—</span>
                              ) : avg >= 10 ? (
                                <span className="text-emerald-600">Oui</span>
                              ) : (
                                <span className="text-rose-600">Non</span>
                              )}
                            </td>
                            {/* Rang — classement par moyenne */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                              {rank ? formatRang(rank, row.gender) : '—'}
                            </td>
                            {/* Appréciation — mention automatique */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-semibold">
                              <span className={cn('text-xs', appreciationSecondaireClassName(appreciation))}>
                                {appreciation}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={7 + sortedSubjects.length}
                            className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                          >
                            Aucun élève trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: '180px' }}>Nom et prénom</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-20">Présence</th>
                        {sortedSubjects.map((subject, idx) => (
                          isMaternelle ? (
                            <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[100px]">
                              {subject.name}
                              <div className="text-[9px] text-slate-400 font-normal">TS / S / PS</div>
                            </th>
                          ) : (
                            <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">
                              {subject.name}
                            </th>
                          )
                        ))}
                        {!isMaternelle && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
                        )}
                        {!isMaternelle && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Moyenne</th>
                        )}
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil fixé</th>
                        <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Seuil atteint</th>
                        {isMaternelle && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation globale</th>
                        )}
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Observation</th>
                      </tr>
                      {!isMaternelle && (
                        <tr className="bg-slate-50">
                          {sortedSubjects.map((_, idx) => (
                            <Fragment key={idx}>
                              <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                              <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                              <th className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                            </Fragment>
                          ))}
                          <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                          <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
                        </tr>
                      )}
                      {isMaternelle && (
                        <tr className="bg-slate-50">
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
                          isEN
                            ? (totalGeneral !== null && totalGeneral >= (maxScore * 0.5 * sortedSubjects.length))
                            : (totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length * 0.5))
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
                              // ⭐ FIX 2026-11-17 — hasNote basé sur le snapshot des notes
                              //    ENREGISTRÉES (pas la valeur live) : corrige le verrouillage
                              //    au premier chiffre (primaire) et au premier clic (maternelle).
                              const hasNote = savedCells.has(`${row.studentId}|${subject.id}`);
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
                              // Primaire : CM/CP/Total (maternelle traité ci-dessus,
                              // secondaire et piste EN gérés par leurs tables dédiées)
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
                            {!isMaternelle && (
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                                {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                              </td>
                            )}
                            {/* Moyenne = totalGeneral / nombre de matières évaluées */}
                            {!isMaternelle && (() => {
                              const subjectsWithScores = sortedSubjects.filter(subj => {
                                const s = row.scores[subj.id];
                                return s && typeof s.score === 'number' && !s.isAbsent;
                              }).length;
                              const moyenne = subjectsWithScores > 0 ? totalGeneral / subjectsWithScores : null;
                              return (
                                <td className="border border-slate-300 px-2 py-1 text-center font-bold text-indigo-700 bg-indigo-50">
                                  {moyenne !== null ? moyenne.toFixed(2) : '—'}
                                </td>
                              );
                            })()}
                            {/* Rang avec suffixe français */}
                            <td className="border border-slate-300 px-2 py-1 text-center font-bold text-slate-700">
                              {formatRang(rang, row.gender)}
                            </td>
                            {/* Seuil fixé — Maternelle: 'S', FR: 10, EN: 50% du barème */}
                            <td className="border border-slate-300 px-2 py-1 text-center text-slate-600 font-semibold">
                              {isMaternelle ? 'S' : isEN ? String(Math.round(maxScore * 0.5)) : '10'}
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
                            colSpan={isMaternelle ? 10 + group.subjects.length : 10 + group.subjects.length * 3}
                            className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                          >
                            Aucun élève trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  )}
                </div>
                {/* Pagination (page 1 uniquement — pas de liste d'élèves en page 2) */}
                {totalPages > 1 && !(isEN && broadsheetPage === 'report') && (
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
                    {isEN
                      ? 'Legend — Examination Broadsheet (Anglophone Track)'
                      : isMaternelle
                      ? 'Légende — Évaluation qualitative (Maternelle)'
                      : isSecondaire
                        ? 'Légende — Évaluation quantitative (Secondaire)'
                        : 'Légende — Évaluation quantitative (Primaire)'}
                  </p>
                  {isEN ? (
                    <ul className="space-y-0.5 ml-4">
                      <li><strong className="text-slate-700">Names of Scholars</strong> = pupils of the class (one row each)</li>
                      <li>Each column = one subject automatically retrieved from the assessment</li>
                      <li><strong className="text-blue-700">Average</strong> = mean of the pupil's marks · <strong className="text-emerald-700">Total</strong> = sum of marks</li>
                      <li><strong className="text-violet-700">Position</strong> = class rank (1st, 2nd, 3rd…)</li>
                      <li><strong>Marks Obtainable</strong> = maximum mark per subject (/{maxScore}) — placed <em>above</em> the pupils list, as on the PDF model</li>
                      <li><strong>Marks Obtained</strong> = highest mark obtained in the class per subject — placed <em>above</em> the pupils list</li>
                      <li className="mt-1 text-gray-500">Page 2 « Head Teacher's Report »: one comment zone per subject (+ optional extra subject), saved via « Save Remarks ».</li>
                    </ul>
                  ) : isMaternelle ? (
                    <ul className="space-y-0.5 ml-4">
                      <li><strong className="text-emerald-700">TS</strong> = Très Satisfaisant</li>
                      <li><strong className="text-blue-700">S</strong> = Satisfaisant</li>
                      <li><strong className="text-amber-700">PS</strong> = Peu Satisfaisant</li>
                      <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent</li>
                      <li className="mt-1 text-gray-500">Réussite : (TS + S) ≥ seuil fixé par l'établissement.</li>
                    </ul>
                  ) : isSecondaire ? (
                    <ul className="space-y-0.5 ml-4">
                      <li>Saisissez la <strong>note obtenue</strong> sur /20 (ex : 15.5, 12, 8.25) — une colonne par matière programmée.</li>
                      <li><strong className="text-emerald-600">Seuil atteint</strong> = moyenne des notes saisies ≥ 10/20 · <strong className="text-violet-700">Rang</strong> = classement par moyenne (ex æquo gérés).</li>
                      <li><strong>Appréciation</strong> (automatique) : ≥16 Très Bien · 14-16 Bien · 12-14 Assez Bien · 10-12 Passable · 8-10 Insuffisant · &lt;8 Faible.</li>
                      <li><strong className="text-emerald-600">P</strong> = Présent · <strong className="text-red-600">A</strong> = Absent — colonne <strong>Présence</strong> (détail par matière via ⚙) · cellule « ABS » = matière manquée.</li>
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
        language={language}
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
    {/* ⭐ Modal de demande de déverrouillage (granulaire : élèves + matières) */}
    <UnlockRequestModal
      open={unlockModalOpen}
      onClose={() => setUnlockModalOpen(false)}
      evaluationIds={group.evaluationIds}
      className={group.className}
      evaluationTypeName={group.evaluationTypeName}
      students={rows.map(r => ({ studentId: r.studentId, studentName: r.studentName, matricule: r.matricule }))}
      subjects={sortedSubjects}
    />
    </>
  );
}

// ─── Modal Présence par matière ───────────────────────────────────────────────

function PresenceModal({
  student,
  subjects,
  language,
  onClose,
  onUpdate,
  onAllPresent,
  onAllAbsent,
}: {
  student: GradeRow;
  subjects: Array<{ id: string; name: string }>;
  language?: 'FR' | 'EN';
  onClose: () => void;
  onUpdate: (studentId: string, subjectId: string, isAbsent: boolean) => void;
  onAllPresent: (studentId: string) => void;
  onAllAbsent: (studentId: string) => void;
}) {
  const isEN = language === 'EN';
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
              {isEN ? 'Attendance by Subject' : 'Présence par matière'}
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
              {presentCount} {isEN ? 'present' : 'présent' + (presentCount > 1 ? 's' : '')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              {absentCount} {isEN ? 'absent' : 'absent' + (absentCount > 1 ? 's' : '')}
            </span>
            <span className="text-gray-400">/ {subjects.length} {isEN ? 'subjects' : 'matière' + (subjects.length > 1 ? 's' : '')}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAllPresent(student.studentId)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              {isEN ? 'All Present' : 'Tout présent'}
            </button>
            <button
              onClick={() => onAllAbsent(student.studentId)}
              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
            >
              {isEN ? 'All Absent' : 'Tout absent'}
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
                  title={isEN ? 'Present' : 'Présent'}
                  >P</button>
                  <button
                    onClick={() => onUpdate(student.studentId, subject.id, true)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                      isAbsent ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-red-100'
                    )}
                  title={isEN ? 'Absent' : 'Absent'}
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
            {isEN ? 'Close' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}
