'use client';

/**
 * ============================================================================
 * TRAVAUX & SUIVI PÉDAGOGIQUE — Workspace enseignant
 * ============================================================================
 *
 * 10 sous-onglets alignés sur le design des autres onglets pédagogiques
 * (rounded-xl, fetch direct avec credentials: "include", toast sonner,
 * Loader2 animate-spin, pas de framer-motion, pas de FormModal blueprint).
 *
 * Backend endpoints utilisés (controller pedagogical-space) :
 *   GET    /api/pedagogy-space/homeworks?teacherId&academicYearId&classId?&taskType?
 *   POST   /api/pedagogy-space/homeworks
 *   PUT    /api/pedagogy-space/homeworks/:id
 *   DELETE /api/pedagogy-space/homeworks/:id
 *   GET    /api/pedagogy-space/homeworks/:id/students
 *   PUT    /api/pedagogy-space/task-students/:id   (status, score, appreciation, observation)
 *   GET    /api/pedagogy-space/student-engagement?teacherId&academicYearId&classId?
 *   GET    /api/pedagogy-space/activity-stats?teacherId&academicYearId
 *   GET    /api/pedagogy-space/homeworks/:id/submissions
 *   POST   /api/pedagogy-space/homeworks/:id/submissions
 *   GET    /api/pedagogy-space/notebook-checks?teacherId&academicYearId&classId?
 *   GET    /api/pedagogy-space/my-classes?teacherId&academicYearId
 *   GET    /api/pedagogy/global-library
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  LayoutDashboard, ClipboardList, Search, BookOpen, NotebookPen,
  Palette, Users, CheckCircle2, Library, BarChart3,
  Plus, Edit, Trash2, Eye, Clock, AlertTriangle, RotateCcw,
  XCircle, CheckCircle, Mic, Presentation, RefreshCw, Loader2,
  ChevronRight, FileText, Download,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

import { LessonsTrackingTab } from './LessonsTrackingTab';
import { NotebooksChecksTab } from './NotebooksChecksTab';
import { StudentEngagementTab } from './StudentEngagementTab';
import { CorrectionsFeedbackTab } from './CorrectionsFeedbackTab';
import { ActivityStatsTab } from './ActivityStatsTab';

// ============================================================================
// CONSTANTES
// ============================================================================

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'homework', label: 'Devoirs & Exercices', icon: ClipboardList },
  { id: 'research', label: 'Recherches & Exposés', icon: Search },
  { id: 'notebooks', label: 'Cahiers & Copies', icon: NotebookPen },
  { id: 'lessons', label: 'Leçons & Récitations', icon: BookOpen },
  { id: 'practical', label: 'Activités pratiques', icon: Palette },
  { id: 'student-followup', label: 'Suivi par élève', icon: Users },
  { id: 'feedback', label: 'Corrections & Retours', icon: CheckCircle2 },
  { id: 'activity-library', label: "Bibliothèque d'activités", icon: Library },
  { id: 'stats', label: 'Statistiques & Alertes', icon: BarChart3 },
] as const;

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'En attente', color: 'bg-slate-100 text-slate-700', icon: Clock },
  DONE: { label: 'Fait', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  NOT_DONE: { label: 'Non fait', color: 'bg-rose-100 text-rose-700', icon: XCircle },
  INCOMPLETE: { label: 'Incomplet', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  LATE: { label: 'En retard', color: 'bg-orange-100 text-orange-700', icon: Clock },
  TO_REDO: { label: 'À refaire', color: 'bg-purple-100 text-purple-700', icon: RotateCcw },
  RECITED: { label: 'Récitée', color: 'bg-emerald-100 text-emerald-700', icon: Mic },
  NOT_RECITED: { label: 'Non récitée', color: 'bg-rose-100 text-rose-700', icon: XCircle },
  PRESENTED: { label: 'Présenté', color: 'bg-emerald-100 text-emerald-700', icon: Presentation },
  NOT_PRESENTED: { label: 'Non présenté', color: 'bg-rose-100 text-rose-700', icon: Presentation },
};

export const TASK_TYPES: Record<string, string> = {
  HOMEWORK: 'Devoir / Exercice',
  RESEARCH: 'Recherche / Exposé',
  LESSON: 'Leçon à recopier',
  RECITATION: 'Récitation',
  PRACTICAL: 'Activité pratique',
  PROJECT: 'Projet',
};

// Statuts pertinents par taskType (pour les menus déroulants de statut élève)
export const STATUS_BY_TASK_TYPE: Record<string, string[]> = {
  HOMEWORK: ['PENDING', 'DONE', 'NOT_DONE', 'INCOMPLETE', 'LATE', 'TO_REDO'],
  RESEARCH: ['PENDING', 'PRESENTED', 'NOT_PRESENTED', 'LATE', 'TO_REDO'],
  LESSON: ['PENDING', 'DONE', 'NOT_DONE', 'INCOMPLETE', 'TO_REDO'],
  RECITATION: ['PENDING', 'RECITED', 'NOT_RECITED', 'LATE', 'TO_REDO'],
  PRACTICAL: ['PENDING', 'DONE', 'NOT_DONE', 'LATE', 'TO_REDO'],
  PROJECT: ['PENDING', 'PRESENTED', 'NOT_PRESENTED', 'LATE', 'TO_REDO'],
};

// ============================================================================
// HELPERS
// ============================================================================

/** Format YYYY-MM-DD pour les inputs <input type="date"> */
export function formatDateInput(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format dd/MM/yyyy pour l'affichage */
export function formatDateFR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Wrapper fetch : inclut credentials, lève une erreur si !res.ok */
export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options });
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

