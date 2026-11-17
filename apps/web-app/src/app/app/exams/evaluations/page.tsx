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
  Play, CheckCircle, MoreVertical, Loader2, Settings, ListChecks, X,
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
import { cn } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { academicSettingsService } from '@/services/academic-settings.service';
import { classesService } from '@/services/classes.service';
import { pedagogyService } from '@/services/pedagogy.service';
import { getAcademicYearPeriods } from '@/services/settings.service';
import { cachedGet } from '@/lib/api/get-cache';
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
import { translateClassName } from '@/lib/pedagogy/class-name-en';

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

interface ClassItem {
  id: string;
  name: string;
  /**
   * ⭐ FIX 2026-11-17 : classe officielle (Pédagogie > Academic Structure)
   * rattachée à cette classe opérationnelle. C'est par elle qu'on retrouve
   * les matières affectées à la classe (class_subjects.academicClassId) et
   * leurs coefficients configurés dans Pédagogie > Matières & Programmes.
   */
  officialClassId?: string | null;
  /**
   * ⭐ RÉORGANISATION 2026-11-17 (vue par classe) : effectif actif de la
   * classe (élèves inscrits — statuts actifs, même définition que la grille
   * de saisie des notes). Attaché par le backend /classes (findAll).
   */
  studentCount?: number;
}
interface SubjectItem { id: string; name: string; coefficient?: number; }
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
  subjectIds: string[];      // ⭐ Édition d'un groupe existant (re-création)
  periodId: string;
  evaluationTypeId: string;
  /**
   * ⭐ RÉORGANISATION 2026-11-17 (modal simplifié) : création = on choisit
   * la/les classe(s) + le trimestre + le(s) type(s) — les matières de chaque
   * classe sont associées automatiquement (Pédagogie > Matières & Programmes).
   * Multi-types cochables d'un coup (IE1 + IE2 + DS1 + DS2…).
   */
  evaluationTypeIds: string[];
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
  evaluationTypeIds: [],
  evaluationDate: new Date().toISOString().slice(0, 10),
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  maxScore: '20',
  coefficient: '1',
};

/**
 * ⭐ MODIFICATION MULTIPLE : chaque champ est précédé d'une case « Appliquer » —
 * seuls les champs cochés sont appliqués à toutes les évaluations sélectionnées.
 */
interface BulkEditForm {
  applyType: boolean;
  evaluationTypeId: string;
  applyPeriod: boolean;
  periodId: string;
  applyDates: boolean;
  startDate: string;
  endDate: string;
  applyMaxScore: boolean;
  maxScore: string;
  applyCoefficient: boolean;
  coefficient: string;
  applyTitle: boolean;
  title: string;
}

