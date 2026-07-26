/**
 * ============================================================================
 * MODULE EXAMENS — SAISIE DES NOTES (Fiche par évaluation groupée)
 * ============================================================================
 *
 * PRINCIPE : 1 fiche de saisie par "programmation d'évaluation" (groupe).
 * - Lignes : élèves de la classe
 * - Colonnes : matières programmées pour cette évaluation (chargement dynamique)
 * - Maternelle : chaque cellule = 3 boutons TS/S/PS (qualitatif)
 * - Primaire : chaque cellule = input /20 (quantitatif)
 *
 * Modèle reproduit :
 *   - Maternelle : registre d'appel avec domaines en colonnes + TS/S/PS
 *   - Primaire : registre avec matières en colonnes + note /20
 *
 * Sources de données :
 *   - GET /api/institutional-exams/evaluations — liste filtrée par niveau + langue
 *   - GET /api/institutional-exams/grades/evaluation/:id — élèves + notes existantes
 *   - POST /api/institutional-exams/grades/evaluation/:id/bulk — sauvegarde
 * ============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Save, Send, ChevronLeft, Calendar, Users, BookOpen, Loader2,
  RefreshCw, Search, GraduationCap, School, AlertCircle, CheckCircle2, XCircle,
  ClipboardList, Settings, ShieldCheck, Settings2, X,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import apiClient from '@/lib/api/client';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evaluation {
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

interface GroupedEvaluation {
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

interface GradeRow {
  studentId: string;
  studentName: string;
  matricule?: string;
  gender?: string;
  // Une note par matière (subjectId → note)
  // Pour Maternelle : qualitativeCode (TS/S/PS)
  // Pour Primaire : cm (/18) + cp (/2) + total = cm + cp
  // Pour Secondaire : score (/20)
  scores: Record<string, {
    score: number | null;          // score global /20 (secondaire) ou total (primaire)
    cm: number | null;             // Critère Maximal /18 (primaire uniquement)
    cp: number | null;             // Critère de Perfectionnement /2 (primaire, si cm ≥ 10)
    qualitativeCode: string | null; // TS/S/PS (maternelle)
    isAbsent: boolean;
    comment: string;
  }>;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLASS_ORDER = [
  'MATERNELLE 1', 'MATERNELLE 2', 'MATERNELLE 3',
  'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
  'PS', 'MS', 'GS',
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6E', '6ÈME', '5E', '5ÈME', '4E', '4ÈME', '3E', '3ÈME',
  'SECONDE', 'PREMIERE', 'PREMIÈRE', 'TERMINALE',
];

function getClassOrderIndex(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  const exact = CLASS_ORDER.indexOf(upper);
  if (exact >= 0) return exact;
  for (let i = 0; i < CLASS_ORDER.length; i++) {
    if (upper.startsWith(CLASS_ORDER[i])) return i;
  }
  return CLASS_ORDER.length;
}

// ⭐ Ordre des matières pour le PRIMAIRE (selon le registre d'appel)
const PRIMAIRE_SUBJECT_ORDER = [
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

// ⭐ Ordre des matières pour la MATERNELLE (selon le registre d'appel)
const MATERNELLE_SUBJECT_ORDER = [
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

function getSubjectOrderIndex(name: string, isMaternelle: boolean, isPrimaire: boolean): number {
  const upper = (name || '').toUpperCase().trim();
  const order = isMaternelle ? MATERNELLE_SUBJECT_ORDER : isPrimaire ? PRIMAIRE_SUBJECT_ORDER : [];
  for (let i = 0; i < order.length; i++) {
    if (upper === order[i] || upper.includes(order[i])) return i;
  }
  return order.length; // matières inconnues à la fin
}

function formatDate(d: string | null): string {
  if (!d) return 'Date non définie';
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: fr });
  } catch {
    return d;
  }
}

// ─── Page Principale ──────────────────────────────────────────────────────────

export default function GradesPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  // Résolution du niveau scolaire (comme evaluations/page.tsx)
  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;
  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isPrimaire = scopeLevel === 'PRIMAIRE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupedEvaluation | null>(null);

  // ── Chargement des évaluations ────────────────────────────────────────────
  const loadEvaluations = useCallback(async () => {
    if (!schoolLevelUuid || !academicYear?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        schoolLevelId: schoolLevelUuid,
        academicYearId: academicYear.id,
      };
      if (scopeLang) params.language = scopeLang;
      const res = await institutionalExamsService.getEvaluations(params);
      setEvaluations(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading evaluations', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [schoolLevelUuid, academicYear?.id, scopeLang]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // ── Grouper les évaluations (comme evaluations/page.tsx) ────────────────────
  const grouped = useMemo<GroupedEvaluation[]>(() => {
    const map = new Map<string, GroupedEvaluation>();
    for (const ev of evaluations) {
      const classId = ev.class?.id || '_no_class';
      const evaluationTypeId = ev.evaluationType?.id || '_no_type';
      const periodId = ev.period?.id || '_no_period';
      const sd = ev.startDate || ev.evaluationDate || '';
      const ed = ev.endDate || ev.startDate || ev.evaluationDate || '';
      const key = `${classId}|${evaluationTypeId}|${periodId}|${sd}|${ed}`;

      if (!map.has(key)) {
        map.set(key, {
          classId,
          className: ev.class?.name || 'Sans classe',
          evaluationTypeId,
          evaluationTypeName: ev.evaluationType?.name || 'Évaluation',
          evaluationTypeCode: ev.evaluationType?.code,
          periodId,
          periodName: ev.period?.name || '',
          startDate: ev.startDate || null,
          endDate: ev.endDate || null,
          subjects: [],
          evaluationIds: [],
          statuses: [],
          firstEvaluation: ev,
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values()).sort((a, b) => {
      const classCmp = getClassOrderIndex(a.className) - getClassOrderIndex(b.className);
      if (classCmp !== 0) return classCmp;
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
  }, [evaluations]);

  // Filtrer par recherche
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase().trim();
    return grouped.filter((g) =>
      g.className.toLowerCase().includes(q) ||
      g.evaluationTypeName.toLowerCase().includes(q) ||
      g.subjects.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [grouped, searchQuery]);

  // ── Ouvrir la fiche de saisie pour un groupe ──────────────────────────────
  const handleOpenGroup = (group: GroupedEvaluation) => {
    // Ne permettre la saisie que si au moins une évaluation est OPEN_FOR_GRADING
    const canGrade = group.statuses.some((s) => s === 'OPEN_FOR_GRADING' || s === 'PLANNED');
    if (!canGrade) {
      toastError('Évaluations non ouvertes pour la saisie', {
        description: 'Ouvrez les évaluations pour la saisie depuis l\'onglet Évaluations.',
      });
      return;
    }
    setSelectedGroup(group);
  };

  // ── Si un groupe est sélectionné, afficher la fiche de saisie ──────────────
  if (selectedGroup) {
    return (
      <GradingSheet
        group={selectedGroup}
        isMaternelle={isMaternelle}
        isPrimaire={isPrimaire}
        isSecondaire={isSecondaire}
        scopedSubModules={scopedSubModules}
        onBack={() => setSelectedGroup(null)}
      />
    );
  }

  // ── Vue liste des groupes ──────────────────────────────────────────────────
  return (
    <ModuleContainer
      header={{
        title: 'Saisie des Notes',
        description: 'Sélectionnez une évaluation pour saisir les notes. Les matières programmées apparaissent automatiquement comme colonnes.',
        icon: 'clipboardList',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'grades' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Barre de recherche */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par classe, matière, type..."
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={loadEvaluations} disabled={loading}>
                <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                Actualiser
              </Button>
            </div>

            {/* Indicateur de mode (Maternelle qualitative / Primaire quantitative) */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <Settings className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-bold">Mode de saisie :</span>{' '}
                {isMaternelle
                  ? 'Qualitatif (TS / S / PS) — Évaluation maternelle'
                  : isPrimaire
                    ? 'Quantitatif (/20) avec CM + CP — Évaluation primaire'
                    : 'Quantitatif (/20) — Évaluation secondaire'}
              </p>
            </div>

            {/* Liste des évaluations groupées */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">Chargement des évaluations…</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">Aucune évaluation disponible</p>
                <p className="text-sm text-gray-400">
                  Créez et ouvrez des évaluations dans l'onglet Évaluations pour commencer la saisie.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredGroups.map((group, idx) => (
                  <EvaluationGroupCard
                    key={`${group.classId}-${group.evaluationTypeId}-${idx}`}
                    group={group}
                    isMaternelle={isMaternelle}
                    onClick={() => handleOpenGroup(group)}
                  />
                ))}
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}

