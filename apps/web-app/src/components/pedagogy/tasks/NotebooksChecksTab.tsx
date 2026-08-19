'use client';

/**
 * ============================================================================
 * CAHIERS & COPIES — Workflow professionnel de contrôle des cahiers
 * ============================================================================
 *
 * Workflow attendu :
 *   1. L'enseignant crée une leçon pour la journée (modal dédié avec
 *      RichTextEditor pour le contenu « retenons »).
 *   2. La leçon apparaît dans la liste du jour avec deux actions :
 *        - « Voir le contenu » → affiche le contenu HTML riche (retenons)
 *        - « Vérifier les copies » → déplie la liste des élèves de la classe
 *   3. Pour chaque élève, l'enseignant saisit deux dimensions :
 *        - Cahier propre : Oui / Non (toggle vert / rouge)
 *        - Leçon copiée : Oui / Non / Partiel (toggle vert / rouge / orange)
 *        - Observation libre (court texte)
 *      Le couple (cahier, leçon) est mappé vers un statut unique backend :
 *        (oui, oui) → DONE        (cahier propre + leçon copiée)
 *        (oui, non) → NOT_DONE    (cahier propre mais leçon non copiée)
 *        (oui, partiel) → INCOMPLETE
 *        (non, *)    → TO_REDO    (cahier à refaire)
 *        (null, null) → PENDING   (non évalué)
 *   4. Enregistrer : batch update via PUT /api/pedagogy-space/task-students/:id
 *   5. Historique : catalogue en dossiers imbriqués
 *      Année > Trimestre > Mois > Semaine > Jour > Leçons + élèves
 *
 * Backend :
 *   POST   /api/pedagogy-space/homeworks
 *          body: { title, description (HTML), classId, subjectId?,
 *                  dueDate, taskType: 'LESSON', academicYearId,
 *                  schoolLevelId, teacherId }
 *   GET    /api/pedagogy-space/homeworks?teacherId&academicYearId&classId&taskType=LESSON
 *   GET    /api/pedagogy-space/homeworks/:id/students
 *   PUT    /api/pedagogy-space/task-students/:id
 *          body: { status, observation?, appreciation?, score? }
 *   GET    /api/pedagogy-space/subjects/available?academicYearId&classId&teacherId
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, NotebookPen, Save, CalendarDays, History,
  ChevronDown, ChevronRight, Plus, BookOpen, Eye, ClipboardCheck,
  Check, X, AlertTriangle, Folder, FolderOpen, Inbox, FileText, Clock,
} from 'lucide-react';
import {
  apiFetch, formatDateFR, formatDateInput,
} from './TeacherTasksWorkspace';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import RichContent from '@/components/ui/RichContent';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTES
// ============================================================================

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Statut backend associé à chaque combinaison (cahier, leçon). */
const STATUS_FROM_DRAFT = {
  'oui-oui': 'DONE',
  'oui-non': 'NOT_DONE',
  'oui-partiel': 'INCOMPLETE',
  'non-oui': 'TO_REDO',
  'non-non': 'TO_REDO',
  'non-partiel': 'TO_REDO',
} as const;

/** Mapping inverse (statut → couple cahier / leçon) pour l'affichage. */
const DRAFT_FROM_STATUS: Record<string, { cahier: string | null; lecon: string | null }> = {
  DONE: { cahier: 'oui', lecon: 'oui' },
  NOT_DONE: { cahier: 'oui', lecon: 'non' },
  INCOMPLETE: { cahier: 'oui', lecon: 'partiel' },
  TO_REDO: { cahier: 'non', lecon: 'non' },
  PENDING: { cahier: null, lecon: null },
};

// ============================================================================
// PROPS
// ============================================================================

interface NotebooksChecksTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}

