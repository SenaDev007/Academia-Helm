'use client';

/**
 * ============================================================================
 * PORTAIL PARENT — Travaux & Suivi
 * ============================================================================
 *
 * Vue parent (read-only) des devoirs, leçons, récitations, exposés et
 * activités pratiques données aux enfants du parent connecté.
 *
 * Sous-onglets miroir du workspace enseignant, mais sans CRUD :
 *   1. Tous                          → tous les taskTypes confondus
 *   2. Devoirs & Exercices           → taskType=HOMEWORK
 *   3. Recherches & Exposés          → taskType=RESEARCH
 *   4. Leçons & Récitations          → taskType=LESSON + RECITATION (2 fetchs //)
 *   5. Activités pratiques           → taskType=PRACTICAL + PROJECT (2 fetchs //)
 *
 * Backend endpoint :
 *   GET /api/parent/homeworks/:studentId?academicYearId=Y&taskType=T
 *
 * Conventions :
 *   - Bordures rounded-xl, bg-emerald-50/30, icônes emerald (layout parent)
 *   - Pas de framer-motion, pas de FormModal blueprint
 *   - Fetch direct avec credentials: "include"
 *   - toast (sonner) pour les erreurs
 *   - Loader2 + animate-spin pour les états de chargement
 * ============================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ClipboardList, Search, BookOpen, Palette, Users, NotebookPen,
  Clock, AlertTriangle, RotateCcw, XCircle, CheckCircle,
  Mic, Presentation, Loader2, Download, Bell, RefreshCw,
  FileText, Calendar, GraduationCap, Inbox,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useParentChildren } from '@/lib/query/parent-hooks';
import StudentAvatar from '@/components/parent/StudentAvatar';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTES
// ============================================================================

type TaskType =
  | 'HOMEWORK'
  | 'RESEARCH'
  | 'LESSON'
  | 'RECITATION'
  | 'PRACTICAL'
  | 'PROJECT';

interface TabDef {
  id: string;
  label: string;
  icon: typeof ClipboardList;
  /** null = tous les types ; sinon liste des taskTypes à récupérer */
  taskTypes: TaskType[] | null;
}

const TABS: TabDef[] = [
  { id: 'all',       label: 'Tous',                    icon: ClipboardList, taskTypes: null },
  { id: 'homework',  label: 'Devoirs & Exercices',     icon: ClipboardList, taskTypes: ['HOMEWORK'] },
  { id: 'research',  label: 'Recherches & Exposés',     icon: Search,        taskTypes: ['RESEARCH'] },
  { id: 'notebooks', label: 'Cahiers & Copies',        icon: NotebookPen,   taskTypes: ['LESSON'] },
  { id: 'lessons',   label: 'Récitations',              icon: BookOpen,      taskTypes: ['RECITATION'] },
  { id: 'practical', label: 'Activités pratiques',     icon: Palette,       taskTypes: ['PRACTICAL', 'PROJECT'] },
];

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  HOMEWORK:   'Devoir',
  RESEARCH:   'Recherche / Exposé',
  LESSON:     'Leçon',
  RECITATION: 'Récitation',
  PRACTICAL:  'Activité pratique',
  PROJECT:    'Projet',
};

const TASK_TYPE_BADGE: Record<TaskType, string> = {
  HOMEWORK:   'bg-emerald-100 text-emerald-700',
  RESEARCH:   'bg-amber-100 text-amber-700',
  LESSON:     'bg-teal-100 text-teal-700',
  RECITATION: 'bg-cyan-100 text-cyan-700',
  PRACTICAL:  'bg-rose-100 text-rose-700',
  PROJECT:    'bg-violet-100 text-violet-700',
};

interface StatusCfg {
  label: string;
  color: string;
  icon: typeof Clock;
}

