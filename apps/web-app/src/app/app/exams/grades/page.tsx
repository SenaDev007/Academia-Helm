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
import { cn } from "@/lib/utils";
import { GradingSheet, type GroupedEvaluation } from "@/components/exams/GradingSheet";
import { HierarchicalEvaluationList } from "@/components/exams/HierarchicalEvaluationList";

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
              <HierarchicalEvaluationList
                groups={filteredGroups}
                onGroupClick={handleOpenGroup}
                filterFn={(g) => g.statuses.some(s => s === 'OPEN_FOR_GRADING' || s === 'PLANNED')}
                isMaternelle={isMaternelle}
                renderStatusBadge={(g) => {
                  const canGrade = g.statuses.some(s => s === 'OPEN_FOR_GRADING' || s === 'PLANNED');
                  const isLocked = g.statuses.every(s => s === 'SUBMITTED' || s === 'VALIDATED' || s === 'LOCKED');
                  const status = isLocked ? 'Soumise' : canGrade ? 'Saisie ouverte' : 'Planifiée';
                  const color = isLocked ? 'bg-emerald-100 text-emerald-700' : canGrade ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
                  return <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap', color)}>{status}</span>;
                }}
              />
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

