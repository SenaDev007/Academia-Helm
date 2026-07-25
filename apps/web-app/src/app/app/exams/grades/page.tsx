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
  RefreshCw, Search, GraduationCap, School, AlertCircle, CheckCircle2,
  ClipboardList, Settings, ShieldCheck,
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
  scores: Record<string, { score: number | null; qualitativeCode: string | null; isAbsent: boolean; comment: string }>;
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
                    ? 'Quantitatif (/20) — Évaluation primaire'
                    : 'Quantitatif (/20) avec coefficients — Évaluation secondaire'}
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
  onBack,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  isPrimaire: boolean;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { academicYear } = useModuleContext();

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

        // Construire la map evaluationId → subjectId
        const evalToSubject = new Map<string, string>();
        // Refetch les évaluations avec leur subject via institutionalExamsService
        try {
          const evalsRes = await institutionalExamsService.getEvaluations({
            academicYearId: academicYear?.id || '',
            schoolLevelId: group.classId,
          });
          const evalsWithSubject = (Array.isArray(evalsRes) ? evalsRes : []).filter(
            (ev: Evaluation) => group.evaluationIds.includes(ev.id)
          );
          evalsWithSubject.forEach((ev: Evaluation) => {
            if (ev.subject?.id) {
              evalToSubject.set(ev.id, ev.subject.id);
            }
          });
        } catch (err) {
          console.warn('Failed to fetch evaluations for subject mapping', err);
        }

        // Fallback : si on n'arrive pas à résoudre, on associe par ordre
        if (evalToSubject.size === 0 && group.subjects.length === group.evaluationIds.length) {
          group.evaluationIds.forEach((evId, i) => {
            evalToSubject.set(evId, group.subjects[i].id);
          });
        }

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
        const existing = row.scores[subjectId] || { score: null, qualitativeCode: null, isAbsent: false, comment: '' };
        let updated: any;
        if (isMaternelle) {
          // Mode qualitatif : value = TS/S/PS
          updated = { ...existing, qualitativeCode: value === '' ? null : value };
        } else {
          // Mode quantitatif : value = "12.5" → parse en number
          updated = { ...existing, score: value === '' ? null : parseFloat(value) };
        }
        return { ...row, scores: { ...row.scores, [subjectId]: updated } };
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
      // Refetch les évaluations pour résoudre evaluationId → subjectId
      let evalsWithSubject: Evaluation[] = [];
      try {
        const evalsRes = await institutionalExamsService.getEvaluations({
          academicYearId: academicYear?.id || '',
          schoolLevelId: group.classId,
        });
        evalsWithSubject = (Array.isArray(evalsRes) ? evalsRes : []).filter(
          (e: Evaluation) => group.evaluationIds.includes(e.id)
        );
      } catch (err) {
        console.warn('Failed to fetch evaluations for save', err);
      }

      // Sauvegarder chaque évaluation du groupe séparément
      await Promise.all(
        group.evaluationIds.map(async (evId) => {
          const ev = evalsWithSubject.find((e) => e.id === evId);
          const subjectId = ev?.subject?.id;
          if (!subjectId) return;

          // Filtrer les grades pour ce sujet
          const gradesForEval = rows
            .filter((row) => row.scores[subjectId])
            .map((row) => ({
              studentId: row.studentId,
              subjectId,
              score: row.scores[subjectId].score,
              qualitativeCode: row.scores[subjectId].qualitativeCode,
              isAbsent: row.scores[subjectId].isAbsent,
              comment: row.scores[subjectId].comment,
              status: submit ? 'SUBMITTED' : 'DRAFT',
            }));

          await apiClient.post(
            `/institutional-exams/grades/evaluation/${evId}/bulk`,
            gradesForEval,
          );
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
    if (rows.length === 0) return { filled: 0, total: 0, absent: 0 };
    let filled = 0;
    let absent = 0;
    let total = 0;
    rows.forEach((row) => {
      group.subjects.forEach((subject) => {
        const score = row.scores[subject.id];
        if (!score) return;
        total++;
        if (score.isAbsent) {
          absent++;
        } else if (isMaternelle ? score.qualitativeCode : score.score !== null) {
          filled++;
        }
      });
    });
    return { filled, total, absent };
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
    <ModuleContainer
      header={{
        title: `Fiche de saisie — ${group.evaluationTypeName}`,
        description: `${group.className} · ${group.periodName} · ${dateRange}`,
        icon: 'clipboardList',
      }}
      subModules={{ modules: scopedSubModules, activeModuleId: 'grades' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-1" />
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Absents</p>
                    <p className="text-2xl font-black mt-1 text-rose-700">{stats.absent}</p>
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

                {/* Fiche de saisie (tableau registre) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                        <TableHead className="w-10 text-center text-xs font-black text-gray-400">
                          N°
                        </TableHead>
                        <TableHead className="text-xs font-black text-gray-600 uppercase tracking-wider min-w-[180px]">
                          Nom et Prénom
                        </TableHead>
                        <TableHead className="text-xs font-black text-gray-600 uppercase tracking-wider w-24">
                          Matricule
                        </TableHead>

                        {/* Une colonne par matière programmée */}
                        {group.subjects.map((subject) => (
                          <TableHead
                            key={subject.id}
                            className="text-center text-xs font-black text-gray-600 uppercase tracking-wider min-w-[140px]"
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{subject.name}</span>
                              <span className="text-[9px] text-gray-400 font-normal">
                                {isMaternelle ? 'TS / S / PS' : `/20`}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row, idx) => (
                        <TableRow
                          key={row.studentId}
                          className={cn('group transition-colors hover:bg-blue-50/20')}
                        >
                          <TableCell className="text-center text-xs text-gray-400 font-mono">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-gray-900 text-sm">
                              {row.studentName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-500 font-mono">
                              {row.matricule || '—'}
                            </span>
                          </TableCell>

                          {/* Une cellule par matière */}
                          {group.subjects.map((subject) => {
                            const score = row.scores[subject.id] || {
                              score: null,
                              qualitativeCode: null,
                              isAbsent: false,
                              comment: '',
                            };
                            return (
                              <TableCell key={subject.id} className="text-center py-2">
                                {isMaternelle ? (
                                  // ⭐ Mode qualitatif maternelle : boutons TS/S/PS
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
                                ) : (
                                  // ⭐ Mode quantitatif : input /20 + checkbox absent
                                  <div className="flex items-center justify-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      max="20"
                                      value={score.isAbsent ? '' : (score.score ?? '')}
                                      onChange={(e) =>
                                        handleScoreChange(row.studentId, subject.id, e.target.value)
                                      }
                                      disabled={score.isAbsent}
                                      placeholder="—"
                                      className={cn(
                                        'w-16 h-9 text-center font-bold text-sm border-gray-200',
                                        'focus:border-blue-400 focus:ring-1 focus:ring-blue-200',
                                        score.isAbsent && 'opacity-30 cursor-not-allowed',
                                        !score.isAbsent && score.score !== null && typeof score.score === 'number' &&
                                          (Number(score.score) < 10
                                            ? 'text-rose-600'
                                            : Number(score.score) >= 14
                                              ? 'text-emerald-600'
                                              : 'text-gray-900')
                                      )}
                                    />
                                    <input
                                      type="checkbox"
                                      checked={score.isAbsent}
                                      onChange={(e) =>
                                        handleAbsentToggle(row.studentId, subject.id, e.target.checked)
                                      }
                                      title="Absent"
                                      className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-300"
                                    />
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}

                      {filteredRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={group.subjects.length + 3} className="text-center py-12 text-gray-400 text-sm">
                            Aucun élève trouvé.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Légende */}
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                  <p className="font-semibold mb-1">
                    {isMaternelle
                      ? 'Légende — Évaluation qualitative (Maternelle)'
                      : 'Légende — Évaluation quantitative (Primaire)'}
                  </p>
                  {isMaternelle ? (
                    <ul className="space-y-0.5 ml-4">
                      <li><strong className="text-emerald-700">TS</strong> = Très Satisfaisant</li>
                      <li><strong className="text-blue-700">S</strong> = Satisfaisant</li>
                      <li><strong className="text-amber-700">PS</strong> = Peu Satisfaisant</li>
                      <li className="mt-1 text-gray-500">Réussite : (TS + S) ≥ seuil fixé par l'établissement.</li>
                    </ul>
                  ) : (
                    <ul className="space-y-0.5 ml-4">
                      <li>Saisissez la note sur 20 (ex: 15.5, 12, 8.25).</li>
                      <li>Cliquez sur la case "Absent" si l'élève n'était pas présent.</li>
                      <li className="text-emerald-700">Notes ≥ 10 : admis (en vert).</li>
                      <li className="text-rose-700">Notes &lt; 10 : échec (en rouge).</li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        ),
      }}
    />
  );
}