export default function TeacherTasksWorkspace() {
  const { user } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const confirmDialog = useConfirmDialog();

  const teacherId = user?.id || '';
  const academicYearId = academicYear?.id || '';
  const schoolLevelId = schoolLevel?.schoolLevelId || schoolLevel?.id || '';

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [classes, setClasses] = useState<any[]>([]);
  // Signal de rafraîchissement — incrémenté après chaque opération CRUD réussie
  // pour forcer les sous-onglets (reçevant `key={refreshSignal}`) à se remonter
  // et recharger leurs données depuis le backend.
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Modal de création/édition de devoir (commun à homework/research/practical/lessons)
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    taskType: string;
    homework?: any | null;
  }>({ open: false, mode: 'create', taskType: 'HOMEWORK', homework: null });

  // === Chargement initial : classes assignées à l'enseignant ===
  const loadClasses = useCallback(async () => {
    if (!teacherId || !academicYearId) {
      setClasses([]);
      return;
    }
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/my-classes?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
      );
      setClasses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('loadClasses error:', e);
      setClasses([]);
    }
  }, [teacherId, academicYearId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // === Ouvrir le modal de création/édition ===
  const openCreate = (taskType: string) => {
    setModalState({ open: true, mode: 'create', taskType, homework: null });
  };
  const openEdit = (hw: any) => {
    setModalState({
      open: true,
      mode: 'edit',
      taskType: hw.taskType || 'HOMEWORK',
      homework: hw,
    });
  };
  const closeModal = () =>
    setModalState((s) => ({ ...s, open: false, homework: null }));

  // === Pas d'année académique sélectionnée ===
  if (!academicYearId) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement de l'année académique…
      </div>
    );
  }

  // === Pas d'enseignant ===
  if (!teacherId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-12 w-12 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">Aucun profil enseignant trouvé</p>
        <p className="text-sm text-slate-400 mt-1">
          Votre compte n'est pas lié à un profil enseignant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* === En-tête + navigation par sous-onglets === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-700" />
              Travaux & Suivi Pédagogique
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Devoirs, exposés, leçons, suivi des élèves et corrections
            </p>
          </div>
          {(activeTab === 'homework' ||
            activeTab === 'research' ||
            activeTab === 'practical') && (
            <button
              onClick={() =>
                openCreate(
                  activeTab === 'homework'
                    ? 'HOMEWORK'
                    : activeTab === 'research'
                    ? 'RESEARCH'
                    : 'PRACTICAL',
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle activité
            </button>
          )}
        </div>

        {/* Tab Bar */}
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
                    ? 'border-slate-900 text-slate-900 bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* === Contenu du sous-onglet actif === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 min-h-[400px]">
        {activeTab === 'dashboard' && (
          <TasksDashboard
            key={`dashboard-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
            onSwitchTab={setActiveTab}
          />
        )}
        {activeTab === 'homework' && (
          <HomeworkManager
            key={`homework-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
            taskType="HOMEWORK"
            onEdit={openEdit}
            onCreate={() => openCreate('HOMEWORK')}
          />
        )}
        {activeTab === 'research' && (
          <HomeworkManager
            key={`research-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
            taskType="RESEARCH"
            onEdit={openEdit}
            onCreate={() => openCreate('RESEARCH')}
          />
        )}
        {activeTab === 'practical' && (
          <HomeworkManager
            key={`practical-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
            taskType="PRACTICAL"
            onEdit={openEdit}
            onCreate={() => openCreate('PRACTICAL')}
          />
        )}
        {activeTab === 'lessons' && (
          <LessonsTrackingTab
            key={`lessons-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
          />
        )}
        {activeTab === 'notebooks' && (
          <NotebooksChecksTab
            key={`notebooks-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
          />
        )}
        {activeTab === 'student-followup' && (
          <StudentEngagementTab
            key={`sf-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            classes={classes}
          />
        )}
        {activeTab === 'feedback' && (
          <CorrectionsFeedbackTab
            key={`feedback-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
            schoolLevelId={schoolLevelId}
            classes={classes}
          />
        )}
        {activeTab === 'activity-library' && (
          <ActivityLibraryTab key={`library-${refreshSignal}`} />
        )}
        {activeTab === 'stats' && (
          <ActivityStatsTab
            key={`stats-${refreshSignal}`}
            teacherId={teacherId}
            academicYearId={academicYearId}
          />
        )}
      </div>

      {/* === Modal de création/édition de devoir (inline — PAS FormModal blueprint) === */}
      {modalState.open && (
        <HomeworkFormModal
          mode={modalState.mode}
          taskType={modalState.taskType}
          homework={modalState.homework}
          classes={classes}
          teacherId={teacherId}
          academicYearId={academicYearId}
          schoolLevelId={schoolLevelId}
          onClose={closeModal}
          onSaved={() => {
            setRefreshSignal((s) => s + 1);
            closeModal();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL DE CRÉATION/ÉDITION DE DEVOIR (inline)
// ============================================================================

interface HomeworkFormModalProps {
  mode: 'create' | 'edit';
  taskType: string;
  homework?: any | null;
  classes: any[];
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  onClose: () => void;
  onSaved: () => void;
}

function HomeworkFormModal({
  mode,
  taskType,
  homework,
  classes,
  teacherId,
  academicYearId,
  schoolLevelId,
  onClose,
  onSaved,
}: HomeworkFormModalProps) {
  // Champs du formulaire
  const [title, setTitle] = useState(homework?.title || '');
  const [description, setDescription] = useState(homework?.description || '');
  const [classId, setClassId] = useState(homework?.classId || '');
  const [subjectId, setSubjectId] = useState(homework?.subjectId || '');
  const [dueDate, setDueDate] = useState(formatDateInput(homework?.dueDate));
  const [maxScore, setMaxScore] = useState(
    homework?.maxScore ? String(homework.maxScore) : '',
  );
  const [selectedTaskType, setSelectedTaskType] = useState(
    homework?.taskType || taskType || 'HOMEWORK',
  );
  const [presentationDate, setPresentationDate] = useState(
    formatDateInput(homework?.presentationDate),
  );
  const [observations, setObservations] = useState(homework?.observations || '');
  const [saving, setSaving] = useState(false);

  // ⭐ Sujets disponibles pour la classe sélectionnée
  //    On utilise D'ABORD les subjects inclus dans `classes` (via getMyClasses).
  //    Si la liste est vide, on fetch depuis l'API subjects/available (fallback).
  const selectedClass = useMemo(
    () => classes.find((c) => c.classId === classId),
    [classes, classId],
  );
  const [fetchedSubjects, setFetchedSubjects] = useState<any[]>([]);
  const availableSubjects = selectedClass?.subjects?.length > 0
    ? selectedClass.subjects
    : fetchedSubjects;

  // ⭐ Fallback : fetch les matières de la classe si classes[].subjects est vide
  useEffect(() => {
    if (!classId || !academicYearId) {
      setFetchedSubjects([]);
      return;
    }
    (async () => {
      try {
        const params = new URLSearchParams({ academicYearId, classId, teacherId });
        const data = await apiFetch<any[]>(
          `/api/pedagogy-space/subjects/available?${params.toString()}`,
        );
        setFetchedSubjects(Array.isArray(data) ? data : []);
      } catch {
        // Silencieux — les subjects sont optionnels
        setFetchedSubjects([]);
      }
    })();
  }, [classId, academicYearId, teacherId]);

  // Reset subjectId if classId changes & subject not in new list
  useEffect(() => {
    if (subjectId && availableSubjects.length > 0) {
      const exists = availableSubjects.some((s: any) =>
        s.subjectId === subjectId || s.id === subjectId,
      );
      if (!exists) setSubjectId('');
    }
  }, [availableSubjects, subjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !classId || !dueDate) {
      toast.error('Veuillez remplir tous les champs obligatoires (titre, classe, date).');
      return;
    }
    if (!academicYearId || !schoolLevelId || !teacherId) {
      toast.error("Contexte manquant (année académique, niveau scolaire ou enseignant).");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        classId,
        subjectId: subjectId || undefined,
        dueDate: new Date(dueDate).toISOString(),
        maxScore: maxScore ? parseFloat(maxScore) : undefined,
        taskType: selectedTaskType,
        presentationDate: presentationDate
          ? new Date(presentationDate).toISOString()
          : undefined,
        observations: observations.trim() || undefined,
        academicYearId,
        schoolLevelId,
        teacherId,
      };

      if (mode === 'create') {
        await apiFetch('/api/pedagogy-space/homeworks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Activité créée avec succès.');
      } else {
        const updateBody: any = {
          title: body.title,
          description: body.description,
          classId: body.classId,
          subjectId: body.subjectId || null,
          dueDate: body.dueDate,
          maxScore: body.maxScore ?? null,
          taskType: body.taskType,
          presentationDate: body.presentationDate || null,
          observations: body.observations || null,
        };
        await apiFetch(`/api/pedagogy-space/homeworks/${homework.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        });
        toast.success('Activité mise à jour avec succès.');
      }
      // Indiquer au parent que la sauvegarde a réussi — il incrémente
      // refreshSignal ce qui force les sous-onglets à se remonter et à
      // recharger leurs données.
      onSaved();
    } catch (e: any) {
      toast.error('Erreur lors de la sauvegarde', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Task types disponibles selon le sous-onglet (mais on laisse l'utilisateur
  // modifier car les sous-onglets lessons/feedback utilisent aussi ce modal)
  const taskTypeOptions = Object.entries(TASK_TYPES).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {mode === 'create'
              ? `Nouvelle activité — ${TASK_TYPES[selectedTaskType] || 'Activité'}`
              : "Modifier l'activité"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            type="button"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body — form scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {/* Type de tâche */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Type d'activité
            </label>
            <select
              value={selectedTaskType}
              onChange={(e) => setSelectedTaskType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            >
              {taskTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Titre <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Calcul des fractions — exercices 4 et 5"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Consigne / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ex: Faire les exercices 4 et 5 page 42 du manuel."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium resize-y"
            />
          </div>

          {/* Classe + Matière (côte à côte) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Classe <span className="text-rose-500">*</span>
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                required
              >
                <option value="">— Sélectionner —</option>
                {classes.map((c: any) => (
                  <option key={c.classId} value={c.classId}>
                    {c.className || c.classId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Matière {availableSubjects.length === 0 && '(selon la classe)'}
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                disabled={availableSubjects.length === 0}
              >
                <option value="">— Aucune (générale) —</option>
                {availableSubjects.map((s: any) => {
                  const sid = s.subjectId || s.id;
                  const sname = s.subjectName || s.name || s.subjectCode || s.code;
                  return (
                    <option key={sid} value={sid}>
                      {sname}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Date d'échéance + Note max */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Date d'échéance <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Note maximale (optionnel)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="Ex: 20"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              />
            </div>
          </div>

          {/* Date de présentation (pour exposés, récitations, activités) */}
          {['RESEARCH', 'RECITATION', 'PRACTICAL', 'PROJECT'].includes(
            selectedTaskType,
          ) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Date de présentation (optionnel)
              </label>
              <input
                type="date"
                value={presentationDate}
                onChange={(e) => setPresentationDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              />
            </div>
          )}

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Observations pédagogiques (optionnel)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Ex: Prévoir le matériel pour l'expérience…"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium resize-y"
            />
          </div>
        </form>

        {/* Footer — actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            type="button"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            type="button"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TÂCHES DASHBOARD — 4 cartes stats RÉELLES + échéances + alertes
// ============================================================================

interface TasksDashboardProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  onSwitchTab: (tab: string) => void;
}

function TasksDashboard({
  teacherId,
  academicYearId,
  classes,
  onSwitchTab,
}: TasksDashboardProps) {
  const [stats, setStats] = useState<any | null>(null);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [statsData, hwData] = await Promise.all([
          apiFetch<any>(
            `/api/pedagogy-space/activity-stats?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
          ).catch(() => null),
          apiFetch<any[]>(
            `/api/pedagogy-space/homeworks?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
          ).catch(() => [] as any[]),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setHomeworks(Array.isArray(hwData) ? hwData : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacherId, academicYearId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement du tableau de bord…
      </div>
    );
  }

  const totalTasks = stats?.totalTasks || 0;
  const totalStudents = stats?.totalStudents || 0;
  const averageParticipation = stats?.averageParticipation ?? 0;
  const studentsAtRisk = stats?.studentsAtRiskCount ?? 0;

  // Échéances à venir : homeworks avec dueDate dans le futur, triés asc
  const now = new Date();
  const upcoming = homeworks
    .filter((hw) => {
      const d = new Date(hw.dueDate);
      return !isNaN(d.getTime()) && d >= new Date(now.getTime() - 24 * 3600 * 1000);
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // Alertes : studentsAtRisk (top 5)
  const alerts = (stats?.studentsAtRisk || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* === 4 cartes stats RÉELLES === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Activités totales"
          value={String(totalTasks)}
          icon={ClipboardList}
          color="text-slate-700"
          bg="bg-slate-100"
        />
        <StatCard
          label="Élèves concernés"
          value={String(totalStudents)}
          icon={Users}
          color="text-blue-700"
          bg="bg-blue-100"
        />
        <StatCard
          label="Participation moyenne"
          value={`${averageParticipation}%`}
          icon={CheckCircle2}
          color="text-emerald-700"
          bg="bg-emerald-100"
        />
        <StatCard
          label="Élèves à risque"
          value={String(studentsAtRisk)}
          icon={AlertTriangle}
          color="text-rose-700"
          bg="bg-rose-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === Échéances à venir === */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Échéances à venir
            </h3>
            <button
              onClick={() => onSwitchTab('homework')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {upcoming.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
                <Clock className="w-8 h-8 text-slate-200" />
                <p className="text-sm font-semibold text-slate-400">
                  Aucune échéance à venir
                </p>
                <p className="text-xs text-slate-300">
                  Les nouvelles activités apparaîtront ici.
                </p>
              </div>
            ) : (
              upcoming.map((hw) => {
                const due = new Date(hw.dueDate);
                const isPast = due < now;
                return (
                  <div
                    key={hw.id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <ClipboardList className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {TASK_TYPES[hw.taskType] || 'Activité'}
                          </span>
                          {hw.subject?.name && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold">
                              {hw.subject.name}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-slate-900 text-sm">
                          {hw.title}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {hw.class?.name || '—'} • {formatDateFR(hw.dueDate)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                        isPast
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700',
                      )}
                    >
                      {isPast ? 'En retard' : 'À venir'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* === Alertes élèves à risque === */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Élèves à risque
            </h3>
            <button
              onClick={() => onSwitchTab('student-followup')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              Détails <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
                <p className="text-sm font-semibold text-slate-400">
                  Aucun élève à risque
                </p>
                <p className="text-xs text-slate-300">
                  Tous vos élèves suivent correctement.
                </p>
              </div>
            ) : (
              alerts.map((s: any) => (
                <div key={s.studentId} className="px-5 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {s.firstName} {s.lastName}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>Participation : {s.participationRate}%</span>
                    {s.averageScore != null && (
                      <span>Moy. : {s.averageScore}/20</span>
                    )}
                  </div>
                  {Array.isArray(s.alerts) && s.alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.alerts.map((a: string) => (
                        <span
                          key={a}
                          className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-semibold rounded"
                        >
                          {a.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* === Sous-onglets rapides === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard
          title="Devoirs & Exercices"
          description="Gérez les devoirs quotidiens et exercices de vos classes."
          icon={ClipboardList}
          color="text-slate-700"
          bg="bg-slate-100"
          onClick={() => onSwitchTab('homework')}
        />
        <QuickCard
          title="Corrections & Retours"
          description="Saisissez les notes et feedbacks pour chaque élève."
          icon={CheckCircle2}
          color="text-emerald-700"
          bg="bg-emerald-100"
          onClick={() => onSwitchTab('feedback')}
        />
        <QuickCard
          title="Suivi par élève"
          description="Visualisez l'engagement et les performances de chaque élève."
          icon={Users}
          color="text-blue-700"
          bg="bg-blue-100"
          onClick={() => onSwitchTab('student-followup')}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
}) {
  return (
    <div className="p-5 bg-white rounded-xl border border-slate-200">
      <div
        className={cn(
          'p-2.5 w-10 h-10 rounded-lg mb-3 flex items-center justify-center',
          bg,
          color,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    </div>
  );
}

function QuickCard({
  title,
  description,
  icon: Icon,
  color,
  bg,
  onClick,
}: {
  title: string;
  description: string;
  icon: any;
  color: string;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-left"
    >
      <div
        className={cn(
          'p-2.5 w-10 h-10 rounded-lg mb-3 flex items-center justify-center',
          bg,
          color,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-slate-900 text-sm">{title}</h4>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
    </button>
  );
}

// ============================================================================
// HOMEWORK MANAGER — Liste/CRUD pour homework, research, practical
// ============================================================================

interface HomeworkManagerProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  taskType: string;
  onEdit: (hw: any) => void;
  onCreate: () => void;
}

function HomeworkManager({
  teacherId,
  academicYearId,
  classes,
  taskType,
  onEdit,
  onCreate,
}: HomeworkManagerProps) {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedHw, setSelectedHw] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        taskType,
      });
      if (filterClassId) params.append('classId', filterClassId);
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setHomeworks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setHomeworks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, taskType, filterClassId]);

  useEffect(() => {
    load();
  }, [load]);

  // ⭐ handleDelete — ouvre un modal de confirmation personnalisé (pas confirmDialog générique)
  const handleDelete = (hw: any) => {
    setDeleteTarget(hw);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/pedagogy-space/homeworks/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      toast.success('Activité supprimée.');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error('Erreur lors de la suppression', { description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return homeworks;
    const q = search.trim().toLowerCase();
    return homeworks.filter(
      (hw) =>
        (hw.title || '').toLowerCase().includes(q) ||
        (hw.description || '').toLowerCase().includes(q),
    );
  }, [homeworks, search]);

  const taskTypeLabel = TASK_TYPES[taskType] || 'Activité';

  return (
    <div className="space-y-4">
      {/* === En-tête + filtres === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            {taskTypeLabel}s
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} activité(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[160px]"
          >
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[180px]"
          />
          <button
            onClick={load}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle
          </button>
        </div>
      </div>

      {/* === Liste / Table === */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Chargement des activités…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <ClipboardList className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">
              Aucune activité de type {taskTypeLabel}
            </p>
            <p className="text-xs text-slate-300">
              Créez votre première activité pour commencer le suivi.
            </p>
            <button
              onClick={onCreate}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer une activité
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-5 py-3">Titre & Description</th>
                  <th className="px-5 py-3">Matière</th>
                  <th className="px-5 py-3">Classe</th>
                  <th className="px-5 py-3">Échéance</th>
                  <th className="px-5 py-3">Suivi</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((hw) => {
                  const total = hw.totalStudents ?? 0;
                  const done = hw.done ?? 0;
                  const late = hw.late ?? 0;
                  const notDone = hw.notDone ?? 0;
                  const pending = hw.pending ?? 0;
                  return (
                    <tr key={hw.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg mt-0.5">
                            <ClipboardList className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 text-sm">
                              {hw.title}
                            </h4>
                            <p className="text-xs text-slate-500 max-w-xs truncate">
                              {hw.description || 'Pas de description'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {hw.subject?.name || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {hw.class?.name || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {formatDateFR(hw.dueDate)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">
                            {done} fait{done > 1 ? 's' : ''}
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-semibold">
                            {pending} en attente
                          </span>
                          {(late > 0 || notDone > 0) && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-semibold">
                              {late + notDone} probl.
                            </span>
                          )}
                          <span className="text-slate-400">/ {total}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setSelectedHw(hw)}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Voir le suivi élèves"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(hw)}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(hw)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* === Modal de suivi des élèves (pour 1 homework) === */}
      {selectedHw && (
        <TaskStudentsModal
          homework={selectedHw}
          taskType={taskType}
          onClose={() => { setSelectedHw(null); load(); }}
        />
      )}

      {/* ⭐ MODAL PERSONNALISÉ : Confirmation de suppression (pas de confirmDialog générique) */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <div className="flex items-center gap-3">
                <Trash2 className="h-10 w-10 text-rose-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Supprimer l'activité</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.title}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 font-medium">
                Vous êtes sur le point de supprimer définitivement cette activité.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase">⚠ Conséquences :</p>
                <p className="text-xs text-amber-900">
                  Le devoir et tout le suivi des élèves associé (statuts, notes, appréciations) seront définitivement supprimés.
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL — Suivi des élèves pour un devoir (voir + éditer statut par élève)
// ============================================================================

function TaskStudentsModal({
  homework,
  taskType,
  onClose,
}: {
  homework: any;
  taskType: string;
  onClose: () => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    // ⭐ Vérifier que homework.id existe avant de faire l'appel API
    if (!homework?.id) {
      toast.error('Données invalides : ID du devoir manquant');
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${homework.id}/students`,
      );
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      // ⭐ Améliorer le message d'erreur pour inclure l'ID et le détails
      toast.error('Erreur lors du chargement du suivi', {
        description: `Devoir ID: ${homework.id} — ${e.message}`,
      });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [homework?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (
    student: any,
    newStatus: string,
  ) => {
    setUpdating(student.id);
    try {
      await apiFetch(`/api/pedagogy-space/task-students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          // Conserver les autres champs
          score: student.score ?? undefined,
          appreciation: student.appreciation ?? undefined,
          observation: student.observation ?? undefined,
        }),
      });
      toast.success('Statut mis à jour.');
      // Mettre à jour localement
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id ? { ...s, status: newStatus } : s,
        ),
      );
    } catch (e: any) {
      toast.error('Erreur lors de la mise à jour', {
        description: e.message,
      });
    } finally {
      setUpdating(null);
    }
  };

  const statusOptions = STATUS_BY_TASK_TYPE[taskType] || STATUS_BY_TASK_TYPE.HOMEWORK;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{homework.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {homework.class?.name || '—'} • {TASK_TYPES[taskType] || 'Activité'} • Échéance : {formatDateFR(homework.dueDate)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Chargement des élèves…
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
              <Users className="w-8 h-8 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">
                Aucun élève inscrit dans cette classe
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-4 py-3">Élève</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {s.student?.lastName} {s.student?.firstName}
                        </p>
                        {s.student?.matricule && (
                          <p className="text-xs text-slate-400">
                            Mat: {s.student.matricule}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                            cfg.color,
                          )}
                        >
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {s.score != null ? `${s.score}/20` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={s.status}
                          onChange={(e) => handleStatusChange(s, e.target.value)}
                          disabled={updating === s.id}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                        >
                          {statusOptions.map((st) => (
                            <option key={st} value={st}>
                              {STATUS_CONFIG[st]?.label || st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY LIBRARY — Bibliothèque d'activités (utilise /api/pedagogy/global-library)
// ============================================================================

function ActivityLibraryTab() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>(`/api/pedagogy/global-library`);
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setResources(list);
    } catch (e: any) {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return resources;
    const q = search.trim().toLowerCase();
    return resources.filter((r) =>
      (r.title || r.name || '').toLowerCase().includes(q),
    );
  }, [resources, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Bibliothèque d'activités
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Ressources pédagogiques réutilisables (modèles, fiches, grilles).
          </p>
        </div>
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement de la bibliothèque…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <Library className="w-10 h-10 text-slate-200" />
          <p className="text-sm font-semibold text-slate-400">
            Aucune ressource dans la bibliothèque
          </p>
          <p className="text-xs text-slate-300">
            Les ressources ajoutées par les administrateurs apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <FileText className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 truncate">
                    {r.title || r.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {r.description || r.summary || ''}
                  </p>
                </div>
              </div>
              {r.fileUrl && (
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