const EMPTY_BULK_FORM: BulkEditForm = {
  applyType: false,
  evaluationTypeId: '',
  applyPeriod: false,
  periodId: '',
  applyDates: false,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  applyMaxScore: false,
  maxScore: '20',
  applyCoefficient: false,
  coefficient: '1',
  applyTitle: false,
  title: '',
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

const STATUS_CONFIG_FR: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  PLANNED: { label: 'Planifiée', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  OPEN_FOR_GRADING: { label: 'Validée par enseignant', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Soumise au directeur', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  VALIDATED: { label: 'Validée', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LOCKED: { label: 'Verrouillée', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-700 border-red-200 line-through' },
};

const STATUS_CONFIG_EN: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  PLANNED: { label: 'Planned', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  OPEN_FOR_GRADING: { label: 'Validated by teacher', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Submitted to Director', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  VALIDATED: { label: 'Validated', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LOCKED: { label: 'Locked', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200 line-through' },
};

function StatusBadge({ status, isEN }: { status: string; isEN?: boolean }) {
  const config = isEN ? STATUS_CONFIG_EN : STATUS_CONFIG_FR;
  const cfg = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
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
  // Clé de regroupement — identifiant stable utilisé par la sélection multiple
  key: string;
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

/**
 * ⭐ Regroupement des évaluations par
 * (classId × evaluationTypeId × periodId × startDate × endDate).
 * Remonté au niveau de la page pour piloter la SÉLECTION MULTIPLE
 * (les cartes groupées partagent la même clé que le groupe).
 */
function buildEvaluationGroups(evaluations: Evaluation[], isEN?: boolean): GroupedEvaluation[] {
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
        key,
        classId,
        // ⭐ 2026-10-01 — Traduire le nom de la classe pour la piste EN
        // (Nursery 1 au lieu de Maternelle 1, Primary 1 au lieu de CI, etc.)
        className: isEN ? translateClassName(ev.class?.name || 'Sans classe') : (ev.class?.name || 'Sans classe'),
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
}

function EvaluationCardsByClass({
  groups,
  getAvailableActions,
  onOpenEdit,
  isMaternelle,
  selectedKeys,
  onToggleSelect,
  isEN,
  labels,
}: {
  groups: GroupedEvaluation[];
  getAvailableActions: (group: GroupedEvaluation) => EvaluationAction[];
  onOpenEdit: (group: GroupedEvaluation) => void;
  isMaternelle: boolean;
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  isEN: boolean;
  labels: any;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {groups.map((group, idx) => (
        <EvaluationProgramCard
          key={group.key || `${group.classId}-${group.evaluationTypeId}-${idx}`}
          group={group}
          isMaternelle={isMaternelle}
          actions={getAvailableActions(group)}
          onOpenEdit={() => onOpenEdit(group)}
          selected={selectedKeys.has(group.key)}
          onToggleSelect={() => onToggleSelect(group.key)}
          isEN={isEN}
          labels={labels}
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
  selected,
  onToggleSelect,
  isEN,
  labels,
}: {
  group: GroupedEvaluation;
  isMaternelle: boolean;
  actions: EvaluationAction[];
  onOpenEdit: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  isEN: boolean;
  labels: any;
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

  // ⭐ 2026-10-01 — Bilingual date range
  const dateRange = startDate
    ? sameDay || !endDate
      ? isEN ? `On ${fmtLong(startDate)}` : `Le ${fmtLong(startDate)}`
      : isEN ? `From ${fmtLong(startDate)} to ${fmtLong(endDate)}` : `Du ${fmtLong(startDate)} au ${fmtLong(endDate)}`
    : isEN ? 'Date not set' : 'Date non définie';

  // Statut agrégé — bilingue
  const allValidated = group.statuses.every((s) => s === 'VALIDATED' || s === 'LOCKED');
  const anyCancelled = group.statuses.some((s) => s === 'CANCELLED');
  const allPlanned = group.statuses.every((s) => s === 'PLANNED');
  const headerStatus = allValidated
    ? (isEN ? 'Completed' : 'Complétée')
    : anyCancelled
    ? (isEN ? 'Partially cancelled' : 'Partiellement annulée')
    : allPlanned
    ? (isEN ? 'Pending' : 'En attente')
    : (isEN ? 'In progress' : 'En cours');

  // Statut principal pour le badge (prendre le statut le plus "avancé")
  const primaryStatus = group.firstEvaluation.status;
  const subjectCount = group.subjects.length;

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-visible ${
      selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
    }`}>
      {/* En-tête : classe + statut + sélection */}
      <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(group.className || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-navy-900 truncate">{group.className}</h3>
              <p className="text-xs text-gray-500">
                {subjectCount} {isEN ? `subject${subjectCount > 1 ? 's' : ''} to assess` : `matière${subjectCount > 1 ? 's' : ''} à composer`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ⭐ Case à cocher de sélection multiple (suppression / modification groupées) */}
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={!!selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect();
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-[18px] h-[18px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                title={isEN ? 'Select for bulk action' : 'Sélectionner pour une action groupée'}
                aria-label={isEN ? `Select assessments for ${group.className}` : `Sélectionner les évaluations de ${group.className}`}
              />
            )}
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
            <p className="text-xs text-gray-500 mt-0.5">{translatePeriodName(group.periodName, isEN ? 'EN' : 'FR')}</p>
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
            {isEN ? 'Subjects to assess' : 'Matières à composer'}
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
              <span className="text-xs text-gray-400 italic">{isEN ? 'No subject' : 'Aucune matière'}</span>
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
              {isEN ? 'coef' : 'coef'} {group.firstEvaluation.coefficient}
            </span>
          </div>
        )}
      </div>

      {/* Pied : actions alignées (icônes uniquement, sans libellés) */}
      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-end space-x-1 bg-gray-50/30">
        {actions.length === 0 ? (
          <span className="text-xs text-gray-400 italic px-2">{isEN ? 'No action' : 'Aucune action'}</span>
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

// ─── ⭐ RÉORGANISATION 2026-11-17 — VUE PAR CLASSE ───────────────────────────
//
// L'onglet Évaluations est désormais organisé PAR CLASSE :
//   ┌─ Carte de classe (vue d'ensemble) ─────────────────────────────────┐
//   │  Avatar + Classe 6ème A                                            │
//   │  33 élèves · 7 matières (Pédagogie) · 4 sessions ce trimestre      │
//   │  [DS1] [DS2] [INT1] [INT2]  ← types programmés ce trimestre       │
//   │  « Aucune matière affectée » si la classe n'est pas configurée     │
//   └───────────────────────────────────────────────────────────────────┘
//   Clic → détail de la classe (cartes sessions existantes + actions).
//
// La carte montre EXACTEMENT ce que demande l'école : nombre d'élèves,
// nombre de sessions d'évaluation et types d'évaluation du trimestre
// sélectionné dans le filtre « Trimestre » de la barre d'outils.
// ────────────────────────────────────────────────────────────────────────────

interface ClassCardStats {
  classId: string;
  className: string;
  studentCount: number;
  subjectsCount: number;
  sessionsCount: number;
  types: Array<{ id: string; name: string; code?: string }>;
  hasSubjects: boolean;
}
function ClassCardGrid({
  stats,
  onOpenClass,
  labels,
  periodName,
}: {
  stats: ClassCardStats[];
  onOpenClass: (classId: string) => void;
  labels: any;
  periodName: string | null;
}) {
  return (
    <div className="space-y-3">
      {/* Sous-titre explicatif + trimestre courant */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-navy-900">{labels.byClassTitle}</h3>
        {periodName && (
          <span className="text-xs text-gray-500">
            {labels.typesForTerm} · {periodName}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-1">{labels.byClassSubtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {stats.map((c) => (
          <button
            key={c.classId}
            type="button"
            onClick={() => onOpenClass(c.classId)}
            className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col ${
              c.hasSubjects ? 'border-gray-200' : 'border-amber-200'
            }`}
          >
            {/* En-tête : avatar + classe + effectif */}
            <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {(c.className || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-navy-900 truncate">{c.className}</h4>
                  <p className="text-xs text-gray-500">
                    {c.studentCount} {labels.studentsLabel} · {c.subjectsCount} {labels.subjectsAssigned}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                c.sessionsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {c.sessionsCount} {labels.sessionsLabel}
              </span>
            </div>

            {/* Corps : types d'évaluation programmés ce trimestre */}
            <div className="p-4 flex-1 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {labels.typesForTerm}{periodName ? ` · ${periodName}` : ''}
              </p>
              {c.types.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.types.map((t) => (
                    <span
                      key={t.id}
                      title={t.name}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
                    >
                      {t.code ? `[${t.code}] ` : ''}{t.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  {c.hasSubjects ? labels.noSessionsForTerm : labels.configureSubjectsFirst}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * En-tête de la vue détail d'une classe : effectif, matières, sessions du
 * trimestre sélectionné et types programmés (les mêmes badges que les cartes).
 */
function ClassDetailHeader({
  stats,
  labels,
  periodName,
}: {
  stats: ClassCardStats | null;
  labels: any;
  periodName: string | null;
}) {
  if (!stats) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
            {(stats.className || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-navy-900 truncate">{stats.className}</h3>
            <p className="text-xs text-gray-500">
              {stats.studentCount} {labels.studentsLabel} · {stats.subjectsCount} {labels.subjectsAssigned} · {stats.sessionsCount} {labels.classDetailSessions}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {periodName ? `${labels.typesForTerm} · ${periodName}` : labels.typesForTerm}
        </span>
      </div>
      {stats.types.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-1.5">
          {stats.types.map((t) => (
            <span
              key={t.id}
              title={t.name}
              className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
            >
              {t.code ? `[${t.code}] ` : ''}{t.name}
            </span>
          ))}
        </div>
      )}
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

  // ⭐ RÉORGANISATION 2026-11-17 — VUE PAR CLASSE :
  //   - selectedClassId : null = grille des classes ; un id = détail de la
  //     classe (ses sessions d'évaluation + actions).
  //   - periodFilter : trimestre sélectionné dans la barre d'outils (les
  //     statistiques des cartes et la vue détail suivent ce trimestre).
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');

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

  // ⭐ FIX 2026-11-17 (« gymnastique » module Examens) : affectations
  //    matières × classes déjà configurées dans Pédagogie > Matières &
  //    Programmes (class_subjects). Clé = officialClassId (classe officielle)
  //    → liste { subjectId, coefficient, subjectName }. Permet au modal de
  //    programmation d'afficher AUTOMATIQUEMENT les matières de la classe
  //    sélectionnée (avec leurs coefficients) au lieu de demander à
  //    l'utilisateur de re-sélectionner les matières à chaque fois.
  const [classAssignments, setClassAssignments] = useState<
    Record<string, Array<{ subjectId: string; coefficient: number; subjectName?: string }>>
  >({});

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
      // ⭐ 2026-10-01 — Envoyer `language` au backend pour filtrer les
      //    évaluations par piste linguistique (champ `language` sur
      //    l'évaluation, pas sur la classe). Chaque évaluation porte son
      //    propre marqueur FR/EN → pas de mélange possible.
      if (scopeLang) params.language = scopeLang;

      // ⭐ FIX PERF (2026-09-21 — « plus d'une minute avant que le chargement
      //    ne s'effectue », toasts « délai dépassé ») : les 5 requêtes partent
      //    désormais TOUTES EN PARALLÈLE. Avant, getActive (paramétrage) était
      //    AWAITÉ SÉQUENTIELLEMENT AVANT le Promise.all → un aller-retour
      //    complet de plus (jusqu'à 25-30 s via le Service Worker sur réseau
      //    lent) avant même que les données principales ne partent. En cascade
      //    avec /api/all-classes (qui refaisait la résolution d'année en plus),
      //    le pire cas dépassait largement la minute.
      //
      //    Complément (services) : getEvaluations et getActive passent par le
      //    cache client (45 s + dédup en vol) → le double montage de la page
      //    (résolution de availableLevels) ne rejoue plus N requêtes réseau
      //    identiques, et le rafraîchissement post-enregistrement ne refetch
      //    que la liste des évaluations (invalidée par la mutation).
      const [activeSettings, evals, allClassesData, periodsData, subjectsData, classSubjectsData] = await Promise.all([
        academicSettingsService.getActive(academicYear.id, {
          levelCode: scopeLevel || undefined,
          language: scopeLang || undefined,
        }).catch(() => null),
        institutionalExamsService.getEvaluations(params),
        // ⭐ academicYearId transmis → la route BFF saute la résolution d'année
        //    (un fetch de moins côté serveur) + cache client 45 s avec dédup en
        //    vol (double montage de la page → 1 seule requête réseau réelle).
        cachedGet(`GET:/api/all-classes?year=${academicYear.id}`, () =>
          fetch(`/api/all-classes?academicYearId=${encodeURIComponent(academicYear.id)}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
        ).catch(() => []),
        getAcademicYearPeriods(academicYear.id).catch(() => []),
        // ⭐ V10c — On ne récupère QUE les matières du niveau + de la piste
        // linguistique (language=EN → uniquement anglophones côté backend).
        pedagogyService.getSubjects(academicYear.id, {
          schoolLevelId: schoolLevelUuid,
          language: scopeLang,
        }).catch(() => []),
        // ⭐ FIX 2026-11-17 : toutes les affectations matières × classes du
        //    tenant pour l'année (class_subjects, avec subject inclus).
        //    GET /api/pedagogy/class-subjects?academicYearId=X (endpoint batch
        //    du module Pédagogie) → permet de connaître, pour chaque classe,
        //    SES matières et SES coefficients configurés dans
        //    Pédagogie > Matières & Programmes.
        fetch(`/api/pedagogy/class-subjects?academicYearId=${encodeURIComponent(academicYear.id)}`, { credentials: 'include' })
          .then(r => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);

      // Convertir assessmentTypes → format EvaluationTypeItem
      const assessmentTypes = activeSettings?.config?.assessmentTypes || [];
      // ⭐ V10g — Piste EN : barème par CODE (First CA /20, Second CA /20,
      // Examination /60 — CA1 + CA2 + Exam = /100 par matière au récapitulatif
      // trimestriel), indépendamment du scoreMax global de la config.
      // Les types settings utilisent les codes FIRST_CA / SECOND_CA / EXAM.
      const enMaxByCode = (code: string): number => {
        const c = (code || '').toUpperCase();
        if (c === 'EXAM' || c === 'EXAMINATION') return 60;
        // ⭐ 2026-10-01 — First CA et Second CA : maxScore = 20 (par défaut, 20+20+60=100)
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

      // ⭐ 2026-10-01 — Le filtrage par piste linguistique se fait côté backend
      //    via le champ `language` sur l'évaluation (where.language=FR/EN).
      //    Plus besoin de filtrer côté frontend par validClassIds.

      setPeriods(Array.isArray(periodsData) ? periodsData : []);

      // ⭐ FIX 2026-11-17 : indexer les affectations matières × classes
      //    (class_subjects du module Pédagogie) par classe officielle.
      //    academicClassId = pedagogy_academic_classes.id ; les classes
      //    opérationnelles du sélecteur pointent dessus via officialClassId.
      const rawAssignments = Array.isArray(classSubjectsData) ? classSubjectsData : [];
      const assignmentsByOfficialClass: Record<
        string,
        Array<{ subjectId: string; coefficient: number; subjectName?: string }>
      > = {};
      for (const a of rawAssignments) {
        const key: string | null | undefined = a?.academicClassId || a?.classId;
        if (!key || !a?.subjectId) continue;
        (assignmentsByOfficialClass[key] ||= []).push({
          subjectId: a.subjectId,
          coefficient: Number(a.coefficient ?? 1),
          subjectName: a.subject?.name,
        });
      }
      setClassAssignments(assignmentsByOfficialClass);

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

  // ⭐ RÉORGANISATION 2026-11-17 — par défaut, le filtre trimestre se cale sur
  //    le trimestre ACTIF (celui « dans lequel nous sommes »). L'utilisateur
  //    peut ensuite changer de trimestre ou voir tous.
  useEffect(() => {
    if (periodFilter === 'ALL') {
      const active = (periods || []).find((p) => (p as any).isActive && !p.isClosed);
      if (active) setPeriodFilter(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  // ─── Filtrage des évaluations (search + status + TRIMESTRE) ───────────
  const filteredEvaluations = useMemo(() => {
    let result = evaluations;
    // ⭐ Filtre trimestre (vue par classe : statistiques et vue détail suivent
    //    le trimestre sélectionné dans la barre d'outils)
    if (periodFilter !== 'ALL') {
      result = result.filter(e => e.period?.id === periodFilter);
    }
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
  }, [evaluations, statusFilter, searchQuery, periodFilter]);

  // ⭐ Regroupement des évaluations filtrées (une carte = 1 session par classe)
  const groupedEvaluations = useMemo(
    () => buildEvaluationGroups(filteredEvaluations, isEN),
    [filteredEvaluations, isEN],
  );

  // ⭐ RÉORGANISATION 2026-11-17 — sessions regroupées PAR CLASSE (l'onglet
  //    est désormais organisé par classe : grille des classes → détail).
  const groupsByClassId = useMemo(() => {
    const map = new Map<string, GroupedEvaluation[]>();
    for (const g of groupedEvaluations) {
      if (!map.has(g.classId)) map.set(g.classId, []);
      map.get(g.classId)!.push(g);
    }
    return map;
  }, [groupedEvaluations]);

  // ⭐ Matières affectées à une classe (Pédagogie > Matières & Programmes,
  //    résolution officialClassId → class_subjects) — réutilisé par la grille
  //    des classes, le détail et le modal simplifié.
  const assignmentsForClass = useCallback((classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    const officialId = cls?.officialClassId;
    return officialId ? (classAssignments[officialId] || []) : [];
  }, [classes, classAssignments]);

  // ⭐ Statistiques par classe — alimentent la grille « Évaluations par
  //    classe » : effectif, nombre de matières, nombre de sessions et types
  //    programmés pour le trimestre sélectionné.
  const classCardStats = useMemo<ClassCardStats[]>(() => {
    return classes.map((c) => {
      const classGroups = groupsByClassId.get(c.id) || [];
      const assignments = assignmentsForClass(c.id);
      const types = Array.from(
        new Map(
          classGroups.map((g) => [g.evaluationTypeId, {
            id: g.evaluationTypeId,
            name: g.evaluationTypeName,
            code: g.evaluationTypeCode,
          }]),
        ).values(),
      );
      return {
        classId: c.id,
        className: isEN ? translateClassName(c.name) : c.name,
        studentCount: c.studentCount ?? 0,
        subjectsCount: assignments.length,
        sessionsCount: classGroups.length,
        types,
        hasSubjects: assignments.length > 0,
      };
    });
  }, [classes, groupsByClassId, assignmentsForClass, isEN]);

  const activePeriodName = useMemo(() => {
    const p = periods.find((p) => p.id === periodFilter);
    return p ? translatePeriodName(p.name, scopeLang as 'FR' | 'EN' | undefined) : null;
  }, [periods, periodFilter, scopeLang]);

  // ─── ⭐ FIX 2026-11-17 : matières proposées dans le modal selon la/les
  //    classe(s) sélectionnée(s) ────────────────────────────────────────────
  //
  // « Le système doit savoir que quand on prend une classe, cette classe a
  //  déjà ses matières affectées avec leurs coefficients » :
  //  - aucune classe sélectionnée → liste complète du niveau (comportement
  //    historique, avec l'invite « sélectionnez d'abord une classe ») ;
  //  - UNE classe sélectionnée → SES matières affectées dans
  //    Pédagogie (via officialClassId → class_subjects), avec leurs
  //    coefficients, toutes cochées par défaut ;
  //  - PLUSIEURS classes → intersection des matières affectées à TOUTES les
  //    classes sélectionnées (une évaluation (classe × matière) n'a de sens
  //    que si la matière est affectée à la classe) ;
  //  - classe sans affectation → repli sur la liste du niveau avec un
  //    avertissement invitant à configurer Pédagogie > Matières & Programmes.
  const modalSubjects = useMemo(() => {
    if (form.classIds.length === 0) {
      return { list: subjects as Array<SubjectItem & { coefficient?: number }>, mode: 'level' as const };
    }
    // Matières affectées par classe (via officialClassId → class_subjects)
    const perClass = form.classIds.map((cid) => {
      const cls = classes.find((c) => c.id === cid);
      const officialId = cls?.officialClassId;
      const assignments = officialId ? (classAssignments[officialId] || []) : [];
      return assignments.map((a) => ({
        id: a.subjectId,
        name: a.subjectName || subjects.find((s) => s.id === a.subjectId)?.name || '—',
        coefficient: a.coefficient,
      }));
    });
    const anyEmpty = perClass.some((l) => l.length === 0);
    if (anyEmpty) {
      return { list: subjects as Array<SubjectItem & { coefficient?: number }>, mode: 'level' as const };
    }
    // Intersection : matières présentes dans TOUTES les classes sélectionnées
    const [first, ...rest] = perClass;
    const inter = first.filter((a) =>
      rest.every((l) => l.some((x) => x.id === a.id)),
    );
    return { list: inter, mode: 'class' as const };
  }, [form.classIds, classes, classAssignments, subjects]);

  // Synchroniser form.subjectIds quand la sélection de classes change :
  //  - une seule classe (mode 'class') → toutes ses matières cochées par
  //    défaut (l'utilisateur décoche celles à exclure) ;
  //  - plusieurs classes → on garde les matières toujours valides ;
  //  - mode 'level' → on garde la sélection si elle reste valide.
  // NB : l'effet ne se déclenche QUE sur changement de classes/modalSubjects —
  // les décochemes manuels de l'utilisateur ne sont jamais écrasés.
  useEffect(() => {
    if (form.classIds.length === 0) return;
    const validIds = new Set(modalSubjects.list.map((s) => s.id));
    const filtered = form.subjectIds.filter((id) => validIds.has(id));
    if (!editingId && form.classIds.length === 1 && modalSubjects.mode === 'class') {
      // Une classe → toutes ses matières par défaut
      if (filtered.length !== modalSubjects.list.length) {
        setForm((f) => ({ ...f, subjectIds: modalSubjects.list.map((s) => s.id) }));
      }
    } else if (filtered.length !== form.subjectIds.length) {
      setForm((f) => ({ ...f, subjectIds: filtered }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classIds, modalSubjects, editingId]);

  // ─── SÉLECTION MULTIPLE (suppression / modification groupées) ──────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkEditForm>(EMPTY_BULK_FORM);

  const selectedGroups = useMemo(
    () => groupedEvaluations.filter((g) => selectedKeys.has(g.key)),
    [groupedEvaluations, selectedKeys],
  );
  const selectedEvalCount = selectedGroups.reduce((n, g) => n + g.evaluationIds.length, 0);

  // ⭐ Sessions actuellement VISIBLES (vue par classe : seulement celles de
  //    la classe ouverte en détail — « tout sélectionner » ne doit pas
  //    sélectionner des sessions invisibles d'autres classes).
  const visibleGroups = useMemo(
    () => (selectedClassId ? (groupsByClassId.get(selectedClassId) || []) : []),
    [selectedClassId, groupsByClassId],
  );

  const toggleSelectGroup = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectAllGroups = () => setSelectedKeys(new Set(visibleGroups.map((g) => g.key)));
  const clearSelection = () => setSelectedKeys(new Set());

  // Réinitialiser la sélection quand on change de niveau / langue / année
  useEffect(() => {
    clearSelection();
    // ⭐ Vue par classe : on revient à la grille des classes
    setSelectedClassId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLevel, scopeLang, academicYear?.id]);

  /**
   * ⭐ SUPPRESSION MULTIPLE : supprime toutes les évaluations des sessions
   * sélectionnées. ⭐ (sept. 2026 — retour promoteur) : les VALIDÉES sont
   * désormais supprimables (l'API les annule si elles portent des notes —
   * workflow « annuler d'abord » automatisé) ; seules les VERROUILLÉES
   * (délibération) sont ignorées.
   */
  const handleBulkDelete = async () => {
    const allIds = selectedGroups.flatMap((g) => g.evaluationIds);
    const deletableIds = allIds.filter((id) => {
      const ev = evaluations.find((e) => e.id === id);
      return ev && ev.status !== 'LOCKED';
    });
    const skipped = allIds.length - deletableIds.length;

    if (deletableIds.length === 0) {
      toastWarning('Aucune évaluation supprimable dans la sélection (verrouillées par délibération).');
      return;
    }

    const classNames = Array.from(new Set(selectedGroups.map((g) => g.className))).join(', ');
    const ok = await danger(
      `Supprimer ${deletableIds.length} évaluation(s) sur ${selectedGroups.length} classe(s) ?\n\nClasses : ${classNames}` +
        (skipped > 0 ? `\n\n⚠ ${skipped} évaluation(s) verrouillée(s) seront ignorées.` : '') +
        `\n\n⚠ Les évaluations VALIDÉES portant des notes seront ANNULÉES (conservées dans l'historique) ; les autres seront définitivement supprimées.`,
      'Suppression multiple',
      'Cette action est irréversible. Les évaluations contenant des notes seront annulées (conservées dans l\u2019historique).'
    );
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        deletableIds.map((id) => institutionalExamsService.deleteEvaluation(id)),
      );
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      if (failCount > 0) {
        toastWarning(`${okCount} évaluation(s) supprimée(s), ${failCount} en échec`, {
          description: 'Consultez la console pour les détails.',
        });
      } else {
        toastSuccess(`${okCount} évaluation(s) supprimée(s)`, {
          description: `${selectedGroups.length} classe(s) : ${classNames}`,
        });
      }
      clearSelection();
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la suppression multiple', { description: err.message });
    } finally {
      setBulkDeleting(false);
    }
  };

  /**
   * ⭐ MODIFICATION MULTIPLE : applique les MÊMES informations à toutes les
   * évaluations sélectionnées. Seuls les champs cochés sont appliqués —
   * les VALIDATED/LOCKED/CANCELLED sont ignorées (verrouillées).
   */
  const handleBulkEditSave = async () => {
    const anyApplied = bulkForm.applyType || bulkForm.applyPeriod || bulkForm.applyDates
      || bulkForm.applyMaxScore || bulkForm.applyCoefficient || bulkForm.applyTitle;
    if (!anyApplied) {
      toastError('Cochez au moins un champ à appliquer à la sélection.');
      return;
    }
    if (bulkForm.applyDates && (!bulkForm.startDate || !bulkForm.endDate)) {
      toastError('Dates de début et de fin requises.');
      return;
    }
    if (bulkForm.applyType && !bulkForm.evaluationTypeId) {
      toastError('Sélectionnez le type d\u2019évaluation à appliquer.');
      return;
    }
    if (bulkForm.applyPeriod && !bulkForm.periodId) {
      toastError('Sélectionnez la période à appliquer.');
      return;
    }

    // Construire le payload avec les SEULS champs cochés
    const payload: any = {};
    if (bulkForm.applyType) payload.evaluationTypeId = bulkForm.evaluationTypeId;
    if (bulkForm.applyPeriod) payload.periodId = bulkForm.periodId;
    if (bulkForm.applyDates) {
      const startIso = new Date(bulkForm.startDate).toISOString();
      const endIso = new Date(bulkForm.endDate).toISOString();
      payload.evaluationDate = startIso;
      payload.startDate = startIso;
      payload.endDate = endIso;
    }
    if (bulkForm.applyMaxScore && !isMaternelle) {
      payload.maxScore = parseFloat(bulkForm.maxScore) || 20;
    }
    if (bulkForm.applyCoefficient && !isMaternelle && !isEN) {
      payload.coefficient = parseFloat(bulkForm.coefficient) || 1;
    }
    if (bulkForm.applyTitle) {
      payload.title = bulkForm.title.trim() || null;
    }

    // Cibler uniquement les évaluations modifiables (non verrouillées)
    const targetIds: string[] = [];
    selectedGroups.forEach((g) =>
      g.evaluationIds.forEach((id) => {
        const ev = evaluations.find((e) => e.id === id);
        if (ev && !['VALIDATED', 'LOCKED', 'CANCELLED'].includes(ev.status)) {
          targetIds.push(id);
        }
      }),
    );
    const skipped = selectedEvalCount - targetIds.length;

    if (targetIds.length === 0) {
      toastWarning('Aucune évaluation modifiable dans la sélection (validées, verrouillées ou annulées).');
      return;
    }

    setBulkSaving(true);
    try {
      const results = await Promise.allSettled(
        targetIds.map((id) => institutionalExamsService.updateEvaluation(id, payload)),
      );
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      if (failCount > 0) {
        toastWarning(`${okCount} évaluation(s) mise(s) à jour, ${failCount} en échec`, {
          description: 'Consultez la console pour les détails.',
        });
      } else {
        toastSuccess(`${okCount} évaluation(s) mise(s) à jour`, {
          description:
            `${selectedGroups.length} classe(s) · champs appliqués : ` +
            [
              bulkForm.applyType ? 'type' : null,
              bulkForm.applyPeriod ? 'période' : null,
              bulkForm.applyDates ? 'dates' : null,
              bulkForm.applyMaxScore && !isMaternelle ? 'barème' : null,
              bulkForm.applyCoefficient && !isMaternelle && !isEN ? 'coefficient' : null,
              bulkForm.applyTitle ? 'titre' : null,
            ].filter(Boolean).join(', ') +
            (skipped > 0 ? ` · ${skipped} ignorée(s) (verrouillée(s))` : ''),
        });
      }
      setIsBulkEditOpen(false);
      clearSelection();
      await loadData();
    } catch (err: any) {
      toastError('Erreur lors de la modification multiple', { description: err.message });
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    // ⭐ RÉORGANISATION 2026-11-17 — modal SIMPLIFIÉ : on demande UNIQUEMENT
    //    1. la/les classe(s) (multi-sélection, pré-cochée avec la classe
    //       courante si on est dans la vue détail d'une classe)
    //    2. le trimestre (pré-sélectionné sur le trimestre actif)
    //    3. le(s) type(s) d'évaluation (multi-sélection)
    //    → les matières de CHAQUE classe (Pédagogie > Matières & Programmes)
    //      sont associées AUTOMATIQUEMENT — plus aucune sélection de matières.
    //    Dates/intitulé/barème en options avancées (défaut = aujourd'hui).
    const currentPeriod = periods.find(p => p.isActive && !p.isClosed) || periods[0];
    setForm({
      ...EMPTY_FORM,
      // Pré-cocher la classe courante si on est dans sa vue détail
      classIds: selectedClassId ? [selectedClassId] : [],
      // Pré-sélectionner le trimestre du FILTRE courant (ou l'actif)
      periodId: (periodFilter !== 'ALL' ? periodFilter : currentPeriod?.id) || '',
      evaluationTypeIds: [],
      // Maternelle : pas de barème numérique (qualitatif TS/S/PS)
      maxScore: isMaternelle ? '0' : '20',
      coefficient: isMaternelle ? '0' : '1',
      subjectIds: [],
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
      evaluationTypeIds: [], // (édition = type unique)
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
    // ─── ⭐ RÉORGANISATION 2026-11-17 : deux chemins distincts ────────────
    //    ÉDITION (groupe existant) : validation historique (classe + matières
    //    cochées + type unique + période + dates) puis suppression/recréation.
    if (editingId) {
      if (form.classIds.length === 0 || form.subjectIds.length === 0 || !form.periodId || !form.evaluationTypeId || !form.startDate || !form.endDate) {
        toastError(isEN ? 'Please fill in all required fields' : 'Veuillez remplir tous les champs obligatoires');
        return;
      }
    } else {
      // CRÉATION (modal simplifié) : classes + trimestre + type(s) suffisent —
      // les matières de chaque classe sont résolues automatiquement.
      if (form.classIds.length === 0 || !form.periodId || form.evaluationTypeIds.length === 0 || !form.startDate || !form.endDate) {
        toastError(isEN ? 'Select the class(es), the term and at least one assessment type.' : 'Sélectionnez la/les classe(s), le trimestre et au moins un type d\'évaluation.');
        return;
      }
      // Garde-fou : chaque classe sélectionnée doit avoir SES matières
      // configurées dans Pédagogie > Matières & Programmes.
      const missing = form.classIds
        .map((cid) => {
          const cls = classes.find((c) => c.id === cid);
          const has = assignmentsForClass(cid).length > 0;
          return has ? null : (isEN ? translateClassName(cls?.name || '') : (cls?.name || cid));
        })
        .filter(Boolean) as string[];
      if (missing.length > 0) {
        toastError(labels.classesWithoutSubjects(missing.join(', ')));
        return;
      }
    }
    setSaving(true);
    try {
      const basePayload: any = {
        description: form.description || null,
        periodId: form.periodId,
        evaluationDate: new Date(form.startDate).toISOString(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        // ⭐ 2026-10-01 — Marquer la piste linguistique de l'évaluation (FR ou EN)
        language: scopeLang || 'FR',
      };
      // ⭐ Maternelle = qualitatif (TS/S/PS) — pas de barème numérique ni coefficient
      if (!isMaternelle) {
        basePayload.maxScore = parseFloat(form.maxScore) || 20;
        basePayload.coefficient = parseFloat(form.coefficient) || 1;
        // ⭐ FIX 2026-11-17 : reprendre le coefficient défini PAR MATIÈRE dans
        //    Pédagogie > Matières & Programmes (affectation classe × matière).
        //    Le backend résout le coefficient de chaque évaluation via
        //    classes.officialClassId → class_subjects.coefficient ; la valeur
        //    du formulaire ne sert que de repli. (Piste EN : pas de coefficient.)
        if (!isEN) basePayload.respectSubjectCoefficients = true;
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
          title: form.title || null,
          evaluationTypeId: form.evaluationTypeId,
          classIds: form.classIds,
          subjectIds: form.subjectIds,
        };
        const result = await institutionalExamsService.createBulkEvaluations(bulkPayload);
        toastSuccess(
          isEN ? `${result.created} assessment(s) updated` : `${result.created} évaluation(s) modifiée(s)`,
          {
            description: `${form.classIds.length} ${isEN ? 'class(es)' : 'classe(s)'} × ${form.subjectIds.length} ${isEN ? 'subject(s)' : 'matière(s)'}`,
          },
        );
      } else {
        // ⭐ CRÉATION SIMPLIFIÉE — pour chaque type coché, une programmation
        //    par classe est créée avec les matières PROPRES à chaque classe
        //    (subjectsByClass — plus d'intersection : la 6e compose ses 7
        //    matières pendant que la 4e compose ses 8).
        const subjectsByClass: Record<string, string[]> = {};
        for (const cid of form.classIds) {
          subjectsByClass[cid] = Array.from(
            new Set(assignmentsForClass(cid).map((a) => a.subjectId)),
          );
        }
        let created = 0;
        let teachersNotified = 0;
        const usedTypeNames: string[] = [];
        for (const typeId of form.evaluationTypeIds) {
          const t = evaluationTypes.find((et) => et.id === typeId);
          if (!t) continue;
          const periodName = periods.find((p) => p.id === form.periodId)?.name || '';
          const translatedPeriod = translatePeriodName(periodName, scopeLang as 'FR' | 'EN' | undefined);
          const result = await institutionalExamsService.createBulkEvaluations({
            ...basePayload,
            // Titre auto : « Devoir surveillé 1 - Trimestre 1 » (modifiable)
            title: form.title?.trim()
              ? form.title
              : (t.name ? `${t.name} - ${translatedPeriod}` : null),
            evaluationTypeId: typeId,
            classIds: form.classIds,
            subjectsByClass,
          });
          created += result.created || 0;
          teachersNotified += (result as any)?.teachersAssigned || 0;
          usedTypeNames.push(t.code ? `[${t.code}] ${t.name}` : t.name);
        }

        // ⭐ Toast détaillé : classes + types + matières par classe
        const classNames = form.classIds
          .map((cid) => {
            const cls = classes.find((c) => c.id === cid);
            return cls ? (isEN ? translateClassName(cls.name) : cls.name) : null;
          })
          .filter(Boolean) as string[];
        const subjectsByClassPreviewTotal = Object.values(subjectsByClass)
          .reduce((n, list) => n + list.length, 0);

        toastSuccess(
          isEN ? `${created} assessment(s) scheduled` : `${created} évaluation(s) programmée(s)`,
          {
            description:
              `${classNames.length} ${isEN ? `class${classNames.length > 1 ? 'es' : ''}` : `classe${classNames.length > 1 ? 's' : ''}`} (${classNames.join(', ')}) • ` +
              `${usedTypeNames.length} ${isEN ? `type${usedTypeNames.length > 1 ? 's' : ''}` : `type${usedTypeNames.length > 1 ? 's' : ''}`} (${usedTypeNames.join(', ')}) • ` +
              `${subjectsByClassPreviewTotal} ${isEN ? `subject slot${subjectsByClassPreviewTotal > 1 ? 's' : ''} ` : `matière${subjectsByClassPreviewTotal > 1 ? 's' : ''} `}` +
              (isEN ? 'assigned automatically per class' : 'associées automatiquement par classe') +
              (teachersNotified > 0
                ? ` • ${teachersNotified} ${isEN ? `teacher${teachersNotified > 1 ? 's' : ''} notified` : `enseignant${teachersNotified > 1 ? 's' : ''} notifié${teachersNotified > 1 ? 's' : ''}`}`
                : ''),
            duration: 6000,
          },
        );
      }
      handleCloseModal();
      await loadData();
    } catch (err: any) {
      toastError(isEN ? 'Error while saving' : 'Erreur lors de la sauvegarde', { description: err.message });
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
      // ⭐ FIX 2026-11-18 — les échecs ne sont plus avalés silencieusement :
      //    on collecte chaque erreur et on affiche le message serveur exact
      //    (avant : toast de succès même si TOUTES les actions échouaient).
      const failures: string[] = [];
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.openEvaluation(id).catch((e: any) => {
            console.warn(`Failed to open eval ${id}:`, e);
            const msg =
              (e?.response?.data?.message as string) ||
              (e?.isTimeout ? "Délai d'attente dépassé — réessayez" : null) ||
              e?.message ||
              'Erreur inconnue';
            failures.push(Array.isArray(msg) ? msg.join(' · ') : msg);
          }),
        ),
      );
      if (failures.length > 0) {
        toastError(
          `Ouverture échouée — ${failures.length}/${group.evaluationIds.length} évaluation(s) NON ouverte(s)`,
          { description: failures.slice(0, 2).join(' … ') },
        );
      } else {
        toastSuccess(`${group.evaluationIds.length} évaluation(s) ouverte(s) pour la saisie`);
      }
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
      // ⭐ FIX 2026-11-18 — même correction : les échecs deviennent visibles.
      const failures: string[] = [];
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.submitEvaluation(id).catch((e: any) => {
            console.warn(`Failed to submit eval ${id}:`, e);
            const msg =
              (e?.response?.data?.message as string) ||
              e?.message ||
              'Erreur inconnue';
            failures.push(Array.isArray(msg) ? msg.join(' · ') : msg);
          }),
        ),
      );
      if (failures.length > 0) {
        toastError(
          `Soumission échouée — ${failures.length}/${group.evaluationIds.length} évaluation(s) NON soumise(s)`,
          { description: failures.slice(0, 2).join(' … ') },
        );
      } else {
        toastSuccess(`${group.evaluationIds.length} évaluation(s) soumise(s)`);
      }
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
      // ⭐ FIX 2026-11-18 (« notes validées mais invisibles registre/bulletins ») :
      //    AVANT, chaque échec de validation était avalé (console.warn) et le
      //    toast annonçait « X évaluation(s) validée(s) » même si TOUT avait
      //    échoué (403 permission exams.validate / périmètre niveau, 400
      //    évaluation non soumise, timeout…) → les évaluations restaient
      //    SUBMITTED/PLANNED → registre des notes et bulletins vides.
      //    Maintenant : message serveur exact + compte des échecs.
      const failures: string[] = [];
      await Promise.all(
        group.evaluationIds.map((id) =>
          institutionalExamsService.validateEvaluation(id).catch((e: any) => {
            console.warn(`Failed to validate eval ${id}:`, e);
            const msg =
              (e?.response?.data?.message as string) ||
              (e?.isTimeout ? "Délai d'attente dépassé — réessayez" : null) ||
              e?.message ||
              'Erreur inconnue';
            failures.push(Array.isArray(msg) ? msg.join(' · ') : msg);
          }),
        ),
      );
      if (failures.length > 0) {
        toastError(
          `Validation échouée — ${failures.length}/${group.evaluationIds.length} évaluation(s) NON validée(s)`,
          {
            description:
              failures.slice(0, 2).join(' … ') +
              (failures.length > 2 ? ` (+${failures.length - 2} autre(s))` : ''),
          },
        );
      } else {
        toastSuccess(`${group.evaluationIds.length} évaluation(s) validée(s)`, {
          description: 'Les notes apparaissent maintenant dans le registre des notes et les bulletins.',
        });
      }
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
      actions.push({ label: labels.open, icon: Play, onClick: () => handleOpen(group), color: 'text-amber-600 hover:bg-amber-50' });
    }
    if (status === 'OPEN_FOR_GRADING') {
      actions.push({ label: labels.submit, icon: Send, onClick: () => handleSubmit(group), color: 'text-purple-600 hover:bg-purple-50' });
    }
    if (status === 'SUBMITTED') {
      actions.push({ label: labels.validate, icon: CheckCircle, onClick: () => handleValidate(group), color: 'text-emerald-600 hover:bg-emerald-50' });
    }

    // Edit est possible tant que non validée/verrouillée/annulée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: labels.edit, icon: Pencil, onClick: () => handleOpenEdit(group), color: 'text-blue-600 hover:bg-blue-50' });
    }

    // Annuler — possible tant que non validée/verrouillée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: labels.cancel, icon: XCircle, onClick: () => handleCancel(group), color: 'text-orange-600 hover:bg-orange-50' });
    }

    // Supprimer — ⭐ (sept. 2026) : possible aussi pour VALIDATED (l'API
    // annule les évaluations validées portant des notes — workflow « annuler
    // d'abord » automatisé) ; seul LOCKED (délibération) reste protégé.
    if (status !== 'LOCKED') {
      actions.push({ label: labels.delete, icon: Trash2, onClick: () => handleDelete(group), color: 'text-red-600 hover:bg-red-50' });
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
                  placeholder={labels.searchPlaceholder}
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                {/* ⭐ RÉORGANISATION 2026-11-17 — filtre TRIMESTRE : les cartes de
                    classe et la vue détail suivent le trimestre sélectionné
                    (défaut = trimestre actif). */}
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-[170px] h-9">
                    <SelectValue placeholder={labels.allPeriodsLabel}>
                      {(() => {
                        const p = periods.find((pp) => pp.id === periodFilter);
                        return p
                          ? `${translatePeriodName(p.name, scopeLang as 'FR' | 'EN' | undefined)}${p.isClosed ? ` (${labels.closed})` : ''}`
                          : labels.allPeriodsLabel;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{labels.allPeriodsLabel}</SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.isClosed}>
                        {translatePeriodName(p.name, scopeLang)}{p.isClosed ? ` (${labels.closed})` : ''}{(p as any).isActive && !p.isClosed ? ` (${labels.active})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder={labels.allStatuses} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{labels.allStatuses}</SelectItem>
                    <SelectItem value="DRAFT">{labels.draft}</SelectItem>
                    <SelectItem value="PLANNED">{labels.planned}</SelectItem>
                    <SelectItem value="OPEN_FOR_GRADING">{labels.openForGrading}</SelectItem>
                    <SelectItem value="SUBMITTED">{labels.submitted}</SelectItem>
                    <SelectItem value="VALIDATED">{labels.validated}</SelectItem>
                    <SelectItem value="LOCKED">{labels.locked}</SelectItem>
                    <SelectItem value="CANCELLED">{labels.cancelled}</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">{labels.newEvaluation}</span>
                </button>
              </div>
            </div>

            {/* ⭐ Barre d'actions groupées (suppression / modification multiples) */}
            {selectedEvalCount > 0 && (
              <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 shadow-lg">
                <ListChecks className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap">
                  {selectedGroups.length} session{selectedGroups.length > 1 ? 's' : ''} sélectionnée{selectedGroups.length > 1 ? 's' : ''} — {selectedEvalCount} évaluation{selectedEvalCount > 1 ? 's' : ''}
                </span>
                <div className="flex-1" />
                {selectedKeys.size < visibleGroups.length ? (
                  <button
                    onClick={selectAllGroups}
                    className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {labels.selectAll}
                  </button>
                ) : (
                  <button
                    onClick={clearSelection}
                    className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {labels.deselectAll}
                  </button>
                )}
                <button
                  onClick={() => {
                    // Pré-remplir avec les valeurs de la 1ère session sélectionnée
                    const first = selectedGroups[0];
                    setBulkForm({
                      ...EMPTY_BULK_FORM,
                      evaluationTypeId: first?.evaluationTypeCode || '',
                      periodId: first?.periodId || '',
                      maxScore: first ? String(first.firstEvaluation.maxScore || 20) : '20',
                      coefficient: first ? String(first.firstEvaluation.coefficient || 1) : '1',
                    });
                    setIsBulkEditOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {labels.bulkEdit}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {labels.delete}
                </button>
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" />
                  {labels.cancel}
                </button>
              </div>
            )}

            {/* ⭐ RÉORGANISATION 2026-11-17 — VUE PAR CLASSE :
                - pas de classe sélectionnée → grille des classes (effectif,
                  sessions, types du trimestre) ;
                - classe sélectionnée → ses sessions d'évaluation (cartes
                  existantes + actions) avec en-tête de retour. */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">{labels.loadingEvaluations}</span>
              </div>
            ) : !selectedClassId ? (
              /* ── Vue d'ensemble : cartes par classe (filtre de recherche par
                    nom de classe actif en vue grille) ── */
              (() => {
                const q = searchQuery.trim().toLowerCase();
                const visibleStats = q
                  ? classCardStats.filter((s) => s.className.toLowerCase().includes(q))
                  : classCardStats;
                if (visibleStats.length === 0) {
                  return (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium mb-1">{labels.noEvaluationsFiltered}</p>
                      <p className="text-sm text-gray-400">{labels.noClasses}</p>
                    </div>
                  );
                }
                return (
                  <ClassCardGrid
                    stats={visibleStats}
                    onOpenClass={(classId) => setSelectedClassId(classId)}
                    labels={labels}
                    periodName={activePeriodName}
                  />
                );
              })()
            ) : (
              /* ── Vue détail : les évaluations programmées de CETTE classe ── */
              <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedClassId(null)}
                className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <X className="w-4 h-4" />
                {labels.backToClasses}
              </button>
              <ClassDetailHeader
                stats={classCardStats.find((s) => s.classId === selectedClassId) || null}
                labels={labels}
                periodName={activePeriodName}
              />
              {(groupsByClassId.get(selectedClassId) || []).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">{labels.noEvaluations}</p>
                  <p className="text-sm text-gray-400">
                    {searchQuery || statusFilter !== 'ALL' || periodFilter !== 'ALL'
                      ? labels.noEvaluationsFiltered
                      : labels.noEvaluationsHint}
                  </p>
                </div>
              ) : (
                <EvaluationCardsByClass
                  groups={groupsByClassId.get(selectedClassId) || []}
                  getAvailableActions={getAvailableActions}
                  onOpenEdit={handleOpenEdit}
                  isMaternelle={isMaternelle}
                  selectedKeys={selectedKeys}
                  onToggleSelect={toggleSelectGroup}
                  isEN={isEN}
                  labels={labels}
                />
              )}
              </div>
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
            {labels.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || form.classIds.length === 0 || !form.periodId || !form.startDate || !form.endDate || (editingId ? (form.subjectIds.length === 0 || !form.evaluationTypeId) : form.evaluationTypeIds.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (isEN ? 'Saving...' : 'Enregistrement...') : editingId ? (isEN ? 'Update' : 'Modifier') : (isEN ? 'Create' : 'Créer')}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/*
        ⭐ RÉORGANISATION 2026-11-17 — DEUX chemins dans le même modal :
        - CRÉATION (modal simplifié) : classes (multi) + trimestre + type(s)
          d'évaluation — les matières de CHAQUE classe sont associées
          automatiquement (Pédagogie > Matières & Programmes) ; dates/titre/
          barème en « options avancées » (défauts : aujourd'hui, auto) ;
        - ÉDITION d'une session existante : formulaire historique complet
          (type unique, matières cochables, dates, barème…).
        */}
        {!editingId ? (
          <div className="space-y-4">
            {/* Intro — ce que fait le système */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 leading-relaxed">
                {labels.createModalIntro}
              </p>
            </div>

            {/* 1. Classes (sélection multiple) */}
            <div>
              <Label>
                {labels.classes} <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({form.classIds.length} {isEN ? (form.classIds.length > 1 ? 'selected' : 'selected') : (form.classIds.length > 1 ? 'sélectionnées' : 'sélectionnée')})
                </span>
              </Label>
              <div className="mt-1 max-h-[180px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">
                    {labels.noClasses}
                  </p>
                ) : (
                  classes.map(c => {
                    const assignments = assignmentsForClass(c.id);
                    return (
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
                        <span className="text-sm text-gray-700">
                          {isEN ? translateClassName(c.name) : c.name}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-gray-400 whitespace-nowrap">
                          {c.studentCount ?? 0} {labels.studentsLabel} · {assignments.length} {labels.subjectsAssigned}
                        </span>
                      </label>
                    );
                  })
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

            {/* 2. Période (trimestre) — auto-sélectionnée sur le trimestre actif */}
            <div>
              <Label htmlFor="periodId">{labels.period} <span className="text-red-500">*</span></Label>
              <Select value={form.periodId} onValueChange={(v) => setForm({ ...form, periodId: v })}>
                <SelectTrigger id="periodId">
                  <SelectValue placeholder={labels.selectPlaceholder}>
                    {(() => {
                      const selectedPeriod = periods.find((p) => p.id === form.periodId);
                      if (selectedPeriod) {
                        const displayName = translatePeriodName(selectedPeriod.name, scopeLang as 'FR' | 'EN' | undefined);
                        return selectedPeriod.isClosed
                          ? `${displayName} (${labels.closed})`
                          : (selectedPeriod as any).isActive
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
                      const displayName = translatePeriodName(p.name, scopeLang as 'FR' | 'EN' | undefined);
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={p.isClosed}>
                          {displayName} {p.isClosed && `(${labels.closed})`} {(p as any).isActive && !p.isClosed && `(${labels.active})`}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Type(s) d'évaluation (sélection multiple) */}
            <div>
              <Label>
                {labels.evaluationTypesPlural} <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({form.evaluationTypeIds.length})
                </span>
              </Label>
              <p className="text-[10px] text-gray-500 mb-1">
                {isEN
                  ? 'Pick one or several — one assessment session per class and per type.'
                  : 'Cochez un ou plusieurs types — une session d\'évaluation sera créée par classe et par type.'}
              </p>
              <div className="mt-1 max-h-[140px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                {evaluationTypes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">
                    {labels.noTypes}
                  </p>
                ) : (
                  evaluationTypes.map(t => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-white cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={form.evaluationTypeIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({ ...form, evaluationTypeIds: [...form.evaluationTypeIds, t.id] });
                          } else {
                            setForm({ ...form, evaluationTypeIds: form.evaluationTypeIds.filter(id => id !== t.id) });
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {t.code ? `[${t.code}] ` : ''}{t.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <div className="mt-1 flex items-center gap-3">
                {evaluationTypes.length > 0 && form.evaluationTypeIds.length < evaluationTypes.length && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, evaluationTypeIds: evaluationTypes.map(t => t.id) })}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {labels.selectAll}
                  </button>
                )}
                {form.evaluationTypeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, evaluationTypeIds: [] })}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    {labels.deselectAll}
                  </button>
                )}
              </div>
            </div>

            {/* Aperçu — matières associées AUTOMATIQUEMENT par classe */}
            {form.classIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {isEN ? 'Subjects automatically associated per class' : 'Matières associées automatiquement par classe'}
                </p>
                {form.classIds.map((cid) => {
                  const cls = classes.find((c) => c.id === cid);
                  const assignments = assignmentsForClass(cid);
                  const displayName = cls ? (isEN ? translateClassName(cls.name) : cls.name) : cid;
                  const plannedCount = assignments.length * form.evaluationTypeIds.length;
                  return (
                    <div
                      key={cid}
                      className={`border rounded-lg p-2.5 bg-white ${assignments.length === 0 ? 'border-amber-300' : 'border-gray-200'}`}
                    >
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {displayName}
                        {assignments.length > 0 && (
                          <span className="ml-2 text-[10px] font-normal text-gray-400">
                            {assignments.length} {isEN ? (assignments.length > 1 ? 'subjects' : 'subject') : (assignments.length > 1 ? 'matières' : 'matière')}
                            {form.evaluationTypeIds.length > 0 &&
                              ` · ${plannedCount} ${labels.evaluationsCreated}`}
                          </span>
                        )}
                      </p>
                      {assignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {assignments.map((a) => (
                            <span
                              key={a.subjectId}
                              title={isEN ? 'Assigned in Pedagogy > Subjects & Programs' : 'Affectée dans Pédagogie > Matières & Programmes'}
                              className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
                            >
                              {a.subjectName || subjects.find((s) => s.id === a.subjectId)?.name || '—'}
                              {a.coefficient != null && !isMaternelle && !isEN && (
                                <span className="ml-1.5 text-[10px] font-bold text-blue-500">coef {a.coefficient}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">{labels.configureSubjectsFirst}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Options avancées (dates, titre, description, barème) */}
            <details className="border border-gray-200 rounded-lg bg-gray-50">
              <summary className="px-3 py-2.5 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                {labels.advancedOptions}
              </summary>
              <div className="p-3 pt-2 space-y-4">
                {/* Dates — défaut : aujourd'hui */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">{labels.startDate}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">{labels.endDate}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    />
                  </div>
                </div>
                {/* Titre (préfixe optionnel — auto-généré par type sinon) */}
                <div>
                  <Label htmlFor="title">
                    {labels.title} <span className="text-gray-400 font-normal">({isEN ? 'optional — auto-generated per type' : 'optionnel — auto-généré par type'})</span>
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={isEN ? 'Ex: First Term' : 'Ex: Trimestre 1'}
                  />
                </div>
                {/* Barème / coefficient — repli (les valeurs Pédagogie priment) */}
                {isMaternelle ? (
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                    <p className="text-xs text-pink-800">
                      {isEN
                        ? 'Qualitative assessment (TS / S / PS) — no scale, no coefficient.'
                        : 'Évaluation qualitative (TS / S / PS) — pas de barème ni de coefficient.'}
                    </p>
                  </div>
                ) : isEN ? (
                  <div>
                    <Label htmlFor="maxScore">{labels.maxScore}</Label>
                    <Input
                      id="maxScore"
                      type="number"
                      step="0.5"
                      value={form.maxScore}
                      onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">CA: out of 40 · Examination: out of 60</p>
                  </div>
                ) : (
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
                      <p className="text-xs text-gray-500 mt-1">
                        {isEN
                          ? 'Subject coefficients from Pedagogy are applied automatically — this is only a fallback.'
                          : 'Les coefficients définis par matière dans Pédagogie sont appliqués automatiquement — cette valeur ne sert que de repli.'}
                      </p>
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
                    placeholder={isEN ? 'Chapters covered, specific instructions...' : 'Chapitres abordés, consignes particulières...'}
                    rows={2}
                  />
                </div>
              </div>
            </details>
          </div>
        ) : (
        <>
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
                    {/* ⭐ 2026-10-01 — Pour la piste EN (Nursery/Primary), on traduit
                        le nom de la classe FR en nom EN (Maternelle 1 → Nursery 1).
                        Pour la piste FR, on garde le nom original. */}
                    <span className="text-sm text-gray-700">
                      {isEN ? translateClassName(c.name) : c.name}
                    </span>
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
          {/* ⭐ FIX 2026-11-17 : la liste suit la/les classe(s) sélectionnée(s) —
              matières affectées à la classe dans Pédagogie > Matières &
              Programmes, avec leurs coefficients. Sélectionner une classe
              charge automatiquement ses matières (toutes cochées). */}
          <div>
            <Label>
              {labels.subjects} <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">
                ({form.subjectIds.length} {isEN ? (form.subjectIds.length > 1 ? 'selected' : 'selected') : (form.subjectIds.length > 1 ? 'sélectionnées' : 'sélectionnée')})
              </span>
            </Label>
            <p className="text-[10px] text-gray-500 mb-1">
              {form.classIds.length === 0
                ? (isEN
                    ? 'Select a class first — its subjects (configured in Pedagogy) will load automatically.'
                    : 'Sélectionnez d\'abord une classe — ses matières (configurées dans Pédagogie) se chargeront automatiquement.')
                : modalSubjects.mode === 'class'
                  ? (isEN
                      ? `Subjects assigned to the selected class(es) in Pedagogy — all selected by default, uncheck to exclude.`
                      : 'Matières affectées à la classe sélectionnée dans Pédagogie — toutes cochées par défaut, décochez celles à exclure.')
                  : (isEN
                      ? 'The selected class(es) have no subjects assigned in Pedagogy (Matières & Programmes) — full level list shown as fallback.'
                      : 'Aucune matière affectée à la classe sélectionnée dans Pédagogie (Matières & Programmes) — liste complète du niveau en repli.')}
            </p>
            <div className="mt-1 max-h-[160px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
              {modalSubjects.list.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">
                  {labels.noSubjects}
                </p>
              ) : (
                modalSubjects.list.map(s => (
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
                    <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                    {/* ⭐ Coefficient de la matière pour cette classe
                        (défini dans Pédagogie > Matières & Programmes) —
                        il sera appliqué automatiquement à l'évaluation. */}
                    {s.coefficient !== undefined && s.coefficient !== null && !isMaternelle && !isEN && (
                      <span
                        title={isEN ? 'Coefficient from Pedagogy — applied automatically' : 'Coefficient défini dans Pédagogie — appliqué automatiquement'}
                        className="ml-auto shrink-0 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5"
                      >
                        coef {s.coefficient}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="mt-1 flex items-center gap-3">
              {modalSubjects.list.length > 0 && form.subjectIds.length < modalSubjects.list.length && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, subjectIds: modalSubjects.list.map(s => s.id) })}
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
              {/* ⭐ FIX 2026-11-17 : le coefficient de chaque matière (défini
                  dans Pédagogie > Matières & Programmes) est appliqué
                  automatiquement — cette valeur ne sert que de repli. */}
              <p className="text-xs text-gray-500 mt-1">
                Les coefficients définis par matière dans <strong>Pédagogie &gt; Matières &amp; Programmes</strong> sont appliqués automatiquement — cette valeur ne sert que de repli.
              </p>
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
            placeholder={isEN ? 'Chapters covered, specific instructions...' : 'Chapitres abordés, consignes particulières...'}
            rows={3}
          />
        </div>
        </>
        )}
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
          <Label>{isEN ? 'School Level' : 'Niveau scolaire'}</Label>
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Badge className="bg-blue-600 text-white">
              {activeLevel?.label || scopeLevel || '—'}
            </Badge>
            <span className="text-xs text-blue-700">
              {isEN ? 'The type will be created for this school level only.' : 'Le type sera créé pour ce niveau scolaire uniquement.'}
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
    {/* ─── Modal Modification Multiple ────────────────────────────────────── */}
    <FormModal
      title="Modification multiple"
      subtitle={`${selectedEvalCount} évaluation(s) sur ${selectedGroups.length} classe(s) — seuls les champs cochés seront appliqués partout`}
      isOpen={isBulkEditOpen}
      onClose={() => setIsBulkEditOpen(false)}
      size="lg"
      actions={
        <>
          <button
            onClick={() => setIsBulkEditOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleBulkEditSave}
            disabled={bulkSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {bulkSaving ? 'Application...' : `Appliquer à ${selectedEvalCount} évaluation(s)`}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <strong>Comment ça marche :</strong> cochez uniquement les informations que vous voulez
            appliquer à <strong>toutes</strong> les évaluations sélectionnées, puis cliquez sur
            « Appliquer ». Les classes et matières de chaque session restent inchangées, et les
            évaluations déjà validées / verrouillées sont ignorées automatiquement.
          </p>
        </div>

        {/* Type d'évaluation */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={bulkForm.applyType}
            onChange={(e) => setBulkForm({ ...bulkForm, applyType: e.target.checked })}
            className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            aria-label="Appliquer le type d'évaluation"
          />
          <div className="flex-1 min-w-0">
            <Label className="flex items-center gap-2">
              {labels.evaluationType}
              <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
            </Label>
            <div className={cn(!bulkForm.applyType && 'opacity-50 pointer-events-none')}>
              <Select
                value={bulkForm.evaluationTypeId}
                onValueChange={(v) => setBulkForm({ ...bulkForm, evaluationTypeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.selectPlaceholder}>
                    {(() => {
                      const t = evaluationTypes.find((x) => x.id === bulkForm.evaluationTypeId);
                      return t ? (t.code ? `[${t.code}] ${t.name}` : t.name) : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {evaluationTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code ? `[${t.code}] ${t.name}` : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Période */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={bulkForm.applyPeriod}
            onChange={(e) => setBulkForm({ ...bulkForm, applyPeriod: e.target.checked })}
            className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            aria-label="Appliquer la période"
          />
          <div className="flex-1 min-w-0">
            <Label className="flex items-center gap-2">
              {labels.period}
              <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
            </Label>
            <div className={cn(!bulkForm.applyPeriod && 'opacity-50 pointer-events-none')}>
              <Select
                value={bulkForm.periodId}
                onValueChange={(v) => setBulkForm({ ...bulkForm, periodId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.selectPlaceholder}>
                    {(() => {
                      const p = periods.find((x) => x.id === bulkForm.periodId);
                      return p ? translatePeriodName(p.name, scopeLang as 'FR' | 'EN' | undefined) : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.isClosed}>
                      {`${translatePeriodName(p.name, scopeLang as 'FR' | 'EN' | undefined)}${p.isClosed ? ` (${labels.closed})` : ''}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Intervalle de dates */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={bulkForm.applyDates}
            onChange={(e) => setBulkForm({ ...bulkForm, applyDates: e.target.checked })}
            className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            aria-label="Appliquer les dates"
          />
          <div className="flex-1 min-w-0">
            <Label className="flex items-center gap-2">
              {labels.startDate} → {labels.endDate}
              <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={bulkForm.startDate}
                onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })}
                disabled={!bulkForm.applyDates}
                className={!bulkForm.applyDates ? 'opacity-50' : ''}
              />
              <Input
                type="date"
                value={bulkForm.endDate}
                onChange={(e) => setBulkForm({ ...bulkForm, endDate: e.target.value })}
                disabled={!bulkForm.applyDates}
                className={!bulkForm.applyDates ? 'opacity-50' : ''}
              />
            </div>
          </div>
        </div>

        {/* Barème + coefficient (masqués pour la maternelle qualitative) */}
        {!isMaternelle && (
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={bulkForm.applyMaxScore}
                  onChange={(e) => setBulkForm({ ...bulkForm, applyMaxScore: e.target.checked })}
                  className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  aria-label="Appliquer le barème"
                />
                <div className="flex-1 min-w-0">
                  <Label className="flex items-center gap-2">
                    {labels.maxScore}
                    <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={bulkForm.maxScore}
                    onChange={(e) => setBulkForm({ ...bulkForm, maxScore: e.target.value })}
                    disabled={!bulkForm.applyMaxScore}
                    className={!bulkForm.applyMaxScore ? 'opacity-50' : ''}
                  />
                </div>
              </div>
              {!isEN && (
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={bulkForm.applyCoefficient}
                    onChange={(e) => setBulkForm({ ...bulkForm, applyCoefficient: e.target.checked })}
                    className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                    aria-label="Appliquer le coefficient"
                  />
                  <div className="flex-1 min-w-0">
                    <Label className="flex items-center gap-2">
                      {labels.coefficient}
                      <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={bulkForm.coefficient}
                      onChange={(e) => setBulkForm({ ...bulkForm, coefficient: e.target.value })}
                      disabled={!bulkForm.applyCoefficient}
                      className={!bulkForm.applyCoefficient ? 'opacity-50' : ''}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Titre */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={bulkForm.applyTitle}
            onChange={(e) => setBulkForm({ ...bulkForm, applyTitle: e.target.checked })}
            className="w-4 h-4 mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            aria-label="Appliquer le titre"
          />
          <div className="flex-1 min-w-0">
            <Label className="flex items-center gap-2">
              {labels.title}
              <span className="text-[10px] font-normal text-gray-400">(appliquer)</span>
            </Label>
            <Input
              value={bulkForm.title}
              onChange={(e) => setBulkForm({ ...bulkForm, title: e.target.value })}
              disabled={!bulkForm.applyTitle}
              placeholder="Ex : Évaluation mensuelle 1 - Trimestre 1"
              className={!bulkForm.applyTitle ? 'opacity-50' : ''}
            />
          </div>
        </div>
      </div>
    </FormModal>

    {confirmDialog}
    </>
  );
}