type InnerTab = 'today' | 'history';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function NotebooksChecksTab({
  teacherId,
  academicYearId,
  schoolLevelId,
  classes,
}: NotebooksChecksTabProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('today');
  // Signal local de rafraîchissement (incrémenté après création de leçon)
  const [refreshSignal, setRefreshSignal] = useState(0);
  // Modal de création de leçon
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* === En-tête + bouton créer === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-slate-700" />
            Cahiers &amp; Copies
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Créez la leçon du jour, vérifiez la tenue du cahier et la copie de
            chaque élève, puis enrichissez l'historique pédagogique.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
          type="button"
        >
          <Plus className="w-4 h-4" />
          Créer une leçon
        </button>
      </div>

      {/* === Sous-navigation interne === */}
      <div className="flex overflow-x-auto border-b border-slate-100">
        {([
          { id: 'today', label: 'Saisie du jour', icon: CalendarDays },
          { id: 'history', label: 'Historique', icon: History },
        ] as const).map((t) => {
          const Icon = t.icon;
          const isActive = innerTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setInnerTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap border-b-2',
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* === Contenu === */}
      {innerTab === 'today' ? (
        <TodayNotebookCheck
          key={`today-${refreshSignal}`}
          teacherId={teacherId}
          academicYearId={academicYearId}
          schoolLevelId={schoolLevelId}
          classes={classes}
          openCreateModal={() => setCreateModalOpen(true)}
        />
      ) : (
        <HistoryNotebookCheck
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      )}

      {/* === Modal de création de leçon === */}
      {createModalOpen && (
        <CreateLessonModal
          teacherId={teacherId}
          academicYearId={academicYearId}
          schoolLevelId={schoolLevelId}
          classes={classes}
          onClose={() => setCreateModalOpen(false)}
          onSaved={() => {
            setRefreshSignal((s) => s + 1);
            setCreateModalOpen(false);
            toast.success('Leçon créée. Elle apparaît maintenant dans la liste du jour.');
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL DE CRÉATION DE LEÇON — RichTextEditor pour le contenu
// ============================================================================

interface CreateLessonModalProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  onClose: () => void;
  onSaved: () => void;
}

function CreateLessonModal({
  teacherId,
  academicYearId,
  schoolLevelId,
  classes,
  onClose,
  onSaved,
}: CreateLessonModalProps) {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState(classes[0]?.classId || '');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(formatDateInput(new Date().toISOString()));
  const [content, setContent] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  // === Sujets disponibles : d'abord depuis classes[].subjects, fallback API ===
  const selectedClass = useMemo(
    () => classes.find((c) => c.classId === classId),
    [classes, classId],
  );
  const [fetchedSubjects, setFetchedSubjects] = useState<any[]>([]);
  const availableSubjects =
    selectedClass?.subjects?.length > 0
      ? selectedClass.subjects
      : fetchedSubjects;

  useEffect(() => {
    if (!classId || !academicYearId) {
      setFetchedSubjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ academicYearId, classId, teacherId });
        const data = await apiFetch<any[]>(
          `/api/pedagogy-space/subjects/available?${params.toString()}`,
        );
        if (!cancelled) setFetchedSubjects(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFetchedSubjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, academicYearId, teacherId]);

  // Reset subjectId si la classe change et que le sujet n'existe plus
  useEffect(() => {
    if (subjectId && availableSubjects.length > 0) {
      const exists = availableSubjects.some(
        (s: any) => s.subjectId === subjectId || s.id === subjectId,
      );
      if (!exists) setSubjectId('');
    }
  }, [availableSubjects, subjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Le titre de la leçon est obligatoire.');
      return;
    }
    if (!classId) {
      toast.error('Veuillez sélectionner une classe.');
      return;
    }
    if (!date) {
      toast.error('Veuillez sélectionner une date.');
      return;
    }
    if (!academicYearId || !schoolLevelId || !teacherId) {
      toast.error("Contexte manquant (année académique, niveau ou enseignant).");
      return;
    }
    // Strip HTML si le contenu n'est que du whitespace visible
    const tmp = document.createElement('div');
    tmp.innerHTML = content;
    const plainText = (tmp.textContent || '').trim();
    if (!plainText) {
      toast.error('Le contenu de la leçon (le « retenons ») est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: content, // HTML riche
        classId,
        subjectId: subjectId || undefined,
        dueDate: new Date(date).toISOString(),
        taskType: 'LESSON',
        academicYearId,
        schoolLevelId,
        teacherId,
        observations: observations.trim() || undefined,
      };
      await apiFetch('/api/pedagogy-space/homeworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (e: any) {
      toast.error('Erreur lors de la création de la leçon', {
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <NotebookPen className="w-5 h-5 text-slate-700" />
              Créer une leçon
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Le contenu saisi sera le « retenons » que les élèves devront
              recopier en classe.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — form scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Titre de la leçon <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Les fractions simples — définition et exemples"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              required
              autoFocus
            />
          </div>

          {/* Classe + Matière + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                Matière
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
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                required
              />
            </div>
          </div>

          {/* Contenu de la leçon (RichTextEditor) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Contenu de la leçon — « Retenons » <span className="text-rose-500">*</span>
            </label>
            <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-300">
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Saisissez ici le texte que les élèves devront recopier (définition, propriété, exemples…). Vous pouvez mettre en forme avec les boutons ci-dessus."
                minHeight="200px"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Astuce : utilisez <kbd className="px-1 bg-slate-100 rounded text-[10px]">Ctrl+B</kbd> pour
              le gras, <kbd className="px-1 bg-slate-100 rounded text-[10px]">Ctrl+I</kbd> pour
              l'italique.
            </p>
          </div>

          {/* Observations pédagogiques (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Observations pour le tableau (optionnel)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              placeholder="Ex: Apporter le manuel page 42 ; prévoir le matériel de géométrie."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium resize-y"
            />
          </div>
        </form>

        {/* Footer — actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Création…' : 'Créer la leçon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SAISIE DU JOUR — Liste des leçons + vérification des copies
// ============================================================================

function TodayNotebookCheck({
  teacherId,
  academicYearId,
  classes,
  openCreateModal,
}: {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  openCreateModal: () => void;
}) {
  const todayStr = formatDateInput(new Date().toISOString());
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Pour chaque homeworkId, on stocke : { students, loading, expanded, drafts }
  const [studentsByHw, setStudentsByHw] = useState<
    Record<string, { students: any[]; loading: boolean; expanded: boolean; contentOpen: boolean }>
  >({});
  // drafts[studentId] = { cahier: 'oui'|'non'|null, lecon: 'oui'|'non'|'partiel'|null, observation: string }
  const [drafts, setDrafts] = useState<
    Record<string, { cahier: string | null; lecon: string | null; observation: string }>
  >({});
  const [saving, setSaving] = useState(false);

  // === Auto-sélection de la 1re classe ===
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // === Chargement des leçons (taskType=LESSON) pour la classe sélectionnée ===
  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setLessons([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId,
        taskType: 'LESSON',
      });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setLessons(Array.isArray(data) ? data : []);
      setStudentsByHw({});
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des leçons', {
        description: e.message,
      });
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // === Filtrer par date du jour sélectionnée ===
  const lessonsForDate = useMemo(() => {
    if (!date) return [];
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return lessons
      .filter((hw) => {
        if (!hw.dueDate) return false;
        const d = new Date(hw.dueDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === target.getTime();
      })
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
  }, [lessons, date]);

  // === Stats globales (toutes les leçons du jour) ===
  const summary = useMemo(() => {
    const allStudents = Object.values(studentsByHw).flatMap((s) => s.students);
    const total = allStudents.length;
    let done = 0, notDone = 0, incomplete = 0, toRedo = 0, pending = 0;
    for (const s of allStudents) {
      const d = drafts[s.id];
      const status =
        d && (d.cahier || d.lecon)
          ? computeStatusFromDraft(d)
          : s.status || 'PENDING';
      if (status === 'DONE') done++;
      else if (status === 'NOT_DONE') notDone++;
      else if (status === 'INCOMPLETE') incomplete++;
      else if (status === 'TO_REDO') toRedo++;
      else pending++;
    }
    return { total, done, notDone, incomplete, toRedo, pending };
  }, [studentsByHw, drafts]);

  // === Toggle "Voir le contenu" (expand RichContent) ===
  const toggleContent = (hwId: string) => {
    setStudentsByHw((prev) => ({
      ...prev,
      [hwId]: {
        ...(prev[hwId] || { students: [], loading: false, expanded: false, contentOpen: false }),
        contentOpen: !prev[hwId]?.contentOpen,
      },
    }));
  };

  // === Toggle "Vérifier les copies" (expand student list) ===
  const toggleStudents = async (hw: any) => {
    const hwId = hw.id;
    const existing = studentsByHw[hwId];
    if (existing?.expanded) {
      // Replier
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: { ...prev[hwId], expanded: false },
      }));
      return;
    }
    if (existing?.students?.length > 0) {
      // Déjà chargé, juste déplier
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: { ...prev[hwId], expanded: true },
      }));
      return;
    }
    // Charger
    setStudentsByHw((prev) => ({
      ...prev,
      [hwId]: { students: [], loading: true, expanded: true, contentOpen: false },
    }));
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${hwId}/students`,
      );
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: {
          ...(prev[hwId] || {}),
          students: Array.isArray(data) ? data : [],
          loading: false,
          expanded: true,
        },
      }));
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: { ...prev[hwId], students: [], loading: false, expanded: true },
      }));
    }
  };

  // === Set draft (cahier / leçon / observation) ===
  const setDraft = (
    studentId: string,
    patch: Partial<{
      cahier: string | null;
      lecon: string | null;
      observation: string;
    }>,
  ) => {
    setDrafts((prev) => {
      const current =
        prev[studentId] || { cahier: null, lecon: null, observation: '' };
      return { ...prev, [studentId]: { ...current, ...patch } };
    });
  };

  // === Batch save ===
  const handleSave = async (hwId: string) => {
    const state = studentsByHw[hwId];
    if (!state || state.students.length === 0) return;
    const dirty = state.students
      .map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        // Si ni cahier ni leçon modifiés et pas d'observation → skip
        const hasToggle = !!d.cahier || !!d.lecon;
        const hasObs = d.observation !== '' && d.observation !== (s.observation ?? '');
        if (!hasToggle && !hasObs) return null;
        const status = computeStatusFromDraft(d);
        return {
          id: s.id,
          status,
          observation: d.observation !== '' ? d.observation : s.observation ?? undefined,
          appreciation: s.appreciation ?? undefined,
          score: s.score ?? undefined,
        };
      })
      .filter(Boolean) as {
      id: string;
      status: string;
      observation?: string;
      appreciation?: string;
      score?: number;
    }[];

    if (dirty.length === 0) {
      toast.info('Aucune modification à enregistrer.');
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        dirty.map((d) =>
          apiFetch(`/api/pedagogy-space/task-students/${d.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: d.status,
              observation: d.observation,
              appreciation: d.appreciation,
              score: d.score,
            }),
          }),
        ),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const ko = results.filter((r) => r.status === 'rejected').length;
      if (ko === 0) {
        toast.success(`${ok} élève(s) mis à jour avec succès.`);
      } else {
        toast.warning(`${ok} mis à jour, ${ko} en échec.`, {
          description: 'Vérifiez la console et réessayez.',
        });
      }
      // Clear drafts pour ce hw et recharger les élèves
      setDrafts((prev) => {
        const next = { ...prev };
        for (const s of state.students) delete next[s.id];
        return next;
      });
      // Recharger les étudiants
      try {
        const data = await apiFetch<any[]>(
          `/api/pedagogy-space/homeworks/${hwId}/students`,
        );
        setStudentsByHw((prev) => ({
          ...prev,
          [hwId]: {
            ...(prev[hwId] || {}),
            students: Array.isArray(data) ? data : [],
            loading: false,
            expanded: true,
          },
        }));
      } catch {
        // silencieux
      }
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasDirtyFor = (hwId: string) => {
    const state = studentsByHw[hwId];
    if (!state) return false;
    return state.students.some((s) => drafts[s.id]);
  };

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Classe
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Date du jour
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          type="button"
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* === États de chargement / vide === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des leçons…
        </div>
      ) : !classId ? (
        <EmptyState
          icon={NotebookPen}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour créer ou vérifier les leçons du jour."
        />
      ) : lessonsForDate.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={`Aucune leçon pour le ${formatDateFR(date)}`}
          subtitle="Créez une nouvelle leçon pour cette journée — son contenu sera recopié par les élèves."
          actionLabel="Créer une leçon"
          onAction={openCreateModal}
        />
      ) : (
        <>
          {/* === Stats summary === */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <SummaryStat label="Élèves" value={summary.total} color="text-slate-700" bg="bg-slate-100" />
            <SummaryStat label="Propres + copiées" value={summary.done} color="text-emerald-700" bg="bg-emerald-100" />
            <SummaryStat label="Partielles" value={summary.incomplete} color="text-amber-700" bg="bg-amber-100" />
            <SummaryStat label="Non copiées" value={summary.notDone} color="text-rose-700" bg="bg-rose-100" />
            <SummaryStat label="À refaire" value={summary.toRedo} color="text-purple-700" bg="bg-purple-100" />
            <SummaryStat label="Non vérifiés" value={summary.pending} color="text-slate-600" bg="bg-slate-100" />
          </div>

          {/* === Liste des leçons du jour === */}
          <div className="space-y-3">
            {lessonsForDate.map((hw) => {
              const state = studentsByHw[hw.id] || {
                students: [],
                loading: false,
                expanded: false,
                contentOpen: false,
              };
              const hasDirty = hasDirtyFor(hw.id);
              return (
                <LessonCheckCard
                  key={hw.id}
                  hw={hw}
                  state={state}
                  drafts={drafts}
                  onToggleContent={() => toggleContent(hw.id)}
                  onToggleStudents={() => toggleStudents(hw)}
                  onDraft={(studentId, patch) => setDraft(studentId, patch)}
                  onSave={() => handleSave(hw.id)}
                  saving={saving}
                  hasDirty={hasDirty}
                />
              );
            })}
          </div>

          {/* === Bouton "Créer une autre leçon" === */}
          <div className="flex justify-center pt-2">
            <button
              onClick={openCreateModal}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer une autre leçon pour le {formatDateFR(date)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// CARTE LEÇON — header + boutons Voir le contenu / Vérifier les copies
// ============================================================================

function LessonCheckCard({
  hw,
  state,
  drafts,
  onToggleContent,
  onToggleStudents,
  onDraft,
  onSave,
  saving,
  hasDirty,
}: {
  hw: any;
  state: {
    students: any[];
    loading: boolean;
    expanded: boolean;
    contentOpen: boolean;
  };
  drafts: Record<string, { cahier: string | null; lecon: string | null; observation: string }>;
  onToggleContent: () => void;
  onToggleStudents: () => void;
  onDraft: (studentId: string, patch: Partial<{
    cahier: string | null;
    lecon: string | null;
    observation: string;
  }>) => void;
  onSave: () => void;
  saving: boolean;
  hasDirty: boolean;
}) {
  const students = state.students;
  // Compteurs dérivés (drafts l'emportent)
  const counters = useMemo(() => {
    let done = 0, notDone = 0, incomplete = 0, toRedo = 0, pending = 0;
    for (const s of students) {
      const d = drafts[s.id];
      const status = d && (d.cahier || d.lecon)
        ? computeStatusFromDraft(d)
        : s.status || 'PENDING';
      if (status === 'DONE') done++;
      else if (status === 'NOT_DONE') notDone++;
      else if (status === 'INCOMPLETE') incomplete++;
      else if (status === 'TO_REDO') toRedo++;
      else pending++;
    }
    return { done, notDone, incomplete, toRedo, pending, total: students.length };
  }, [students, drafts]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* === Header de la leçon === */}
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1.5 py-0.5 bg-slate-200 rounded">
                Leçon
              </span>
              {hw.subject?.name && (
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-100 rounded">
                  {hw.subject.name}
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-900 text-sm mt-1.5">
              {hw.title}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {hw.class?.name || '—'} • {formatDateFR(hw.dueDate)}
              {hw.observations ? ` • ${hw.observations}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onToggleContent}
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                state.contentOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              {state.contentOpen ? 'Masquer' : 'Voir le contenu'}
            </button>
            <button
              onClick={onToggleStudents}
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                state.expanded
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
              )}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Vérifier les copies
              {counters.total > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                  {counters.done + counters.incomplete}/{counters.total}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* === Mini badges récapitulatifs === */}
        {counters.total > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <MiniBadge label="Propres + copiées" value={counters.done} color="bg-emerald-100 text-emerald-700" />
            <MiniBadge label="Partielles" value={counters.incomplete} color="bg-amber-100 text-amber-700" />
            <MiniBadge label="Non copiées" value={counters.notDone} color="bg-rose-100 text-rose-700" />
            <MiniBadge label="À refaire" value={counters.toRedo} color="bg-purple-100 text-purple-700" />
            <MiniBadge label="Non vérifiés" value={counters.pending} color="bg-slate-100 text-slate-600" />
          </div>
        )}
      </div>

      {/* === Affichage du contenu (RichContent) === */}
      {state.contentOpen && (
        <div className="px-5 py-4 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Retenons
            </span>
          </div>
          {hw.description ? (
            <RichContent
              html={hw.description}
              className="bg-slate-50/50 p-4 rounded-lg border border-slate-100"
            />
          ) : (
            <p className="text-sm text-slate-400 italic px-4 py-3 bg-slate-50 rounded-lg">
              Aucun contenu riche défini pour cette leçon.
            </p>
          )}
        </div>
      )}

      {/* === Table des élèves (Vérifier les copies) === */}
      {state.expanded && (
        <div>
          {state.loading ? (
            <div className="px-5 py-8 flex items-center justify-center text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Chargement des élèves…
            </div>
          ) : students.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400 text-center">
              Aucun élève inscrit dans cette classe.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3">Élève</th>
                    <th className="px-4 py-3 min-w-[180px]">Cahier propre</th>
                    <th className="px-4 py-3 min-w-[220px]">Leçon copiée</th>
                    <th className="px-4 py-3 min-w-[260px]">Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const draft = drafts[s.id];
                    const initial = DRAFT_FROM_STATUS[s.status || 'PENDING'] ||
                      { cahier: null, lecon: null };
                    const currentCahier = draft?.cahier !== undefined ? draft.cahier : initial.cahier;
                    const currentLecon = draft?.lecon !== undefined ? draft.lecon : initial.lecon;
                    const currentObs = draft?.observation ?? s.observation ?? '';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors align-top">
                        {/* Élève */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {s.student?.lastName || s.lastName || '—'}{' '}
                            {s.student?.firstName || s.firstName || ''}
                          </p>
                          {(s.student?.matricule || s.matricule) && (
                            <p className="text-xs text-slate-400">
                              Mat: {s.student?.matricule || s.matricule}
                            </p>
                          )}
                        </td>

                        {/* Cahier propre — toggle Oui / Non */}
                        <td className="px-4 py-3">
                          <ToggleGroup
                            value={currentCahier}
                            options={[
                              { value: 'oui', label: 'Oui', color: 'emerald' },
                              { value: 'non', label: 'Non', color: 'rose' },
                            ]}
                            onChange={(v) => onDraft(s.id, { cahier: v })}
                          />
                        </td>

                        {/* Leçon copiée — toggle Oui / Non / Partiel */}
                        <td className="px-4 py-3">
                          <ToggleGroup
                            value={currentLecon}
                            options={[
                              { value: 'oui', label: 'Oui', color: 'emerald' },
                              { value: 'partiel', label: 'Partiel', color: 'amber' },
                              { value: 'non', label: 'Non', color: 'rose' },
                            ]}
                            onChange={(v) => onDraft(s.id, { lecon: v })}
                          />
                        </td>

                        {/* Observation */}
                        <td className="px-4 py-3">
                          <textarea
                            value={currentObs}
                            onChange={(e) => onDraft(s.id, { observation: e.target.value })}
                            rows={1}
                            placeholder="Ex: Cahier très bien tenu — leçon 3 manquante"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium resize-y min-h-[36px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* === Barre d'actions (sticky) === */}
          {students.length > 0 && (
            <div className="sticky bottom-0 flex items-center justify-end gap-3 p-3 bg-white border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {hasDirty
                  ? `${Object.keys(drafts).length} modification(s) non enregistrée(s)`
                  : 'Toutes les modifications sont enregistrées'}
              </span>
              <button
                onClick={onSave}
                disabled={saving || !hasDirty}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Enregistrement…' : 'Enregistrer les contrôles'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TOGGLE GROUP — boutons colorés (emerald / rose / amber / slate)
// ============================================================================

const COLOR_CLASSES: Record<string, { active: string; idle: string }> = {
  emerald: {
    active: 'bg-emerald-500 text-white border-emerald-500',
    idle: 'text-emerald-700 hover:bg-emerald-50 border-slate-200',
  },
  rose: {
    active: 'bg-rose-500 text-white border-rose-500',
    idle: 'text-rose-700 hover:bg-rose-50 border-slate-200',
  },
  amber: {
    active: 'bg-amber-500 text-white border-amber-500',
    idle: 'text-amber-700 hover:bg-amber-50 border-slate-200',
  },
  slate: {
    active: 'bg-slate-700 text-white border-slate-700',
    idle: 'text-slate-700 hover:bg-slate-50 border-slate-200',
  },
};

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: { value: string; label: string; color: 'emerald' | 'rose' | 'amber' | 'slate' }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const cls = COLOR_CLASSES[opt.color] || COLOR_CLASSES.slate;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(isActive ? null : opt.value)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-md border transition-all',
              isActive ? cls.active : cls.idle,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// HISTORIQUE — vue arborescente Année > Trimestre > Mois > Semaine > Jour
// ============================================================================

function HistoryNotebookCheck({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}) {
  const [classId, setClassId] = useState('');
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Cache : studentsByHw[hwId] = any[]
  const [studentsByHw, setStudentsByHw] = useState<Record<string, any[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null);

  // Auto-sélection de la 1re classe
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setLessons([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId,
        taskType: 'LESSON',
      });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setLessons(Array.isArray(data) ? data : []);
      setStudentsByHw({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // Construction de l'arbre Année > Trimestre > Mois > Semaine > Jour > Leçons
  const tree = useMemo(() => buildHistoryTree(lessons), [lessons]);

  // Charger les élèves d'un lesson (lors de l'expand)
  const loadStudents = async (hwId: string) => {
    if (studentsByHw[hwId]) return;
    setLoadingStudents(hwId);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${hwId}/students`,
      );
      setStudentsByHw((prev) => ({
        ...prev,
        [hwId]: Array.isArray(data) ? data : [],
      }));
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
      setStudentsByHw((prev) => ({ ...prev, [hwId]: [] }));
    } finally {
      setLoadingStudents(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* === Filtres === */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Classe
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          type="button"
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* === États === */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement de l'historique…
        </div>
      ) : !classId ? (
        <EmptyState
          icon={History}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour consulter l'historique des contrôles."
        />
      ) : tree.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucun contrôle enregistré"
          subtitle="Dès que vous créerez et vérifierez des leçons, l'historique apparaîtra ici, organisé par année, trimestre, mois, semaine et jour."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Catalogue des contrôles
              <span className="text-xs text-slate-400 font-normal">
                ({lessons.length} leçon(s))
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Naviguez dans l'arborescence : Année → Trimestre → Mois → Semaine → Jour.
            </p>
          </div>
          <div className="p-2 max-h-[70vh] overflow-y-auto">
            {tree.map((yearNode) => (
              <TreeFolder
                key={yearNode.key}
                node={yearNode}
                level={0}
                studentsByHw={studentsByHw}
                loadingStudents={loadingStudents}
                onLoadStudents={loadStudents}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TREE FOLDER — composant récursif (explorateur de fichiers)
// ============================================================================

interface TreeNode {
  key: string;
  label: string;
  meta?: string;
  level: 'year' | 'trimestre' | 'month' | 'week' | 'day' | 'lesson';
  children?: TreeNode[];
  lessons?: any[]; // pour level=day : liste des leçons du jour
}

function TreeFolder({
  node,
  level,
  studentsByHw,
  loadingStudents,
  onLoadStudents,
}: {
  node: TreeNode;
  level: number;
  studentsByHw: Record<string, any[]>;
  loadingStudents: string | null;
  onLoadStudents: (hwId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(level < 2); // year + trimestre ouverts par défaut
  const [openHwId, setOpenHwId] = useState<string | null>(null);

  const isLessonLevel = node.level === 'day';
  const childCount = node.children?.length || 0;
  const lessonCount = node.lessons?.length || 0;
  const hasChildren = childCount > 0 || lessonCount > 0;

  const iconColorByLevel: Record<string, string> = {
    year: 'text-slate-700',
    trimestre: 'text-slate-600',
    month: 'text-slate-600',
    week: 'text-slate-500',
    day: 'text-emerald-600',
  };

  return (
    <div className="select-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left',
          level === 0 && 'font-bold',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {open && hasChildren ? (
          <FolderOpen className={cn('w-4 h-4 flex-shrink-0', iconColorByLevel[node.level])} />
        ) : (
          <Folder className={cn('w-4 h-4 flex-shrink-0', iconColorByLevel[node.level])} />
        )}
        <span className={cn(
          'text-sm',
          node.level === 'year' && 'font-bold text-slate-900',
          node.level === 'trimestre' && 'font-semibold text-slate-800',
          node.level === 'month' && 'font-medium text-slate-700',
          node.level === 'week' && 'text-slate-600',
          node.level === 'day' && 'font-semibold text-slate-800',
        )}>
          {node.label}
        </span>
        {node.meta && (
          <span className="text-[10px] text-slate-400 ml-1">{node.meta}</span>
        )}
        {childCount > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {childCount}
          </span>
        )}
      </button>

      {open && hasChildren && (
        <div className="mt-0.5">
          {node.children?.map((child) => (
            <TreeFolder
              key={child.key}
              node={child}
              level={level + 1}
              studentsByHw={studentsByHw}
              loadingStudents={loadingStudents}
              onLoadStudents={onLoadStudents}
            />
          ))}

          {/* Leçons du jour (uniquement pour level=day) */}
          {isLessonLevel && node.lessons && node.lessons.length > 0 && (
            <div className="mt-1 space-y-1.5" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
              {node.lessons.map((hw) => {
                const isOpenHw = openHwId === hw.id;
                const students = studentsByHw[hw.id] || [];
                const isLoading = loadingStudents === hw.id;
                return (
                  <div
                    key={hw.id}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (isOpenHw) {
                          setOpenHwId(null);
                        } else {
                          setOpenHwId(hw.id);
                          if (!studentsByHw[hw.id]) {
                            await onLoadStudents(hw.id);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpenHw ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {hw.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {hw.subject?.name || 'Matière générale'}
                          </p>
                        </div>
                      </div>
                    </button>

                    {isOpenHw && (
                      <div className="border-t border-slate-100">
                        {isLoading ? (
                          <div className="px-4 py-4 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            Chargement…
                          </div>
                        ) : students.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-slate-400 text-center">
                            Aucun élève dans cette classe.
                          </p>
                        ) : (
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <th className="px-3 py-2">Élève</th>
                                <th className="px-3 py-2">Cahier</th>
                                <th className="px-3 py-2">Leçon</th>
                                <th className="px-3 py-2">Observation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {students.map((s: any) => {
                                const cfg = DRAFT_FROM_STATUS[s.status || 'PENDING'];
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2">
                                      <p className="text-xs font-semibold text-slate-900">
                                        {s.student?.lastName || s.lastName || '—'}{' '}
                                        {s.student?.firstName || s.firstName || ''}
                                      </p>
                                    </td>
                                    <td className="px-3 py-2">
                                      <CahierBadge cahier={cfg?.cahier || null} />
                                    </td>
                                    <td className="px-3 py-2">
                                      <LeconBadge lecon={cfg?.lecon || null} />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                      {s.observation || (
                                        <span className="text-slate-400 italic">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BADGES — cahier propre + leçon copiée
// ============================================================================

function CahierBadge({ cahier }: { cahier: string | null }) {
  if (cahier === 'oui') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
        <Check className="w-2.5 h-2.5" /> Propre
      </span>
    );
  }
  if (cahier === 'non') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
        <X className="w-2.5 h-2.5" /> À refaire
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
      <Clock className="w-2.5 h-2.5" /> À vérifier
    </span>
  );
}

function LeconBadge({ lecon }: { lecon: string | null }) {
  if (lecon === 'oui') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
        <Check className="w-2.5 h-2.5" /> Copiée
      </span>
    );
  }
  if (lecon === 'partiel') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
        <AlertTriangle className="w-2.5 h-2.5" /> Partielle
      </span>
    );
  }
  if (lecon === 'non') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
        <X className="w-2.5 h-2.5" /> Non copiée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
      <Clock className="w-2.5 h-2.5" /> Non vérifiée
    </span>
  );
}

function MiniBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
      color,
    )}>
      {label} : <span className="font-extrabold">{value}</span>
    </span>
  );
}

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================

function SummaryStat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200">
      <div className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1.5', bg, color)}>
        {label}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-xl border border-slate-200 border-dashed">
      <Icon className="w-10 h-10 text-slate-200" />
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md">{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS — calcul de statut depuis le draft
// ============================================================================

function computeStatusFromDraft(d: {
  cahier: string | null;
  lecon: string | null;
}): string {
  const cahier = d.cahier;
  const lecon = d.lecon;
  if (!cahier && !lecon) return 'PENDING';
  // Si cahier non → TO_REDO
  if (cahier === 'non') return 'TO_REDO';
  // cahier oui ou null
  if (cahier === 'oui') {
    if (lecon === 'oui') return 'DONE';
    if (lecon === 'partiel') return 'INCOMPLETE';
    if (lecon === 'non') return 'NOT_DONE';
  }
  // cahier null mais leçon renseignée
  if (lecon === 'oui') return 'DONE';
  if (lecon === 'partiel') return 'INCOMPLETE';
  if (lecon === 'non') return 'NOT_DONE';
  return 'PENDING';
}

// ============================================================================
// HELPERS — construction de l'arbre historique
// ============================================================================

function getTrimestre(month: number): 1 | 2 | 3 {
  // T1: Sep–Dec (8–11) ; T2: Jan–Mar (0–2) ; T3: Apr–Jun (3–5) + Jul–Aug (6–7)
  if (month >= 8) return 1;
  if (month <= 2) return 2;
  return 3;
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const offsetToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - offsetToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildHistoryTree(homeworks: any[]): TreeNode[] {
  // Map : year (number) → trimestre (1|2|3) → month (0-11) → weekKey (ISO) → dayKey (YYYY-MM-DD) → lessons[]
  const byYear = new Map<
    number,
    Map<number, Map<number, Map<string, Map<string, any[]>>>>
  >();

  for (const hw of homeworks) {
    if (!hw.dueDate) continue;
    const d = new Date(hw.dueDate);
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const trim = getTrimestre(d.getMonth());
    const month = d.getMonth();
    const weekStart = getWeekStart(d);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!byYear.has(year)) byYear.set(year, new Map());
    const yMap = byYear.get(year)!;
    if (!yMap.has(trim)) yMap.set(trim, new Map());
    const tMap = yMap.get(trim)!;
    if (!tMap.has(month)) tMap.set(month, new Map());
    const mMap = tMap.get(month)!;
    if (!mMap.has(weekKey)) mMap.set(weekKey, new Map());
    const wMap = mMap.get(weekKey)!;
    if (!wMap.has(dayKey)) wMap.set(dayKey, []);
    wMap.get(dayKey)!.push(hw);
  }

  // Construction de l'arbre
  const tree: TreeNode[] = [];
  for (const [year, tMap] of byYear) {
    const tChildren: TreeNode[] = [];
    for (const [trim, mMap] of tMap) {
      const mChildren: TreeNode[] = [];
      for (const [month, wMap] of mMap) {
        const wChildren: TreeNode[] = [];
        for (const [weekKey, dMap] of wMap) {
          const dChildren: TreeNode[] = [];
          for (const [dayKey, lessons] of dMap) {
            dChildren.push({
              key: `${year}-${trim}-${month}-${weekKey}-${dayKey}`,
              label: formatDateFR(dayKey),
              level: 'day',
              children: [],
              lessons: lessons.sort(
                (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
              ),
            });
          }
          // Tri des jours : plus récent en premier
          dChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
          const ws = new Date(weekKey);
          const we = new Date(ws);
          we.setDate(ws.getDate() + 6);
          wChildren.push({
            key: `${year}-${trim}-${month}-${weekKey}`,
            label: `Semaine du ${formatDateFR(weekKey)} au ${formatDateFR(we.toISOString())}`,
            level: 'week',
            children: dChildren,
          });
        }
        // Tri semaines : plus récent en premier
        wChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
        mChildren.push({
          key: `${year}-${trim}-${month}`,
          label: MONTHS_FR[month],
          level: 'month',
          children: wChildren,
        });
      }
      // Tri mois : ordre chronologique inverse
      mChildren.sort((a, b) => (a.key < b.key ? 1 : -1));
      tChildren.push({
        key: `${year}-${trim}`,
        label: `Trimestre ${trim}`,
        level: 'trimestre',
        children: mChildren,
      });
    }
    // Tri trimestres : ordre croissant (T1 < T2 < T3) au sein d'une année
    tChildren.sort((a, b) => {
      const at = parseInt(a.key.split('-')[1]);
      const bt = parseInt(b.key.split('-')[1]);
      return at - bt;
    });
    tree.push({
      key: String(year),
      label: `Année ${year}`,
      level: 'year',
      children: tChildren,
    });
  }

  // Tri années : plus récente en premier
  tree.sort((a, b) => Number(b.key) - Number(a.key));
  return tree;
}

// Imported for type completeness (avoids unused import warnings in some setups)
// (intentionally left empty)