// ─── Carte de groupe d'évaluation (vue liste) ────────────────────────────────

function EvaluationGroupCard({
  group,
  isMaternelle,
  onClick,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  onClick: () => void;
}) {
  // Statut agrégé
  const canGrade = group.statuses.some((s) => s === 'OPEN_FOR_GRADING' || s === 'PLANNED');
  const isLocked = group.statuses.every((s) => s === 'VALIDATED' || s === 'LOCKED' || s === 'SUBMITTED');
  const isCancelled = group.statuses.some((s) => s === 'CANCELLED');

  const headerStatus = isLocked
    ? 'Verrouillée'
    : isCancelled
      ? 'Annulée'
      : canGrade
        ? 'Saisie ouverte'
        : 'Planifiée';

  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  const sameDay =
    startDate && endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  const fmtLong = (d: Date) => format(d, 'd MMM yyyy', { locale: fr });
  const dateRange = startDate
    ? sameDay || !endDate
      ? `Le ${fmtLong(startDate)}`
      : `Du ${fmtLong(startDate)} au ${fmtLong(endDate)}`
    : 'Date non définie';

  const subjectCount = group.subjects.length;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left flex flex-col overflow-visible"
    >
      {/* En-tête */}
      <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(group.className || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-navy-900 truncate">{group.className}</h3>
              <p className="text-xs text-gray-500">
                {subjectCount} matière{subjectCount > 1 ? 's' : ''} à évaluer
              </p>
            </div>
          </div>
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap',
            isLocked ? 'bg-emerald-100 text-emerald-700'
            : isCancelled ? 'bg-red-100 text-red-700'
            : canGrade ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
          )}>
            {headerStatus}
          </span>
        </div>
      </div>

      {/* Corps */}
      <div className="p-5 flex-1 space-y-3">
        <div>
          <p className="text-sm font-semibold text-navy-900">
            {group.evaluationTypeCode ? `[${group.evaluationTypeCode}] ` : ''}
            {group.evaluationTypeName}
          </p>
          {group.periodName && (
            <p className="text-xs text-gray-500 mt-0.5">{group.periodName}</p>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
          <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="font-medium">{dateRange}</span>
        </div>

        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Matières à évaluer
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.subjects.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
              >
                {s.name}
              </span>
            ))}
            {group.subjects.length === 0 && (
              <span className="text-xs text-gray-400 italic">Aucune matière</span>
            )}
          </div>
        </div>

        {/* Mode de saisie (qualitatif / quantitatif) */}
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-semibold',
            isMaternelle ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
          )}>
            {isMaternelle ? 'TS / S / PS' : '/ 20'}
          </span>
          <span className="text-xs text-gray-500">
            {group.subjects.length} matière{group.subjects.length > 1 ? 's' : ''} · {group.evaluationIds.length} élève(s) max
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Fiche de saisie (vue détaillée) ─────────────────────────────────────────

