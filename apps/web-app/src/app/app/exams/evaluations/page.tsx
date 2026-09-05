/**
 * ============================================================================
 * MODULE EXAMEN — ONGLET ÉVALUATIONS (CRUD complet)
 * ============================================================================
 *
 * Conforme au Module Examen.md — Section Onglet 3 :
 *   "Créer et gérer les évaluations : devoirs, interrogations, compositions,
 *    examens blancs, épreuves pratiques, oraux"
 *
 * Cycle de vie :
 *   DRAFT → PLANNED → OPEN_FOR_GRADING → SUBMITTED → VALIDATED → LOCKED
 *                                                ↘ CANCELLED
 *
 * Design system : aligné sur /students/classes (bouton bleu + FormModal)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Calendar, Eye, Send, Trash2, Pencil, Lock, XCircle,
  Play, CheckCircle, MoreVertical, Loader2, Settings,
} from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { academicSettingsService } from '@/services/academic-settings.service';
import { classesService } from '@/services/classes.service';
import { pedagogyService } from '@/services/pedagogy.service';
import { getAcademicYearPeriods } from '@/services/settings.service';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast/toast-helpers';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';
import { filterClassesForLevel, matchesLevelLanguage } from '../level-isolation';
import {
  getLabels, getEvaluationTypes, getMaxScoreForType,
  translatePeriodName, EN_EVALUATION_TYPES,
} from '@/lib/exam-anglophone-config';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  description?: string | null;
  evaluationDate: string;
  startDate?: string | null;
  endDate?: string | null;
  maxScore: number;
  coefficient: number;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string; schoolLevelId?: string };
  subject?: { id: string; name: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

interface ClassItem { id: string; name: string; }
interface SubjectItem { id: string; name: string; }
interface PeriodItem { id: string; name: string; type: string; isClosed: boolean; }
interface EvaluationTypeItem {
  id: string; name: string; code?: string;
  defaultMaxScore: number; defaultCoefficient: number;
  schoolLevelId?: string | null;
  isSystem?: boolean;
}

interface EvaluationForm {
  title: string;
  description: string;
  classIds: string[];        // ⭐ Sélection multiple
  subjectIds: string[];      // ⭐ Sélection multiple
  periodId: string;
  evaluationTypeId: string;
  evaluationDate: string;
  startDate: string;        // ⭐ Intervalle de dates
  endDate: string;           // ⭐ Intervalle de dates
  maxScore: string;
  coefficient: string;
}

interface EvaluationTypeForm {
  name: string;
  code: string;
  schoolLevelId: string;
  defaultMaxScore: string;
  defaultCoefficient: string;
}

const EMPTY_TYPE_FORM: EvaluationTypeForm = {
  name: '',
  code: '',
  schoolLevelId: '',
  defaultMaxScore: '20',
  defaultCoefficient: '1',
};

const EMPTY_FORM: EvaluationForm = {
  title: '',
  description: '',
  classIds: [],
  subjectIds: [],
  periodId: '',
  evaluationTypeId: '',
  evaluationDate: new Date().toISOString().slice(0, 10),
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  maxScore: '20',
  coefficient: '1',
};

// ⭐ Ordre pédagogique des classes (Maternelle → Primaire → Secondaire)
const CLASS_ORDER = [
  // Maternelle
  'MATERNELLE 1', 'MATERNELLE 2', 'MATERNELLE 3',
  'PETITE SECTION', 'MOYENNE SECTION', 'GRANDE SECTION',
  'PS', 'MS', 'GS',
  // Primaire
  'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  // Secondaire
  '6E', '6ÈME', '5E', '5ÈME', '4E', '4ÈME', '3E', '3ÈME',
  'SECONDE', 'PREMIERE', 'PREMIÈRE', 'TERMINALE',
];

function getClassOrderIndex(name: string): number {
  const upper = (name || '').toUpperCase().trim();
  // Chercher par nom exact
  const exact = CLASS_ORDER.indexOf(upper);
  if (exact >= 0) return exact;
  // Chercher par préfixe (ex: "CI A" → "CI")
  for (let i = 0; i < CLASS_ORDER.length; i++) {
    if (upper.startsWith(CLASS_ORDER[i])) return i;
  }
  return CLASS_ORDER.length; // Classes inconnues à la fin
}

// ⭐ Ordre des niveaux scolaires pour les matières
const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'];

function getLevelOrderIndex(schoolLevelId?: string, levels?: any[]): number {
  if (!schoolLevelId || !levels) return LEVEL_ORDER.length;
  const level = levels.find((l: any) => l.id === schoolLevelId);
  const code = (level?.code || '').toUpperCase();
  const idx = LEVEL_ORDER.indexOf(code);
  return idx >= 0 ? idx : LEVEL_ORDER.length;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  PLANNED: { label: 'Planifiée', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  // ⭐ OPEN_FOR_GRADING : l'enseignant a validé sa saisie, mais l'évaluation n'a
  //    pas encore été soumise au directeur depuis l'Espace Pédagogique.
  //    Badge ambre "Validée par enseignant" pour la distinguer de VALIDATED
  //    (validation admin, badge vert emerald).
  OPEN_FOR_GRADING: { label: 'Validée par enseignant', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Soumise au directeur', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  VALIDATED: { label: 'Validée', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LOCKED: { label: 'Verrouillée', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-700 border-red-200 line-through' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Composant : Cartes groupées par classe ──────────────────────────────────

interface EvaluationAction {
  label: string;
  icon: any;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

/**
 * ============================================================================
 * VUE EN CARTES — PROGRAMMATION DES ÉVALUATIONS
 * ============================================================================
 *
 * Structure :
 *   ┌─ Carte par évaluation programmée ────────────────────────────┐
 *   │  Avatar + Classe CI A  •  Statut agrégé                      │
 *   │  Type d'évaluation + Période                                  │
 *   │  Du 25 juil. 2026 → Au 28 juil. 2026  (PAS d'heure)          │
 *   │  ─────────────────────────────────────────────────────────   │
 *   │  Matières à composer :                                        │
 *   │   • Mathematics                                               │
 *   │   • English Language                                          │
 *   │   • Civic Education                                           │
 *   │  ─────────────────────────────────────────────────────────   │
 *   │  [Modifier]  [Plus d'actions ▾]                               │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Regroupement : par (classId × evaluationTypeId × periodId × startDate × endDate)
 * → toutes les matières composant la même "session d'évaluation" sont fusionnées
 *   dans une seule carte.
 *
 * Maternelle : pas de barème ni coefficient affichés.
 * Pas d'information "heure" ni "nombre de notes" — l'utilisateur veut juste
 * savoir quelles matières seront composées et sur quelle période.
 * ============================================================================
 */