const STATUS_CONFIG: Record<string, StatusCfg> = {
  PENDING:        { label: 'En attente',           color: 'bg-slate-100 text-slate-700',  icon: Clock },
  DONE:           { label: 'Fait',                 color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  NOT_DONE:       { label: 'Non fait',             color: 'bg-rose-100 text-rose-700',    icon: XCircle },
  INCOMPLETE:     { label: 'Incomplet',            color: 'bg-amber-100 text-amber-700',  icon: AlertTriangle },
  LATE:           { label: 'En retard',            color: 'bg-orange-100 text-orange-700', icon: Clock },
  TO_REDO:        { label: 'À refaire',            color: 'bg-rose-100 text-rose-700',    icon: RotateCcw },
  RECITED:        { label: 'Récitation réussie',    color: 'bg-emerald-100 text-emerald-700', icon: Mic },
  NOT_RECITED:    { label: 'Récitation échouée',   color: 'bg-rose-100 text-rose-700',    icon: XCircle },
  PRESENTED:      { label: 'Exposé présenté',      color: 'bg-emerald-100 text-emerald-700', icon: Presentation },
  NOT_PRESENTED:  { label: 'Exposé non présenté',  color: 'bg-rose-100 text-rose-700',    icon: Presentation },
};

interface StatusFilter {
  id: string;
  label: string;
  statuses: string[] | null;
}

const STATUS_FILTERS: StatusFilter[] = [
  { id: 'all',     label: 'Tous',     statuses: null },
  { id: 'pending', label: 'À faire', statuses: ['PENDING', 'INCOMPLETE', 'TO_REDO'] },
  { id: 'done',    label: 'Faits',    statuses: ['DONE', 'RECITED', 'PRESENTED'] },
  { id: 'late',    label: 'En retard', statuses: ['LATE', 'NOT_DONE', 'NOT_RECITED', 'NOT_PRESENTED'] },
];

const SORT_OPTIONS = [
  { id: 'dueDate', label: "Date d'échéance" },
  { id: 'subject', label: 'Matière' },
  { id: 'status',  label: 'Statut' },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

/** Format dd/MM/yyyy pour l'affichage FR */
function formatDateFR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Format dd/MM/yyyy HH:mm pour les timestamps d'évaluation */
function formatDateTimeFR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Les champs `attachments` et `observations` peuvent arriver en JSON ou en array. */
function parseAttachments(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseText(raw: any): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((r) =>
        typeof r === 'string'
          ? r
          : (r?.text || r?.content || r?.message || (typeof r === 'object' ? JSON.stringify(r) : String(r))),
      )
      .filter(Boolean)
      .join('\n');
  }
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw);
    } catch {
      return '';
    }
  }
  return String(raw);
}