function GradingSheet({
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
  // ⭐ Modal présence par matière
  const [presenceModalStudent, setPresenceModalStudent] = useState<GradeRow | null>(null);

  // ⭐ Trier les matières selon l'ordre pédagogique (Primaire/Maternelle)
  const sortedSubjects = useMemo(() => {
    return [...group.subjects].sort((a, b) =>
      getSubjectOrderIndex(a.name, isMaternelle, isPrimaire) -
      getSubjectOrderIndex(b.name, isMaternelle, isPrimaire)
    );
  }, [group.subjects, isMaternelle, isPrimaire]);

  // ── Charger les élèves + notes existantes pour chaque évaluation ─────────
  useEffect(() => {
    const loadSheet = async () => {
      if (!group.evaluationIds.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch la grading sheet pour chaque évaluation du groupe via apiClient
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

        // ⭐ Construire la map evaluationId → subjectId
        // Le mapping est direct : evaluationIds[i] → subjects[i]
        // (garanti par la construction du group dans le useMemo du parent)
        const evalToSubject = new Map<string, string>();
        group.evaluationIds.forEach((evId, idx) => {
          const subjectId = group.subjects[idx]?.id;
          if (subjectId) {
            evalToSubject.set(evId, subjectId);
          }
        });

        // Construire la map studentId → GradeRow
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

        // S'assurer que tous les sujets du groupe sont initialisés pour chaque élève
        const rowsArray = Array.from(studentMap.values());
        rowsArray.forEach((row) => {
          group.subjects.forEach((subject) => {
            if (!row.scores[subject.id]) {
              row.scores[subject.id] = {
                score: null,
                cm: null,
                cp: null,
                qualitativeCode: null,
                isAbsent: false,
                comment: '',
              };
            }
          });
        });

        // Trier par nom
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

  // ── Handlers de modification des notes ────────────────────────────────────

  const handleScoreChange = (studentId: string, subjectId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
        let updated: any;
        if (isMaternelle) {
          // Mode qualitatif : value = TS/S/PS
          updated = { ...existing, qualitativeCode: value === '' ? null : value };
        } else {
          // Mode quantitatif : value = "12.5" → parse en number (score global /20)
          updated = { ...existing, score: value === '' ? null : parseFloat(value) };
        }
        return { ...row, scores: { ...row.scores, [subjectId]: updated } };
      })
    );
  };

  // ⭐ Primaire : gestion CM (/18) et CP (/2)
  // - CM = Critère Maximal, noté sur 18
  // - CP = Critère de Perfectionnement, noté sur 2
  //   ⭐ Règle : CP possible uniquement si CM ≥ 10. Sinon CP = 0.
  // - Total = CM + CP (max /20)
  const handleCmChange = (studentId: string, subjectId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, cm: null, cp: null, qualitativeCode: null, isAbsent: false, comment: '' };
        const cm = value === '' ? null : Math.min(18, Math.max(0, parseFloat(value) || 0));
        // Si CM < 10, forcer CP = 0
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
        // ⭐ CP possible uniquement si CM ≥ 10
        if (existing.cm === null || existing.cm < 10) {
          return row; // Ne pas modifier
        }
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

  const handleAbsentToggle = (studentId: string, subjectId: string, absent: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const existing = row.scores[subjectId] || { score: null, qualitativeCode: null, isAbsent: false, comment: '' };
        return {
          ...row,
          scores: {
            ...row.scores,
            [subjectId]: { ...existing, isAbsent: absent },
          },
        };
      })
    );
  };

  // ── Sauvegarder ────────────────────────────────────────────────────────────

  const handleSave = async (submit = false) => {
    setSaving(true);
    try {
      // ⭐ Sauvegarder chaque évaluation du groupe séparément.
      // Le backend utilise evaluation.subjectId (pas besoin de le résoudre côté frontend).
      // On envoie TOUS les élèves pour chaque évaluation — le backend crée
      // un Grade par (evaluation × student) avec le bon subjectId.
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          // Pour cette évaluation, trouver le subjectId correspondant.
          // Le mapping evaluationId → subjectId vient du load initial
          // (chaque évaluation a un subjectId dans evaluation.subject.id).
          // Comme on n'a pas directement accès aux evaluations originales ici,
          // on construit un mapping à partir du premier élément du group.
          // ⭐ En pratique, chaque évaluation du groupe a UN subjectId unique.
          // On les a dans l'ordre : evaluationIds[0] → subjects[0], etc.
          // (garanti par la construction du group dans le useMemo)
          const evIndex = group.evaluationIds.indexOf(evId);
          const subjectId = group.subjects[evIndex]?.id;

          if (!subjectId) {
            console.warn(`No subjectId found for evaluation ${evId}, skipping`);
            return;
          }

          // Envoyer tous les élèves avec leur note pour cette matière
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

          if (gradesForEval.length === 0) {
            console.warn(`No grades to save for evaluation ${evId} (subject ${subjectId})`);
            return;
          }

          try {
            const response = await apiClient.post(
              `/institutional-exams/grades/evaluation/${evId}/bulk`,
              gradesForEval,
            );
            console.log(`[handleSave] Evaluation ${evId}: ${gradesForEval.length} grades saved`, response.data);
          } catch (err: any) {
            console.error(`[handleSave] Failed to save evaluation ${evId}:`, err.response?.data || err.message);
            throw err;
          }
        })
      );

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

  // ── Filtrer par recherche ─────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) =>
      r.studentName.toLowerCase().includes(q) ||
      (r.matricule || '').toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (rows.length === 0) return { filled: 0, total: 0, absent: 0, studentsAbsent: 0 };
    let filled = 0;
    let absent = 0;  // absences par matière (1 élève × 1 matière = 1 absence)
    let total = 0;
    const absentStudentIds = new Set<string>();  // élèves avec au moins 1 absence
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

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const startDate = group.startDate ? new Date(group.startDate) : null;
  const endDate = group.endDate ? new Date(group.endDate) : null;
  const sameDay =
    startDate && endDate &&
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
            {/* Action Bar */}
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
              <Button variant="ghost" onClick={onBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour à la liste
              </Button>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-blue-200 text-blue-600 text-xs gap-1">
                  <Users className="w-3 h-3" />
                  {rows.length} élèves
                </Badge>
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 text-xs gap-1">
                  <BookOpen className="w-3 h-3" />
                  {group.subjects.length} matières
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-600 text-xs gap-1">
                  {isMaternelle ? 'TS/S/PS' : `/20`}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving || loading}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Sauvegarder
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={saving || loading}
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
                {/* Recherche élève */}
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un élève…"
                    className="pl-9 text-sm border-gray-200 bg-white"
                  />
                </div>

                {/* Fiche de saisie (tableau registre — comme AttendanceRegisterTab) */}
                <div className="bg-white border-2 border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      {/* Ligne 1 : N° + Nom + Sexe + Présence + Matières + Total + Seuil */}
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
                            // ⭐ Secondaire : 1 seule colonne Note /20
                            <th key={idx} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">
                              {subject.name}
                              <div className="text-[9px] text-slate-400 font-normal">Note /20</div>
                            </th>
                          ) : (
                            // ⭐ Primaire : 3 sous-colonnes CM/CP/Total (colSpan=3)
                            <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">
                              {subject.name}
                            </th>
                          )
                        ))}
                        {!isMaternelle && !isSecondaire && (
                          <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>
                        )}
                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil</th>
                      </tr>
                      {/* Ligne 2 : pour Primaire uniquement, CM/18 + CP/2 + Total par matière */}
                      {!isMaternelle && !isSecondaire && (
                        <tr className="bg-slate-50">
                          {sortedSubjects.map((_, idx) => (
                            <>
                              <th key={`cm-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM /18</th>
                              <th key={`cp-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP /2</th>
                              <th key={`tot-h-${idx}`} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th>
                            </>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => {
                        // Pour Primaire et Secondaire : calculer le total général
                        const totalGeneral = isMaternelle ? null : sortedSubjects.reduce((sum, subj) => {
                          const s = row.scores[subj.id];
                          return sum + (s && typeof s.score === 'number' && !s.isAbsent ? s.score : 0);
                        }, 0);
                        // Seuil de réussite : 10/20 par matière, ou total ≥ 10 × nb matières
                        const seuilAtteint = isMaternelle ? null : (
                          totalGeneral !== null && totalGeneral >= (10 * sortedSubjects.length * 0.5)
                        );

                        return (
                          <tr
                            key={row.studentId}
                            className={cn(
                              'hover:bg-slate-50 transition-colors',
                              idx % 2 === 1 && 'bg-slate-50/50',
                              row.scores[sortedSubjects[0]?.id]?.isAbsent && 'bg-red-50/30'
                            )}
                          >
                            <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-600">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 font-medium text-slate-900">
                              {row.studentName}
                            </td>
                            <td className="border border-slate-300 px-2 py-1 text-center">
                              {row.gender === 'M' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700">M</span>
                              ) : row.gender === 'F' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">F</span>
                              ) : '—'}
                            </td>
                            {/* ⭐ Colonne Présence : P/A global + bouton Détailler pour par-matière */}
                            <td className="border border-slate-300 px-1 py-1 text-center">
                              {(() => {
                                // Calculer l'état agrégé
                                const allPresent = !Object.values(row.scores).some((s) => s?.isAbsent);
                                const allAbsent = sortedSubjects.every((subj) => row.scores[subj.id]?.isAbsent);
                                const isMixed = !allPresent && !allAbsent;
                                return (
                                  <div className="flex gap-0.5 justify-center items-center">
                                    {/* P = tout présent */}
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
                                        allPresent
                                          ? 'bg-emerald-600 text-white'
                                          : isMixed
                                            ? 'bg-gray-100 text-gray-600 hover:bg-emerald-100'
                                            : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'
                                      )}
                                    >
                                      P
                                    </button>
                                    {/* A = tout absent */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRows((prev) => prev.map((r) => {
                                          if (r.studentId !== row.studentId) return r;
                                          const newScores = { ...r.scores };
                                          sortedSubjects.forEach((subj) => {
                                            newScores[subj.id] = {
                                              ...newScores[subj.id],
                                              isAbsent: true,
                                              score: null,
                                              qualitativeCode: null,
                                            };
                                          });
                                          return { ...r, scores: newScores };
                                        }));
                                      }}
                                      title="Absent (toutes matières)"
                                      className={cn(
                                        'px-2 py-1 rounded text-xs font-bold transition',
                                        allAbsent
                                          ? 'bg-red-600 text-white'
                                          : isMixed
                                            ? 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                            : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                                      )}
                                    >
                                      A
                                    </button>
                                    {/* ⭐ Bouton Détailler : ouvre le modal par matière */}
                                    <button
                                      type="button"
                                      onClick={() => setPresenceModalStudent(row)}
                                      title="Détailler la présence par matière"
                                      className={cn(
                                        'px-1.5 py-1 rounded text-xs transition',
                                        isMixed
                                          ? 'bg-amber-500 text-white'
                                          : 'bg-gray-100 text-gray-500 hover:bg-amber-100'
                                      )}
                                    >
                                      <Settings2 className="w-3 h-3" />
                                    </button>
                                    {/* Badge mixte */}
                                    {isMixed && (
                                      <span className="text-[9px] font-bold text-amber-600 ml-0.5" title="Présence mixte — cliquez sur l'icône pour détailler">
                                        ⚠
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {sortedSubjects.map((subject) => {
                              const score = row.scores[subject.id] || {
                                score: null,
                                cm: null,
                                cp: null,
                                qualitativeCode: null,
                                isAbsent: false,
                                comment: '',
                              };
                              if (isMaternelle) {
                                return (
                                  <td key={subject.id} className="border border-slate-300 px-1 py-1 text-center">
                                    <div className="flex gap-1 justify-center">
                                      {['TS', 'S', 'PS'].map((opt) => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() =>
                                            !score.isAbsent &&
                                            handleScoreChange(row.studentId, subject.id, opt)
                                          }
                                          disabled={score.isAbsent}
                                          title={
                                            opt === 'TS' ? 'Très Satisfaisant' :
                                            opt === 'S' ? 'Satisfaisant' :
                                            'Peu Satisfaisant'
                                          }
                                          className={cn(
                                            'px-2 py-1 rounded text-xs font-bold transition',
                                            score.qualitativeCode === opt
                                              ? opt === 'TS'
                                                ? 'bg-emerald-600 text-white'
                                                : opt === 'S'
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-amber-600 text-white'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                                            score.isAbsent && 'opacity-30 cursor-not-allowed'
                                          )}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                );
                              }
                              if (isSecondaire) {
                                // ⭐ Secondaire : 1 seule cellule Note /20
                                return (
                                  <td key={subject.id} className="border border-slate-300 p-0">
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="20"
                                      value={score.isAbsent ? '' : (score.score ?? '')}
                                      onChange={(e) => handleScoreChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent}
                                      placeholder="—"
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                        !score.isAbsent && score.score !== null && typeof score.score === 'number' &&
                                          (Number(score.score) < 10
                                            ? 'text-rose-600'
                                            : Number(score.score) >= 14
                                              ? 'text-emerald-600'
                                              : 'text-slate-900')
                                      )}
                                    />
                                  </td>
                                );
                              }
                              // ⭐ Primaire : 3 cellules (CM /18 + CP /2 + Total)
                              // CM = Critère Maximal /18
                              // CP = Critère de Perfectionnement /2 (uniquement si CM ≥ 10)
                              // Total = CM + CP (max /20)
                              const cmValue = score.cm ?? null;
                              const cpValue = score.cp ?? null;
                              const totalValue = (cmValue !== null ? cmValue : 0) + (cpValue !== null ? cpValue : 0);
                              const cpEnabled = cmValue !== null && cmValue >= 10;
                              return (
                                <>
                                  <td key={`cm-${subject.id}`} className="border border-slate-300 p-0">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="18"
                                      value={score.isAbsent ? '' : (cmValue ?? '')}
                                      onChange={(e) => handleCmChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent}
                                      placeholder="—"
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed bg-red-50',
                                        !score.isAbsent && cmValue !== null && typeof cmValue === 'number' &&
                                          (Number(cmValue) < 10
                                            ? 'text-rose-600'
                                            : Number(cmValue) >= 14
                                              ? 'text-emerald-600'
                                              : 'text-slate-900')
                                      )}
                                    />
                                  </td>
                                  <td key={`cp-${subject.id}`} className="border border-slate-300 p-0">
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="2"
                                      value={score.isAbsent ? '' : (cpValue ?? '')}
                                      onChange={(e) => handleCpChange(row.studentId, subject.id, e.target.value)}
                                      disabled={score.isAbsent || !cpEnabled}
                                      placeholder="—"
                                      title={cpEnabled ? 'Critère de Perfectionnement (0, 1 ou 2)' : 'CP disponible uniquement si CM ≥ 10'}
                                      className={cn(
                                        'w-full px-1 py-1 text-center text-xs font-bold border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-blue-400',
                                        (score.isAbsent || !cpEnabled) && 'opacity-30 cursor-not-allowed bg-slate-50',
                                        cpEnabled && cpValue !== null && typeof cpValue === 'number' && Number(cpValue) > 0 && 'text-emerald-600'
                                      )}
                                    />
                                  </td>
                                  <td key={`tot-${subject.id}`} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">
                                    {score.isAbsent ? '—' : (cmValue !== null || cpValue !== null ? Number(totalValue).toFixed(2) : '—')}
                                  </td>
                                </>
                              );
                            })}

                            {/* Total général (Primaire et Secondaire) */}
                            {!isMaternelle && !isSecondaire && (
                              <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">
                                {totalGeneral !== null ? totalGeneral.toFixed(2) : '—'}
                              </td>
                            )}
                            {/* Seuil atteint */}
                            <td className="border border-slate-300 px-2 py-1 text-center">
                              {isMaternelle ? (
                                // Pour maternelle : afficher un check si tous les domaines ont une annotation
                                sortedSubjects.every((subj) => {
                                  const s = row.scores[subj.id];
                                  return s && s.qualitativeCode;
                                }) ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )
                              ) : seuilAtteint ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={isMaternelle ? 5 + group.subjects.length + 1 : isSecondaire ? 5 + group.subjects.length + 1 : 5 + group.subjects.length * 3 + 2}
                            className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm"
                          >
                            Aucun élève trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

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

    {/* ⭐ Modal Présence par matière */}
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
                  // Si absent, effacer les notes
                  ...(isAbsent ? { score: null, cm: null, cp: null, qualitativeCode: null } : {}),
                },
              },
            };
          }));
          // Mettre à jour le modal avec les nouvelles données
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
              newScores[subj.id] = {
                ...newScores[subj.id],
                isAbsent: true,
                score: null,
                cm: null,
                cp: null,
                qualitativeCode: null,
              };
            });
            return { ...r, scores: newScores };
          }));
          setPresenceModalStudent((prev) => {
            if (!prev || prev.studentId !== studentId) return prev;
            const newScores = { ...prev.scores };
            sortedSubjects.forEach((subj) => {
              newScores[subj.id] = {
                ...newScores[subj.id],
                isAbsent: true,
                score: null,
                cm: null,
                cp: null,
                qualitativeCode: null,
              };
            });
            return { ...prev, scores: newScores };
          });
        }}
      />
    )}
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
        {/* En-tête */}
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

        {/* Résumé */}
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

        {/* Liste des matières */}
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
                      !isAbsent
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-emerald-100'
                    )}
                  >
                    P
                  </button>
                  <button
                    onClick={() => onUpdate(student.studentId, subject.id, true)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                      isAbsent
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-red-100'
                    )}
                  >
                    A
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pied */}
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