interface GroupedEvaluation {
  // Clé de regroupement
  classId: string;
  className: string;
  evaluationTypeId: string;
  evaluationTypeName: string;
  evaluationTypeCode?: string;
  periodId: string;
  periodName: string;
  startDate: string | null;
  endDate: string | null;
  // Données agrégées
  subjects: Array<{ id: string; name: string }>;
  evaluationIds: string[];
  // Statut agrégé : si tous VALIDATED → "Complétée", etc.
  statuses: string[];
  // Référence vers la première évaluation (pour les actions)
  firstEvaluation: Evaluation;
  // ⭐ V10d — mapping explicite evaluationId → subjectId (robuste aux doublons)
  subjectByEvalId?: Record<string, string>;
}

function EvaluationCardsByClass({
  evaluations,
  getAvailableActions,
  onOpenEdit,
  isMaternelle,
}: {
  evaluations: Evaluation[];
  getAvailableActions: (group: GroupedEvaluation) => EvaluationAction[];
  onOpenEdit: (group: GroupedEvaluation) => void;
  isMaternelle: boolean;
}) {
  // Grouper par (classId × evaluationTypeId × periodId × startDate × endDate)
  const grouped = useMemo(() => {
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
          subjectByEvalId: {},
        });
      }
      const g = map.get(key)!;
      if (ev.subject && !g.subjects.find((s) => s.id === ev.subject!.id)) {
        g.subjects.push({ id: ev.subject.id, name: ev.subject.name });
      }
      // ⭐ V10d — mapping explicite evaluationId → subjectId (robuste aux doublons)
      if (ev.subject) g.subjectByEvalId![ev.id] = ev.subject.id;
      g.evaluationIds.push(ev.id);
      g.statuses.push(ev.status);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Trier par classe (ordre pédagogique) puis par date de début
      const classCmp = getClassOrderIndex(a.className) - getClassOrderIndex(b.className);
      if (classCmp !== 0) return classCmp;
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
  }, [evaluations]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {grouped.map((group, idx) => (
        <EvaluationProgramCard
          key={`${group.classId}-${group.evaluationTypeId}-${idx}`}
          group={group}
          isMaternelle={isMaternelle}
          actions={getAvailableActions(group)}
          onOpenEdit={() => onOpenEdit(group)}
        />
      ))}
    </div>
  );
}

/**
 * Carte individuelle : une "programmation d'évaluation" pour une classe donnée.
 * Affiche le type d'évaluation, la période, les dates, la liste des matières,
 * le statut agrégé, et les boutons d'action.
 *
 * Note : overflow-visible pour permettre au menu déroulant de dépasser la carte.
 */