/** Wrapper fetch : inclut credentials, lève une erreur si !res.ok */
async function apiFetch<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  let payload: any = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    const msg =
      (payload && (payload.message || payload.error)) ||
      (typeof payload === 'string' ? payload.slice(0, 200) : '') ||
      `Erreur HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return payload as T;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function ParentTasksView() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const {
    data: children = [],
    isLoading: loadingChildren,
    error: childrenError,
  } = useParentChildren(academicYear?.id);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('dueDate');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // === Auto-sélection du premier enfant ===
  useEffect(() => {
    if (children.length === 0) {
      if (selectedChildId) setSelectedChildId('');
      return;
    }
    // Si un seul enfant ou rien n'est sélectionné, on force le 1er.
    if (!selectedChildId || !children.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // === Chargement des tâches pour l'enfant + l'onglet actif ===
  const load = useCallback(async () => {
    if (!selectedChildId || !academicYear?.id) {
      setTasks([]);
      return;
    }
    setLoading(true);
    try {
      const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
      const types = tab.taskTypes;
      const ayId = encodeURIComponent(academicYear.id);
      const base = `/api/parent/homeworks/${encodeURIComponent(selectedChildId)}?academicYearId=${ayId}`;

      let results: any[];

      if (!types) {
        // Onglet "Tous" — pas de filtre taskType
        const data = await apiFetch<any[]>(base);
        results = Array.isArray(data) ? data : [];
      } else if (types.length === 1) {
        const data = await apiFetch<any[]>(`${base}&taskType=${types[0]}`);
        results = Array.isArray(data) ? data : [];
      } else {
        // Plusieurs types → fetchs parallèles puis merge (LESSON+RECITATION ou PRACTICAL+PROJECT)
        const responses = await Promise.all(
          types.map((t) =>
            apiFetch<any[]>(`${base}&taskType=${t}`).catch((err: any) => {
              console.warn(`load failed for taskType=${t}`, err);
              return [] as any[];
            }),
          ),
        );
        results = responses.flat();
      }

      setTasks(results);
    } catch (e: any) {
      toast.error('Erreur lors du chargement des travaux', {
        description: e?.message || 'Réessayez dans un instant.',
      });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedChildId, academicYear?.id, activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  // === Filtre + tri ===
  const visibleTasks = useMemo(() => {
    const filter = STATUS_FILTERS.find((f) => f.id === statusFilter);
    let arr = tasks;
    if (filter?.statuses) {
      arr = arr.filter((t) => {
        const st = t.taskStatus?.status || t.hwStatus || 'PENDING';
        return filter.statuses!.includes(st);
      });
    }
    arr = [...arr].sort((a, b) => {
      if (sortBy === 'dueDate') {
        const da = new Date(a.dueDate || 0).getTime();
        const db = new Date(b.dueDate || 0).getTime();
        return da - db;
      }
      if (sortBy === 'subject') {
        return (a.subjectName || '').localeCompare(b.subjectName || '');
      }
      if (sortBy === 'status') {
        const sa = a.taskStatus?.status || a.hwStatus || '';
        const sb = b.taskStatus?.status || b.hwStatus || '';
        return sa.localeCompare(sb);
      }
      return 0;
    });
    return arr;
  }, [tasks, statusFilter, sortBy]);

  // === Notifications : compteur de tâches en attente ou en retard ===
  const notificationsCount = useMemo(() => {
    return tasks.filter((t) => {
      const st = t.taskStatus?.status || t.hwStatus || 'PENDING';
      return st === 'PENDING' || st === 'LATE';
    }).length;
  }, [tasks]);

  // === États d'attente / erreur enfants ===
  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-emerald-600" />
        Chargement de vos enfants…
      </div>
    );
  }

  if (childrenError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-rose-700">
          Impossible de charger vos enfants
        </p>
        <p className="text-xs text-rose-500 mt-1">
          {(childrenError as Error).message}
        </p>
        <p className="text-[11px] text-rose-400 mt-2">
          Si le problème persiste, rafraîchissez la page ou reconnectez-vous.
        </p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
          <Users className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="font-semibold text-slate-700">
          Vous n'avez pas d'enfant inscrit
        </p>
        <p className="text-sm text-slate-400 mt-1 max-w-md">
          Contactez l'administration de l'école pour lier vos enfants à votre compte parent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* === En-tête + cloche notifications === */}
      <header className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              Travaux &amp; Suivi de mes enfants
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Devoirs, leçons, récitations, exposés et activités pratiques
              {academicYear?.label ? ` · ${academicYear.label}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => load()}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
            title="Rafraîchir"
            aria-label="Rafraîchir la liste"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <div className="relative" title="Tâches en attente ou en retard">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Bell className="h-5 w-5 text-emerald-700" />
            </div>
            {notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {notificationsCount > 99 ? '99+' : notificationsCount}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* === Sélecteur d'enfant (s'il y en a plusieurs) === */}
      {children.length > 1 && (
        <section
          className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4"
          aria-label="Sélection de l'enfant"
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Sélectionnez un enfant
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((c: any) => {
              const isSel = selectedChildId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChildId(c.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                    isSel
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20',
                  )}
                >
                  <StudentAvatar
                    firstName={c.firstName}
                    lastName={c.lastName}
                    photoUrl={c.photoUrl}
                    size="sm"
                    variant="emerald"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {c.className || 'Classe non assignée'}
                      {c.matricule ? ` · ${c.matricule}` : ''}
                    </p>
                  </div>
                  {isSel && (
                    <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* === Sous-onglets miroir du teacher === */}
      <nav
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        aria-label="Catégories de travaux"
      >
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap border-b-2',
                  isActive
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                    : 'border-transparent text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/20',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* === Barre de filtres + tri === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-emerald-50/30 rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                statusFilter === f.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Trier par
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* === Liste des tâches === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin mr-2 text-emerald-600" />
          Chargement des travaux…
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TaskCard — Carte d'une tâche (read-only)
// ============================================================================

interface TaskCardProps {
  task: any;
}

function TaskCard({ task }: TaskCardProps) {
  const attachments = parseAttachments(task.attachments);
  const observationsText = parseText(task.observations);
  const status: string = task.taskStatus?.status || task.hwStatus || 'PENDING';
  const statusCfg: StatusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;

  const taskType: TaskType = (task.taskType as TaskType) || 'HOMEWORK';
  const taskTypeBadge = TASK_TYPE_BADGE[taskType] || 'bg-slate-100 text-slate-700';
  const taskTypeLabel = TASK_TYPE_LABELS[taskType] || taskType;

  const ts = task.taskStatus || {};
  const score = ts.score;
  const maxScore = task.maxScore;
  const appreciation = ts.appreciation;
  const observation = ts.observation;
  const evaluatedAt = ts.evaluatedAt;
  const presentationDate = task.presentationDate;
  const hasEvaluation = !!(evaluatedAt || appreciation || observation || (score != null && maxScore != null));

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* === En-tête === */}
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
              taskTypeBadge,
            )}
          >
            {taskTypeLabel}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
              statusCfg.color,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>
        </div>
        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
          {task.title || 'Sans titre'}
        </h3>
        {(task.subjectName || task.className) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
            {task.subjectName && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold text-slate-700">{task.subjectName}</span>
                {task.subjectCode && (
                  <span className="text-slate-400">· {task.subjectCode}</span>
                )}
              </span>
            )}
            {task.className && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold text-slate-700">{task.className}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* === Corps === */}
      <div className="p-4 sm:p-5 space-y-3 flex-1">
        {/* Dates d'échéance / présentation */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold">Échéance :</span>
            <span className="text-slate-800">
              {formatDateFR(task.dueDate) || '—'}
            </span>
          </div>
          {presentationDate && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Presentation className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-semibold">Présentation :</span>
              <span className="text-slate-800">{formatDateFR(presentationDate)}</span>
            </div>
          )}
        </div>

        {/* Description / consigne / contenu de la leçon */}
        {task.description && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {task.taskType === 'LESSON' ? 'Leçon / Retenons' : 'Consigne'}
            </p>
            {task.taskType === 'LESSON' ? (
              <div
                className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none
                  prose-headings:text-slate-800 prose-strong:text-slate-800
                  prose-em:text-slate-600 prose-ul:list-disc prose-ol:list-decimal"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            )}
          </div>
        )}

        {/* Observations générales de l'enseignant sur le devoir */}
        {observationsText && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Observations de l'enseignant
            </p>
            <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
              {observationsText}
            </p>
          </div>
        )}

        {/* Pièces jointes */}
        {attachments.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Pièces jointes
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, idx) => {
                const url =
                  typeof att === 'string'
                    ? att
                    : att?.url || att?.path || att?.link || att?.downloadUrl;
                const name =
                  typeof att === 'string'
                    ? att.split('/').pop() || att
                    : att?.name || att?.fileName || att?.originalName ||
                      (url ? url.split('/').pop() : `Pièce ${idx + 1}`);
                if (!url) return null;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-xs font-semibold text-slate-700 transition-colors max-w-full"
                  >
                    <Download className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="max-w-[180px] truncate">{name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Évaluation de l'enfant (taskStatus) */}
        {hasEvaluation && (
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg space-y-1.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {task.taskType === 'LESSON' ? 'Contrôle du cahier' : 'Évaluation'}
            </p>

            {/* ⭐ Pour les LESSON : afficher "Cahier propre" + "Leçon copiée" en badges */}
            {task.taskType === 'LESSON' && status !== 'PENDING' && (
              <div className="flex flex-wrap gap-2">
                {/* Cahier propre = dérivé du statut */}
                {status !== 'TO_REDO' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Cahier propre
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    <XCircle className="h-3 w-3" /> Cahier à refaire
                  </span>
                )}
                {/* Leçon copiée = dérivé du statut */}
                {status === 'DONE' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Leçon copiée
                  </span>
                )}
                {status === 'INCOMPLETE' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    <Clock className="h-3 w-3" /> Copie partielle
                  </span>
                )}
                {status === 'NOT_DONE' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    <XCircle className="h-3 w-3" /> Leçon non copiée
                  </span>
                )}
                {status === 'TO_REDO' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    <XCircle className="h-3 w-3" /> À refaire
                  </span>
                )}
              </div>
            )}

            {/* ⭐ Pour les RECITATION : afficher "Récitation réussie/échouée" */}
            {task.taskType === 'RECITATION' && status !== 'PENDING' && (
              <div className="flex flex-wrap gap-2">
                {status === 'RECITED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3" /> Récitation réussie
                  </span>
                )}
                {status === 'NOT_RECITED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    <XCircle className="h-3 w-3" /> Récitation échouée
                  </span>
                )}
              </div>
            )}

            {score != null && maxScore != null && (
              <p className="text-sm font-bold text-emerald-800">
                Note : {score}/{maxScore}
              </p>
            )}
            {appreciation && (
              <p className="text-xs text-emerald-900">
                <span className="font-semibold">Appréciation :</span> {appreciation}
              </p>
            )}
            {observation && (
              <p className="text-xs text-emerald-900">
                <span className="font-semibold">Observation :</span> {observation}
              </p>
            )}
            {evaluatedAt && (
              <p className="text-[10px] text-emerald-600">
                Évalué le {formatDateTimeFR(evaluatedAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ============================================================================
// EmptyState — Aucune tâche à afficher
// ============================================================================

function EmptyState({ activeTab }: { activeTab: string }) {
  const isAll = activeTab === 'all';
  const tab = TABS.find((t) => t.id === activeTab);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center text-center gap-2">
      <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-1">
        <Inbox className="h-6 w-6 text-emerald-600" />
      </div>
      <p className="font-semibold text-slate-700">
        {isAll
          ? 'Aucun devoir/exercice pour cette période'
          : `Aucune tâche de ce type (${(tab?.label || 'ce type').toLowerCase()})`}
      </p>
      <p className="text-sm text-slate-400 max-w-md">
        {isAll
          ? "Les prochains travaux donnés par les enseignants apparaîtront ici automatiquement."
          : "Aucune activité de cette catégorie n'a été programmée pour le moment."}
      </p>
    </div>
  );
}