function EvaluationProgramCard({
  group,
  isMaternelle,
  actions,
  onOpenEdit,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  actions: EvaluationAction[];
  onOpenEdit: () => void;
}) {
  // Formatage des dates : "25 juil. 2026" (pas d'heure)
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

  // Statut agrégé
  const allValidated = group.statuses.every((s) => s === 'VALIDATED' || s === 'LOCKED');
  const anyCancelled = group.statuses.some((s) => s === 'CANCELLED');
  const allPlanned = group.statuses.every((s) => s === 'PLANNED');
  const headerStatus = allValidated
    ? 'Complétée'
    : anyCancelled
    ? 'Partiellement annulée'
    : allPlanned
    ? 'En attente'
    : 'En cours';

  // Statut principal pour le badge (prendre le statut le plus "avancé")
  const primaryStatus = group.firstEvaluation.status;
  const subjectCount = group.subjects.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-visible">
      {/* En-tête : classe + statut */}
      <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(group.className || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-navy-900 truncate">{group.className}</h3>
              <p className="text-xs text-gray-500">
                {subjectCount} matière{subjectCount > 1 ? 's' : ''} à composer
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap ${
            allValidated ? 'bg-emerald-100 text-emerald-700'
            : anyCancelled ? 'bg-red-100 text-red-700'
            : allPlanned ? 'bg-blue-100 text-blue-700'
            : 'bg-amber-100 text-amber-700'
          }`}>
            {headerStatus}
          </span>
        </div>
      </div>

      {/* Corps : type évaluation + période + dates + matières */}
      <div className="p-5 flex-1 space-y-3">
        {/* Type d'évaluation + période */}
        <div>
          <p className="text-sm font-semibold text-navy-900">
            {group.evaluationTypeCode ? `[${group.evaluationTypeCode}] ` : ''}
            {group.evaluationTypeName}
          </p>
          {group.periodName && (
            <p className="text-xs text-gray-500 mt-0.5">{group.periodName}</p>
          )}
        </div>

        {/* Période : Du X au Y (pas d'heure) */}
        <div className="flex items-center space-x-1.5 text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
          <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="font-medium">{dateRange}</span>
        </div>

        {/* Liste des matières à composer */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Matières à composer
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

        {/* Barème / coefficient — masqués pour Maternelle */}
        {!isMaternelle && (
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
              /{group.firstEvaluation.maxScore}
            </span>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
              coef {group.firstEvaluation.coefficient}
            </span>
          </div>
        )}
      </div>

      {/* Pied : actions alignées (icônes uniquement, sans libellés) */}
      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-end space-x-1 bg-gray-50/30">
        {actions.length === 0 ? (
          <span className="text-xs text-gray-400 italic px-2">Aucune action</span>
        ) : (
          actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`p-2 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  action.color || 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={action.label}
                aria-label={action.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Page Principale ────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  // ⭐ Labels UI selon la piste linguistique (FR/EN)
  const isEN = scopeLang === 'EN';
  const labels = getLabels(scopeLang);
  // ⭐ Modal de confirmation personnalisé (remplace window.confirm / window.prompt)
  const { confirm, danger, warning, info, dialog: confirmDialog } = useConfirmDialog();

  // ⭐ RÉSOLUTION DU NIVEAU SCOLAIRE STRICT :
  // Le module examen utilise ?level=PRIMAIRE dans l'URL (pas le header global).
  // On retrouve l'ID du niveau scolaire à partir du code (scopeLevel).
  // IMPORTANT : on utilise schoolLevelId (UUID de school_levels) car les
  // classes, subjects et evaluation_types référencent school_levels.id,
  // PAS education_levels.id.
  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
  }, [availableLevels, scopeLevel]);

  // ⭐ schoolLevelId = UUID de school_levels (pour filtrer classes/subjects/types)
  // activeLevel.id = UUID de education_levels (pour le header global seulement)
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isPrimaire = scopeLevel === 'PRIMAIRE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal state — Évaluation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // ⭐ IDs de toutes les évaluations du groupe en cours d'édition
  // (pour suppression + recréation lors de la sauvegarde)
  const [editingGroupIds, setEditingGroupIds] = useState<string[]>([]);
  const [form, setForm] = useState<EvaluationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modal state — Type d'évaluation (CRUD)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<EvaluationTypeForm>(EMPTY_TYPE_FORM);
  const [savingType, setSavingType] = useState(false);

  // Référence data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [evaluationTypes, setEvaluationTypes] = useState<EvaluationTypeItem[]>([]);

  // ─── Chargement initial : évaluations + données de référence ──────────────
  const loadData = useCallback(async () => {
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

      // ⭐ Récupérer les types d'évaluation depuis school_academic_settings
      // (où l'utilisateur les a créés dans l'onglet Paramètres).
      // Le paramétrage actif contient config.assessmentTypes avec code/label.
      const activeSettings = await academicSettingsService.getActive(academicYear.id, {
        levelCode: scopeLevel || undefined,
        language: scopeLang || undefined,
      }).catch(() => null);

      // Convertir assessmentTypes → format EvaluationTypeItem
      const assessmentTypes = activeSettings?.config?.assessmentTypes || [];
      // ⭐ V10g — Piste EN : barème par CODE (First CA /20, Second CA /20,
      // Examination /60 — CA1 + CA2 + Exam = /100 par matière au récapitulatif
      // trimestriel), indépendamment du scoreMax global de la config.
      // Les types settings utilisent les codes FIRST_CA / SECOND_CA / EXAM.
      const enMaxByCode = (code: string): number => {
        const c = (code || '').toUpperCase();
        if (c === 'EXAM' || c === 'EXAMINATION') return 60;
        if (c === 'FIRST_CA' || c === 'SECOND_CA' || c === 'FCA' || c === 'SCA') return 20;
        return 20;
      };
      let typesFromSettings = assessmentTypes.map((at: any) => ({
        id: at.code, // Utiliser le code comme ID (pas d'UUID dans school_academic_settings)
        name: at.label || at.code,
        code: at.code,
        defaultMaxScore: isEN ? enMaxByCode(at.code) : (activeSettings?.config?.scoreMax || 20),
        defaultCoefficient: at.includedInAverage ? 1 : 0,
        schoolLevelId: schoolLevelUuid,
        isSystem: false,
      }));

      // ⭐ Si piste anglophone (EN) et qu'aucun type n'est configuré dans les settings,
      //    utiliser les types anglophones par défaut (First CA, Second CA, Examination)
      if (isEN && typesFromSettings.length === 0) {
        typesFromSettings = EN_EVALUATION_TYPES.map(t => ({
          id: t.code,
          name: t.name,
          code: t.code,
          defaultMaxScore: t.maxScore,
          defaultCoefficient: 1,
          schoolLevelId: schoolLevelUuid || '',
          isSystem: true,
        }));
      }

      const [evals, allClassesData, periodsData, subjectsData] = await Promise.all([
        institutionalExamsService.getEvaluations(params),
        fetch('/api/all-classes', { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
        getAcademicYearPeriods(academicYear.id).catch(() => []),
        // ⭐ V10c — On ne récupère QUE les matières du niveau + de la piste
        // linguistique (language=EN → uniquement anglophones côté backend).
        pedagogyService.getSubjects(academicYear.id, {
          schoolLevelId: schoolLevelUuid,
          language: scopeLang,
        }).catch(() => []),
      ]);
      setEvaluations(Array.isArray(evals) ? evals : []);

      // ⭐ V10b — Isolation stricte par niveau + piste linguistique :
      // les sections EN partagent le schoolLevelId de leur miroir FR → on
      // filtre par le marqueur linguistique (non marqué = FR historique).
      // Plus AUCUN repli « tout afficher » : chaque vue ne voit que SES classes.
      const allClasses = Array.isArray(allClassesData) ? allClassesData : [];
      const levelClasses = filterClassesForLevel(allClasses, schoolLevelUuid, scopeLang);
      // Trier par ordre pédagogique (Maternelle → Primaire → Secondaire)
      const sortedClasses = [...levelClasses].sort((a, b) => {
        const idxA = getClassOrderIndex(a.name || a.code || '');
        const idxB = getClassOrderIndex(b.name || b.code || '');
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '');
      });
      setClasses(sortedClasses);

      setPeriods(Array.isArray(periodsData) ? periodsData : []);

      // ⭐ V10b — Isolation stricte des matières (même règle que les classes) :
      // niveau schoolLevelId + marqueur linguistique (non marqué = FR).
      const allSubjects = Array.isArray(subjectsData) ? subjectsData : (subjectsData?.data ?? []);
      const levelSubjects = allSubjects.filter((s: any) =>
        s.schoolLevelId === schoolLevelUuid
      );
      const filteredSubjects = scopeLang
        ? levelSubjects.filter((s: any) => matchesLevelLanguage(s, scopeLang))
        : levelSubjects;
      // Trier par niveau scolaire (Maternelle → Primaire → Secondaire)
      const sortedSubjects = [...filteredSubjects].sort((a, b) => {
        const idxA = getLevelOrderIndex(a.schoolLevelId, availableLevels);
        const idxB = getLevelOrderIndex(b.schoolLevelId, availableLevels);
        if (idxA !== idxB) return idxA - idxB;
        return (a.name || '').localeCompare(b.name || '');
      });
      setSubjects(sortedSubjects);
      setEvaluationTypes(typesFromSettings);
    } catch (error) {
      console.error('Error loading evaluations', error);
      toastError('Erreur lors du chargement des évaluations');
    } finally {
      setLoading(false);
    }
  }, [schoolLevelUuid, academicYear?.id, scopeLang, scopeLevel]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtrage des évaluations (search + status) ──────────────────────────
  const filteredEvaluations = useMemo(() => {
    let result = evaluations;
    if (statusFilter !== 'ALL') {
      result = result.filter(e => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e =>
        (e.title?.toLowerCase().includes(q)) ||
        (e.class?.name?.toLowerCase().includes(q)) ||
        (e.subject?.name?.toLowerCase().includes(q)) ||
        (e.evaluationType?.name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [evaluations, statusFilter, searchQuery]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    // ⭐ Pré-remplir la période courante (trimestre actif)
    const currentPeriod = periods.find(p => p.isActive && !p.isClosed) || periods[0];
    setForm({
      ...EMPTY_FORM,
      periodId: currentPeriod?.id || '',
      // Maternelle : pas de barème numérique (qualitatif TS/S/PS)
      maxScore: isMaternelle ? '0' : '20',
      coefficient: isMaternelle ? '0' : '1',
      // ⭐ V10d — TOUTES les matières sélectionnées PAR DÉFAUT :
      // « lorsqu'on programme une évaluation pour une classe, c'est toutes
      // les matières qui sont évaluées — sauf exclusion explicite ».
      // L'utilisateur décoche simplement les matières à exclure.
      subjectIds: subjects.map((s) => s.id),
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: GroupedEvaluation) => {
    // Pré-remplir le formulaire avec les données du GROUP (toutes les matières)
    const first = group.firstEvaluation;
    // ⭐ Le frontend utilise le CODE (EM1) comme ID pour evaluationTypes
    // (chargé depuis school_academic_settings.config.assessmentTypes).
    // Mais le backend retourne l'UUID dans first.evaluationType.id.
    // Pour que le <Select> affiche le bon type, on doit utiliser le code.
    const evaluationTypeCode = first.evaluationType?.code || '';
    setForm({
      title: first.title || '',
      description: first.description || '',
      classIds: first.class?.id ? [first.class.id] : [],
      subjectIds: group.subjects.map((s) => s.id), // ⭐ Toutes les matières du groupe
      periodId: first.period?.id || '',
      evaluationTypeId: evaluationTypeCode, // ⭐ Utiliser le CODE, pas l'UUID
      evaluationDate: first.evaluationDate ? new Date(first.evaluationDate).toISOString().slice(0, 10) : '',
      startDate: (first as any).startDate ? new Date((first as any).startDate).toISOString().slice(0, 10) : '',
      endDate: (first as any).endDate ? new Date((first as any).endDate).toISOString().slice(0, 10) : '',
      maxScore: String(first.maxScore || (isMaternelle ? 0 : 20)),
      coefficient: String(first.coefficient || (isMaternelle ? 0 : 1)),
    });
    setEditingId(first.id);
    setEditingGroupIds(group.evaluationIds); // ⭐ Tous les IDs du groupe
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingGroupIds([]);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    // Validation
    if (form.classIds.length === 0 || form.subjectIds.length === 0 || !form.periodId || !form.evaluationTypeId || !form.startDate || !form.endDate) {
      toastError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const basePayload: any = {
        title: form.title || null,
        description: form.description || null,
        periodId: form.periodId,
        evaluationTypeId: form.evaluationTypeId,
        evaluationDate: new Date(form.startDate).toISOString(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      // ⭐ Maternelle = qualitatif (TS/S/PS) — pas de barème numérique ni coefficient
      if (!isMaternelle) {
        basePayload.maxScore = parseFloat(form.maxScore) || 20;
        basePayload.coefficient = parseFloat(form.coefficient) || 1;
      } else {
        basePayload.maxScore = 0;
        basePayload.coefficient = 0;
      }

      if (editingId) {
        // ⭐ Édition d'un GROUPE d'évaluations (1 classe × N matières).
        // On supprime toutes les évaluations du groupe puis on recrée via bulk.
        // Plus simple que de gérer un diff ajout/suppression par matière.
        // editingGroupIds est setté dans handleOpenEdit.
        if (editingGroupIds.length > 0) {
          // 1. Supprimer toutes les évaluations du groupe
          await Promise.all(
            editingGroupIds.map((id) =>
              institutionalExamsService.deleteEvaluation(id).catch((e) =>
                console.warn(`Failed to delete eval ${id}:`, e),
              ),
            ),
          );
        }
        // 2. Recréer via bulk create avec les nouvelles données
        const bulkPayload = {
          ...basePayload,
          classIds: form.classIds,
          subjectIds: form.subjectIds,
        };
        const result = await institutionalExamsService.createBulkEvaluations(bulkPayload);
        toastSuccess(`${result.created} évaluation(s) modifiée(s)`, {
          description: `${form.classIds.length} classe(s) × ${form.subjectIds.length} matière(s)`,
        });
      } else {
        // Création : utiliser bulk create pour générer 1 évaluation par combinaison
        const bulkPayload = {
          ...basePayload,
          classIds: form.classIds,
          subjectIds: form.subjectIds,
        };
        const result = await institutionalExamsService.createBulkEvaluations(bulkPayload);
        // ⭐ Toast détaillé : "X matières programmées pour Y classes(s) — Z enseignant(s) notifié(s)"
        const classNames = form.classIds
          .map((cid) => classes.find((c) => c.id === cid)?.name)
          .filter(Boolean);
        const subjectNames = form.subjectIds
          .map((sid) => subjects.find((s) => s.id === sid)?.name)
          .filter(Boolean);
        const teachersNotified = (result as any)?.teachersAssigned || 0;

        toastSuccess(
          `${result.created} évaluation(s) programmée(s)`,
          {
            description:
              `${classNames.length} classe${classNames.length > 1 ? 's' : ''} (${classNames.join(', ')}) • ` +
              `${subjectNames.length} matière${subjectNames.length > 1 ? 's' : ''} (${subjectNames.join(', ')})` +
              (teachersNotified > 0 ? ` • ${teachersNotified} enseignant${teachersNotified > 1 ? 's' : ''} notifié${teachersNotified > 1 ? 's' : ''}` : ''),
            duration: 6000,
          },
        );
      }
      handleCloseModal();
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: GroupedEvaluation) => {
    // ⭐ Demander à l'utilisateur : toutes les matières ou une seule ?
    const subjectCount = group.subjects.length;
    const subjectNames = group.subjects.map((s) => s.name).join(', ');

    if (subjectCount <= 1) {
      // Une seule matière : confirmation simple
      const ok = await danger(
        `Supprimer l'évaluation "${group.firstEvaluation.title || 'sans titre'}" pour ${group.className} ?`,
        'Supprimer l\'évaluation',
        'Cette action est irréversible.'
      );
      if (!ok) return;
      try {
        await Promise.all(
          group.evaluationIds.map((id) =>
            institutionalExamsService.deleteEvaluation(id).catch((e) =>
              console.warn(`Failed to delete eval ${id}:`, e),
            ),
          ),
        );
        toastSuccess('Évaluation supprimée');
        await loadData();
      } catch (err: any) {
        toastError('Erreur lors de la suppression', { description: err.message });
      }
      return;
    }

    // Plusieurs matières : demander le scope de suppression
    const ok = await danger(
      `Supprimer ${subjectCount} évaluation(s) pour la classe ${group.className} ?\n\n` +
      `Matières : ${subjectNames}`,
      'Suppression multiple',
      'Cliquez sur "Supprimer" pour supprimer TOUTES les matières de cette session. Cette action est irréversible.'
    );

    if (!ok) return;

    try {
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.deleteEvaluation(id).catch((e) =>
            console.warn(`Failed to delete eval ${id}:`, e),
          ),
        ),
      );
      toastSuccess(`${subjectCount} évaluation(s) supprimée(s) pour ${group.className}`, {
        description: `Matières : ${subjectNames}`,
      });
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la suppression', { description: err.message });
    }
  };

  const handleOpen = async (group: GroupedEvaluation) => {
    const ok = await warning(
      `Ouvrir ${group.evaluationIds.length} évaluation(s) pour la saisie (${group.className} - ${group.subjects.length} matière(s)) ?`,
      'Ouvrir pour saisie',
      'Les enseignants pourront commencer à saisir les notes.'
    );
    if (!ok) return;
    try {
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.openEvaluation(id).catch((e) =>
            console.warn(`Failed to open eval ${id}:`, e),
          ),
        ),
      );
      toastSuccess(`${group.evaluationIds.length} évaluation(s) ouverte(s) pour la saisie`);
      await loadData();
    } catch (err: any) {
      toastError('Erreur', { description: err.message });
    }
  };

  const handleSubmit = async (group: GroupedEvaluation) => {
    const ok = await warning(
      `Soumettre ${group.evaluationIds.length} évaluation(s) pour validation (${group.className}) ?`,
      'Soumettre pour validation',
      'Les évaluations seront soumises à la direction pour validation.'
    );
    if (!ok) return;
    try {
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.submitEvaluation(id).catch((e) =>
            console.warn(`Failed to submit eval ${id}:`, e),
          ),
        ),
      );
      toastSuccess(`${group.evaluationIds.length} évaluation(s) soumise(s)`);
      await loadData();
    } catch (err: any) {
      toastError('Erreur', { description: err.message });
    }
  };

  const handleValidate = async (group: GroupedEvaluation) => {
    const ok = await warning(
      `Valider définitivement ${group.evaluationIds.length} évaluation(s) (${group.className}) ?\n\nLes notes seront verrouillées.`,
      'Valider définitivement',
      'Cette action est irréversible. Les notes seront définitivement verrouillées.'
    );
    if (!ok) return;
    try {
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.validateEvaluation(id).catch((e) =>
            console.warn(`Failed to validate eval ${id}:`, e),
          ),
        ),
      );
      toastSuccess(`${group.evaluationIds.length} évaluation(s) validée(s)`);
      await loadData();
    } catch (err: any) {
      toastError('Erreur', { description: err.message });
    }
  };

  const handleCancel = async (group: GroupedEvaluation) => {
    const ok = await warning(
      `Annuler ${group.subjects.length} matière(s) pour ${group.className} ?`,
      'Annuler les évaluations',
      'Les évaluations seront marquées comme annulées (mais non supprimées).'
    );
    if (!ok) return;
    try {
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.cancelEvaluation(id, 'Annulation batch').catch((e) =>
            console.warn(`Failed to cancel eval ${id}:`, e),
          ),
        ),
      );
      toastSuccess(`${group.evaluationIds.length} évaluation(s) annulée(s) pour ${group.className}`);
      await loadData();
    } catch (err: any) {
      toastError('Erreur', { description: err.message });
    }
  };

  // ─── Handlers : CRUD des types d'évaluation ──────────────────────────────
  const handleOpenTypeModal = () => {
    // ⭐ Pré-remplir avec le niveau scolaire ACTUEL du module examen.
    // Le niveau scolaire est déjà choisi par l'utilisateur (URL ?level=PRIMAIRE),
    // le modal NE DOIT PAS demander de le re-sélectionner.
    // Utiliser schoolLevelUuid (UUID de school_levels) car les evaluation_types
    // référencent school_levels.id.
    setTypeForm({
      ...EMPTY_TYPE_FORM,
      schoolLevelId: schoolLevelUuid || '',
    });
    setEditingTypeId(null);
    setIsTypeModalOpen(true);
  };

  const handleEditType = (type: EvaluationTypeItem) => {
    setTypeForm({
      name: type.name,
      code: type.code || '',
      schoolLevelId: type.schoolLevelId || '',
      defaultMaxScore: String(type.defaultMaxScore),
      defaultCoefficient: String(type.defaultCoefficient),
    });
    setEditingTypeId(type.id);
    setIsTypeModalOpen(true);
  };

  const handleCloseTypeModal = () => {
    setIsTypeModalOpen(false);
    setEditingTypeId(null);
    setTypeForm(EMPTY_TYPE_FORM);
  };

  const handleSaveType = async () => {
    if (!typeForm.name || !typeForm.schoolLevelId) {
      toastError('Le nom est obligatoire');
      return;
    }
    setSavingType(true);
    try {
      const payload: any = {
        name: typeForm.name,
        code: typeForm.code || null,
        schoolLevelId: typeForm.schoolLevelId,
      };
      // ⭐ Maternelle = qualitatif (TS/S/PS) — pas de barème ni coefficient
      if (isMaternelle) {
        payload.defaultMaxScore = 0;
        payload.defaultCoefficient = 0;
      } else {
        payload.defaultMaxScore = parseFloat(typeForm.defaultMaxScore) || 20;
        payload.defaultCoefficient = parseFloat(typeForm.defaultCoefficient) || 1;
      }
      if (editingTypeId) {
        await institutionalExamsService.updateEvaluationType(editingTypeId, payload);
        toastSuccess('Type modifié');
      } else {
        await institutionalExamsService.createEvaluationType(payload);
        toastSuccess('Type créé');
      }
      handleCloseTypeModal();
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la sauvegarde du type', { description: err.message });
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (type: EvaluationTypeItem) => {
    if (type.isSystem) {
      toastError('Les types système ne peuvent pas être supprimés');
      return;
    }
    const ok = await danger(
      `Supprimer le type "${type.name}" ?`,
      'Supprimer le type d\'évaluation',
      'Cette action est irréversible. Les évaluations existantes de ce type ne seront pas supprimées.'
    );
    if (!ok) return;
    try {
      await institutionalExamsService.deleteEvaluationType(type.id);
      toastSuccess('Type supprimé');
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la suppression du type', { description: err.message });
    }
  };

  // ─── Available actions based on status ───────────────────────────────────
  const getAvailableActions = (group: GroupedEvaluation) => {
    const actions: Array<{ label: string; icon: any; onClick: () => void; color?: string; disabled?: boolean }> = [];
    const status = group.firstEvaluation.status;

    if (status === 'PLANNED' || status === 'DRAFT') {
      actions.push({ label: 'Ouvrir pour saisie', icon: Play, onClick: () => handleOpen(group), color: 'text-amber-600 hover:bg-amber-50' });
    }
    if (status === 'OPEN_FOR_GRADING') {
      actions.push({ label: 'Soumettre pour validation', icon: Send, onClick: () => handleSubmit(group), color: 'text-purple-600 hover:bg-purple-50' });
    }
    if (status === 'SUBMITTED') {
      actions.push({ label: 'Valider', icon: CheckCircle, onClick: () => handleValidate(group), color: 'text-emerald-600 hover:bg-emerald-50' });
    }

    // Edit est possible tant que non validée/verrouillée/annulée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: 'Modifier', icon: Pencil, onClick: () => handleOpenEdit(group), color: 'text-blue-600 hover:bg-blue-50' });
    }

    // Annuler — possible tant que non validée/verrouillée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: 'Annuler', icon: XCircle, onClick: () => handleCancel(group), color: 'text-orange-600 hover:bg-orange-50' });
    }

    // Supprimer — possible seulement si pas validée/verrouillée
    if (!['VALIDATED', 'LOCKED'].includes(status)) {
      actions.push({ label: 'Supprimer', icon: Trash2, onClick: () => handleDelete(group), color: 'text-red-600 hover:bg-red-50' });
    }

    return actions;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <ModuleContainer
      header={{
        title: isEN ? labels.evaluations : 'Évaluations',
        description: isEN
          ? 'Create and manage assessments: assignments, quizzes, compositions, mock exams, practical tests, orals.'
          : 'Créer et gérer les évaluations : devoirs, interrogations, compositions, examens blancs, épreuves pratiques, oraux.',
        icon: 'fileText',
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'evaluations',
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Barre de recherche + filtres */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre, classe, matière..."
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                    <SelectItem value="DRAFT">Brouillon</SelectItem>
                    <SelectItem value="PLANNED">Planifiée</SelectItem>
                    <SelectItem value="OPEN_FOR_GRADING">Validée par enseignant</SelectItem>
                    <SelectItem value="SUBMITTED">Soumise au directeur</SelectItem>
                    <SelectItem value="VALIDATED">Validée</SelectItem>
                    <SelectItem value="LOCKED">Verrouillée</SelectItem>
                    <SelectItem value="CANCELLED">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nouvelle évaluation</span>
                </button>
              </div>
            </div>

            {/* ⭐ Vue en cartes groupées par classe (programmation des évaluations) */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">Chargement des évaluations…</span>
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">Aucune évaluation programmée</p>
                <p className="text-sm text-gray-400">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'Aucune évaluation ne correspond aux filtres.'
                    : 'Cliquez sur "Nouvelle évaluation" pour planifier la première.'}
                </p>
              </div>
            ) : (
              <EvaluationCardsByClass
                evaluations={filteredEvaluations}
                getAvailableActions={getAvailableActions}
                onOpenEdit={handleOpenEdit}
                isMaternelle={isMaternelle}
              />
            )}
          </div>
        )
      }}
    />

    {/* ─── Modal Création / Édition ────────────────────────────────────────── */}
    <FormModal
      title={editingId ? (isEN ? 'Edit Assessment' : 'Modifier l\'évaluation') : (isEN ? 'Create Assessment' : 'Créer une évaluation')}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      size="lg"
      actions={
        <>
          <button
            onClick={handleCloseModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || form.classIds.length === 0 || form.subjectIds.length === 0 || !form.periodId || !form.evaluationTypeId || !form.startDate || !form.endDate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (isEN ? 'Saving...' : 'Enregistrement...') : editingId ? (isEN ? 'Update' : 'Modifier') : (isEN ? 'Create' : 'Créer')}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/* ⭐ Type d'évaluation EN PREMIER (avant titre) */}
        <div>
          <Label htmlFor="evaluationTypeId">{labels.evaluationType} <span className="text-red-500">*</span></Label>
          <Select value={form.evaluationTypeId} onValueChange={(v) => {
            const selectedType = evaluationTypes.find(t => t.id === v);
            // ⭐ Auto-génération intelligente du titre
            const periodName = periods.find(p => p.id === form.periodId)?.name || '';
            const translatedPeriod = translatePeriodName(periodName, scopeLang);
            const autoTitle = selectedType
              ? isEN
                ? `${selectedType.name} - ${translatedPeriod}`
                : `${selectedType.name} - ${periodName}`
              : '';
            setForm({
              ...form,
              evaluationTypeId: v,
              title: editingId ? form.title : autoTitle, // Ne pas écraser si édition
              maxScore: selectedType ? String(selectedType.defaultMaxScore) : form.maxScore,
              coefficient: selectedType ? String(selectedType.defaultCoefficient) : form.coefficient,
            });
          }}>
            <SelectTrigger id="evaluationTypeId">
              <SelectValue placeholder={labels.selectPlaceholder}>
                {(() => {
                  // ⭐ Afficher le libellé du type sélectionné manuellement
                  // car SelectValue ne peut pas le résoudre tant que SelectContent
                  // n'est pas monté (labelMap vide au premier rendu).
                  const selectedType = evaluationTypes.find((t) => t.id === form.evaluationTypeId);
                  if (selectedType) {
                    return selectedType.code
                      ? `[${selectedType.code}] ${selectedType.name}`
                      : selectedType.name;
                  }
                  return null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {evaluationTypes.length === 0 ? (
                <SelectItem value="_none" disabled>{labels.noTypes}</SelectItem>
              ) : (
                evaluationTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.code ? `[${t.code}] ` : ''}{t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Titre (auto-généré, modifiable) */}
        <div>
          <Label htmlFor="title">{labels.title} <span className="text-gray-400 font-normal">({isEN ? 'auto-generated, editable' : 'auto-généré, modifiable'})</span></Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={isEN ? "Ex: First CA - First Term" : "Ex: Évaluation mensuelle - Trimestre 1"}
          />
        </div>

        {/* Classes (sélection multiple) + Matières (sélection multiple checkboxes) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Classes — checkboxes multiples */}
          <div>
            <Label>
              {labels.classes} <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">
                ({form.classIds.length} {isEN ? (form.classIds.length > 1 ? 'selected' : 'selected') : (form.classIds.length > 1 ? 'sélectionnées' : 'sélectionnée')})
              </span>
            </Label>
            <div className="mt-1 max-h-[160px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
              {classes.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">
                  {labels.noClasses}
                </p>
              ) : (
                classes.map(c => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-white cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={form.classIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, classIds: [...form.classIds, c.id] });
                        } else {
                          setForm({ ...form, classIds: form.classIds.filter(id => id !== c.id) });
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              {classes.length > 0 && form.classIds.length < classes.length && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, classIds: classes.map(c => c.id) })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  {labels.selectAll}
                </button>
              )}
              {form.classIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, classIds: [] })}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  {labels.deselectAll}
                </button>
              )}
            </div>
          </div>

          {/* Matières — checkboxes multiples */}
          <div>
            <Label>
              {labels.subjects} <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">
                ({form.subjectIds.length} {isEN ? (form.subjectIds.length > 1 ? 'selected' : 'selected') : (form.subjectIds.length > 1 ? 'sélectionnées' : 'sélectionnée')})
              </span>
            </Label>
            {/* ⭐ V10d — toutes les matières sont sélectionnées par défaut :
                l'utilisateur décoche uniquement les matières à exclure. */}
            <p className="text-[10px] text-gray-500 mb-1">
              {isEN
                ? 'All subjects are selected by default — uncheck to exclude.'
                : 'Toutes les matières sont sélectionnées par défaut — décochez celles à exclure.'}
            </p>
            <div className="mt-1 max-h-[160px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">
                  {labels.noSubjects}
                </p>
              ) : (
                subjects.map(s => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-white cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={form.subjectIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, subjectIds: [...form.subjectIds, s.id] });
                        } else {
                          setForm({ ...form, subjectIds: form.subjectIds.filter(id => id !== s.id) });
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              {subjects.length > 0 && form.subjectIds.length < subjects.length && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, subjectIds: subjects.map(s => s.id) })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  {labels.selectAll}
                </button>
              )}
              {form.subjectIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, subjectIds: [] })}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  {labels.deselectAll}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info : combinaisons qui seront créées */}
        {!editingId && form.classIds.length > 0 && form.subjectIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-800">
              📋 <strong>{form.classIds.length * form.subjectIds.length} {labels.evaluationsCreated}</strong>
              ({form.classIds.length} {isEN ? (form.classIds.length > 1 ? 'classes' : 'class') : (form.classIds.length > 1 ? 'classes' : 'classe')} × {form.subjectIds.length} {isEN ? (form.subjectIds.length > 1 ? 'subjects' : 'subject') : (form.subjectIds.length > 1 ? 'matières' : 'matière')}).
              {labels.classSubjectInfo}
            </p>
          </div>
        )}

        {/* Période (trimestre) — auto-sélectionné si période active */}
        <div>
          <Label htmlFor="periodId">{labels.period} <span className="text-red-500">*</span></Label>
          <Select value={form.periodId} onValueChange={(v) => setForm({ ...form, periodId: v })}>
            <SelectTrigger id="periodId">
              <SelectValue placeholder={labels.selectPlaceholder}>
                {(() => {
                  // ⭐ Afficher le libellé de la période sélectionnée manuellement
                  const selectedPeriod = periods.find((p) => p.id === form.periodId);
                  if (selectedPeriod) {
                    const displayName = translatePeriodName(selectedPeriod.name, scopeLang);
                    return selectedPeriod.isClosed
                      ? `${displayName} (${labels.closed})`
                      : selectedPeriod.isActive
                        ? `${displayName} (${labels.active})`
                        : displayName;
                  }
                  return null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.length === 0 ? (
                <SelectItem value="_none" disabled>{labels.noPeriods}</SelectItem>
              ) : (
                periods.map(p => {
                  const displayName = translatePeriodName(p.name, scopeLang);
                  return (
                    <SelectItem key={p.id} value={p.id} disabled={p.isClosed}>
                      {displayName} {p.isClosed && `(${labels.closed})`} {p.isActive && !p.isClosed && `(${labels.active})`}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>

        {/* ⭐ Intervalle de dates obligatoire — date de début + date de fin */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">{labels.startDate} <span className="text-red-500">*</span></Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">{labels.endDate} <span className="text-red-500">*</span></Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Barème + Coefficient — masqués pour la maternelle (qualitatif TS/S/PS) */}
        {/* ⭐ V10b — Ce bloc ne s'affiche QUE pour la Maternelle FR (qualitative).
            Nursery (EN) est quantitatif comme Primary : il passe par la branche
            isEN ci-dessous (barème /40 CA ou /60 Exam, sans coefficient).
            Un ancien libellé « Qualitative Assessment (Nursery) » (code mort —
            isEN ne peut jamais être vrai ici) a été supprimé. */}
        {isMaternelle ? (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-pink-900 mb-1">
              🎨 Évaluation qualitative (Maternelle)
            </p>
            <p className="text-xs text-pink-800">
              Les évaluations de maternelle utilisent un système qualitatif TS (Très Satisfaisant) / S (Satisfaisant) / PS (Peu Satisfaisant). Pas de note maximale ni de coefficient — la saisie se fait au niveau de l&apos;onglet « Saisie des notes » via des boutons TS/S/PS.
            </p>
          </div>
        ) : isEN ? (
          // ⭐ Piste anglophone : barème seulement (pas de coefficient)
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="maxScore">{labels.maxScore}</Label>
              <Input
                id="maxScore"
                type="number"
                step="0.5"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.evaluationTypeId === 'FCA' || form.evaluationTypeId === 'SCA'
                  ? 'First CA / Second CA: out of 40'
                  : form.evaluationTypeId === 'EXAM'
                    ? 'Examination: out of 60'
                    : 'Default: 40 (CA) or 60 (Exam)'}
              </p>
            </div>
          </div>
        ) : (
          // ⭐ Piste francophone : barème + coefficient (comme avant)
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxScore">{labels.maxScore}</Label>
              <Input
                id="maxScore"
                type="number"
                step="0.5"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="coefficient">{labels.coefficient}</Label>
              <Input
                id="coefficient"
                type="number"
                step="0.5"
                value={form.coefficient}
                onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <Label htmlFor="description">{labels.description}</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Chapitres abordés, consignes particulières..."
            rows={3}
          />
        </div>
      </div>
    </FormModal>

    {/* ─── Modal Gestion des Types d'Évaluation (CRUD) ──────────────────────── */}
    <FormModal
      title={editingTypeId ? 'Modifier le type d\'évaluation' : 'Gérer les types d\'évaluation'}
      isOpen={isTypeModalOpen}
      onClose={handleCloseTypeModal}
      size="lg"
      actions={
        <>
          <button
            onClick={handleCloseTypeModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            onClick={handleSaveType}
            disabled={savingType || !typeForm.name || !typeForm.schoolLevelId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingType ? 'Enregistrement...' : editingTypeId ? 'Modifier' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/* Liste des types existants */}
        {!editingTypeId && (
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              Types existants {evaluationTypes.length > 0 && `(${evaluationTypes.length})`}
            </Label>
            <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
              {evaluationTypes.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">
                  Aucun type d'évaluation pour ce niveau scolaire.
                  Créez-en un ci-dessous.
                </p>
              ) : (
                evaluationTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-white rounded-md p-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      {t.code && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-xs">
                          {t.code}
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      <span className="text-xs text-gray-500">
                        /{t.defaultMaxScore} · coef {t.defaultCoefficient}
                      </span>
                      {t.isSystem && (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600 text-[10px]">Système</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditType(t)}
                        disabled={t.isSystem}
                        title={t.isSystem ? 'Type système non modifiable' : 'Modifier'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => handleDeleteType(t)}
                        disabled={t.isSystem}
                        title={t.isSystem ? 'Type système non supprimable' : 'Supprimer'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 font-medium">
                ➕ Créer un nouveau type :
              </p>
            </div>
          </div>
        )}

        {/* Formulaire de création/édition */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="typeName">Nom <span className="text-red-500">*</span></Label>
            <Input
              id="typeName"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              placeholder="Ex: Devoir surveillé"
            />
          </div>
          <div>
            <Label htmlFor="typeCode">Code <span className="text-gray-400 font-normal">(optionnel)</span></Label>
            <Input
              id="typeCode"
              value={typeForm.code}
              onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
              placeholder="Ex: DS"
              maxLength={10}
            />
          </div>
        </div>

        {/* ⭐ Niveau scolaire — DÉJÀ SÉLECTIONNÉ dans le module examen.
            Le modal ne demande PAS de le re-sélectionner, on l'affiche juste. */}
        <div>
          <Label>Niveau scolaire</Label>
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Badge className="bg-blue-600 text-white">
              {activeLevel?.label || scopeLevel || '—'}
            </Badge>
            <span className="text-xs text-blue-700">
              Le type sera créé pour ce niveau scolaire uniquement.
            </span>
          </div>
        </div>

        {/* Barème + Coefficient — masqués pour la maternelle (qualitatif TS/S/PS) */}
        {isMaternelle ? (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-pink-900 mb-1">
              🎨 Évaluation qualitative (Maternelle)
            </p>
            <p className="text-xs text-pink-800">
              Les évaluations de maternelle utilisent un système qualitatif
              <strong> TS (Très Satisfaisant) / S (Satisfaisant) / PS (Peu Satisfaisant)</strong>.
              Pas de barème numérique ni de coefficient.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="typeMaxScore">Barème par défaut</Label>
              <Input
                id="typeMaxScore"
                type="number"
                step="0.5"
                value={typeForm.defaultMaxScore}
                onChange={(e) => setTypeForm({ ...typeForm, defaultMaxScore: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="typeCoef">Coefficient par défaut</Label>
              <Input
                id="typeCoef"
                type="number"
                step="0.5"
                value={typeForm.defaultCoefficient}
                onChange={(e) => setTypeForm({ ...typeForm, defaultCoefficient: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Aide : exemples par niveau */}
        {!editingTypeId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-900 mb-1">Aide — Types d'évaluation par niveau :</p>
            <ul className="text-xs text-blue-800 space-y-0.5">
              <li>• <strong>Maternelle / Primaire</strong> : Évaluation mensuelle, Évaluation certificative, Évaluation formative, Évaluation sommative</li>
              <li>• <strong>Secondaire</strong> : Devoir, Interrogation, Interrogation écrite, Devoir surveillé, Épreuve pratique (TP)</li>
            </ul>
          </div>
        )}
      </div>
    </FormModal>
    {confirmDialog}
    </>
  );
}
