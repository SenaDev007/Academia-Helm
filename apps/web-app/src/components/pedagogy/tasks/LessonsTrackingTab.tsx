'use client';

/**
 * ============================================================================
 * LEÇONS & RÉCITATIONS — Suivi du statut par élève
 * ============================================================================
 *
 * L'enseignant peut :
 *   1. Sélectionner une classe + date du jour (par défaut aujourd'hui)
 *   2. Sélectionner une leçon / récitation (depuis les HomeworkEntry de type
 *      LESSON ou RECITATION) — ou en créer une nouvelle directement
 *   3. Voir la liste des élèves de la classe
 *   4. Pour chaque élève :
 *      - Récitation : Réussie / Échouée / Non évaluée (badge vert/rouge/gris)
 *      - Leçon copiée : Oui / Non (badge vert/rouge)
 *      - Note (sur 20)
 *      - Appréciation (texte libre)
 *   5. Enregistrer tous les statuts en une fois (batch update via Promise.all)
 *   6. Sous-onglet "Historique" (vue Trimestre / Mois / Semaine / Jour)
 *
 * Backend :
 *   GET  /api/pedagogy-space/homeworks?teacherId&academicYearId&classId?&taskType?
 *   GET  /api/pedagogy-space/homeworks/:id/students
 *   PUT  /api/pedagogy-space/task-students/:id
 *        → body: { status, score?, appreciation?, observation? }
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, Plus, Edit, BookOpen, Mic, Save,
  CalendarDays, History, ChevronRight, ChevronDown,
  Check, X, Clock, AlertTriangle,
} from 'lucide-react';
import {
  apiFetch, STATUS_CONFIG, STATUS_BY_TASK_TYPE,
  formatDateFR, formatDateInput,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTES
// ============================================================================

const TASK_TYPE_FILTERS = [
  { value: 'LESSON', label: 'Leçons à recopier', icon: BookOpen },
  { value: 'RECITATION', label: 'Récitations', icon: Mic },
] as const;

// ============================================================================
// PROPS
// ============================================================================

interface LessonsTrackingTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  onCreate: () => void;
  onEdit: (hw: any) => void;
}

type InnerTab = 'today' | 'history';
type PeriodKind = 'trimestre' | 'mois' | 'semaine' | 'jour';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function LessonsTrackingTab({
  teacherId,
  academicYearId,
  classes,
  onCreate,
  onEdit,
}: LessonsTrackingTabProps) {
  const [innerTab, setInnerTab] = useState<InnerTab>('today');

  return (
    <div className="space-y-4">
      {/* === En-tête === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-700" />
            Leçons & Récitations
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Suivez chaque jour la récitation des élèves et la copie des leçons.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
          type="button"
        >
          <Plus className="w-4 h-4" />
          Nouvelle activité
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
        <TodayLessonTracking
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
          onCreate={onCreate}
          onEdit={onEdit}
        />
      ) : (
        <HistoryLessonTracking
          teacherId={teacherId}
          academicYearId={academicYearId}
          classes={classes}
        />
      )}
    </div>
  );
}

// ============================================================================
// SAISIE DU JOUR
// ============================================================================

function TodayLessonTracking({
  teacherId,
  academicYearId,
  classes,
  onEdit,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
  onCreate: () => void;
  onEdit: (hw: any) => void;
}) {
  const todayStr = formatDateInput(new Date().toISOString());
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [taskTypeFilter, setTaskTypeFilter] = useState<'LESSON' | 'RECITATION'>('RECITATION');
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [selectedHwId, setSelectedHwId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [loadingHw, setLoadingHw] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  // drafts[studentId] = { status, score, appreciation }
  const [drafts, setDrafts] = useState<
    Record<string, { status: string; score: string; appreciation: string }>
  >({});

  // === Auto-sélection de la 1re classe ===
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // === Chargement des homeworks (LESSON ou RECITATION) pour la classe ===
  const loadHomeworks = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setHomeworks([]);
      setSelectedHwId('');
      return;
    }
    setLoadingHw(true);
    try {
      const params = new URLSearchParams({
        teacherId,
        academicYearId,
        classId,
        taskType: taskTypeFilter,
      });
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks?${params.toString()}`,
      );
      setHomeworks(Array.isArray(data) ? data : []);
      setSelectedHwId('');
      setStudents([]);
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des activités', {
        description: e.message,
      });
      setHomeworks([]);
    } finally {
      setLoadingHw(false);
    }
  }, [teacherId, academicYearId, classId, taskTypeFilter]);

  useEffect(() => {
    loadHomeworks();
  }, [loadHomeworks]);

  // === Filtrer par date ===
  const homeworksForDate = useMemo(() => {
    if (!date) return homeworks;
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return homeworks.filter((hw) => {
      if (!hw.dueDate) return false;
      const d = new Date(hw.dueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    });
  }, [homeworks, date]);

  // === Auto-sélection du 1er homework si 1 seul match ===
  useEffect(() => {
    if (homeworksForDate.length === 1 && selectedHwId !== homeworksForDate[0].id) {
      setSelectedHwId(homeworksForDate[0].id);
    } else if (
      homeworksForDate.length > 0 &&
      !homeworksForDate.some((h) => h.id === selectedHwId)
    ) {
      // Si la sélection actuelle n'est plus dans la liste, on la reset
      setSelectedHwId('');
      setStudents([]);
    }
  }, [homeworksForDate, selectedHwId]);

  // === Chargement des élèves pour le homework sélectionné ===
  const loadStudents = useCallback(async () => {
    if (!selectedHwId) {
      setStudents([]);
      setDrafts({});
      return;
    }
    setLoadingStudents(true);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${selectedHwId}/students`,
      );
      setStudents(Array.isArray(data) ? data : []);
      setDrafts({});
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedHwId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // === Helpers draft ===
  const setDraft = (
    studentId: string,
    patch: Partial<{ status: string; score: string; appreciation: string }>,
  ) => {
    setDrafts((prev) => {
      const current =
        prev[studentId] || { status: '', score: '', appreciation: '' };
      return { ...prev, [studentId]: { ...current, ...patch } };
    });
  };

  const selectedHw = useMemo(
    () => homeworks.find((h) => h.id === selectedHwId) || null,
    [homeworks, selectedHwId],
  );

  const statusOptions =
    STATUS_BY_TASK_TYPE[taskTypeFilter] || STATUS_BY_TASK_TYPE.HOMEWORK;

  // === Stats ===
  const summary = useMemo(() => {
    const done = students.filter(
      (s) => (drafts[s.id]?.status || s.status) === 'DONE' ||
              (drafts[s.id]?.status || s.status) === 'RECITED',
    ).length;
    const notDone = students.filter(
      (s) => {
        const st = drafts[s.id]?.status || s.status;
        return st === 'NOT_DONE' || st === 'NOT_RECITED';
      },
    ).length;
    const pending = students.filter(
      (s) => (drafts[s.id]?.status || s.status) === 'PENDING',
    ).length;
    const scored = students.filter((s) => {
      const sc = drafts[s.id]?.score;
      if (sc !== undefined && sc !== '') return true;
      return s.score != null;
    }).length;
    const avg =
      students.reduce((acc, s) => {
        const sc = drafts[s.id]?.score;
        const scoreNum = sc !== undefined && sc !== '' ? parseFloat(sc) : s.score;
        if (scoreNum != null && !isNaN(scoreNum)) {
          return acc + scoreNum;
        }
        return acc;
      }, 0) / (scored || 1);
    return {
      total: students.length,
      done,
      notDone,
      pending,
      scored,
      avg: scored > 0 ? Math.round(avg * 10) / 10 : null,
    };
  }, [students, drafts]);

  // === Batch save ===
  const handleSave = async () => {
    if (students.length === 0) return;
    const dirty = students
      .map((s) => {
        const d = drafts[s.id];
        if (!d) return null;
        const scoreStr = d.score !== '' ? d.score : null;
        const scoreNum = scoreStr != null ? parseFloat(scoreStr) : s.score;
        return {
          id: s.id,
          status: d.status || s.status,
          score: isNaN(scoreNum as number) ? undefined : scoreNum,
          appreciation:
            d.appreciation !== '' ? d.appreciation : (s.appreciation ?? undefined),
          observation: s.observation ?? undefined,
        };
      })
      .filter(
        (d): d is NonNullable<typeof d> =>
          d !== null &&
          (d.status !== undefined ||
            d.score !== undefined ||
            d.appreciation !== undefined),
      );

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
              score: d.score,
              appreciation: d.appreciation,
              observation: d.observation,
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
          description: 'Vérifiez les logs et réessayez.',
        });
      }
      setDrafts({});
      await loadStudents();
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = Object.keys(drafts).length > 0;
  const maxScore = selectedHw?.maxScore || 20;

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

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Type
          </label>
          <select
            value={taskTypeFilter}
            onChange={(e) =>
              setTaskTypeFilter(e.target.value as 'LESSON' | 'RECITATION')
            }
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            {TASK_TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          />
        </div>

        <div className="flex-1 min-w-[260px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            {taskTypeFilter === 'RECITATION' ? 'Récitation' : 'Leçon'} du jour
          </label>
          {loadingHw ? (
            <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
            </div>
          ) : (
            <select
              value={selectedHwId}
              onChange={(e) => setSelectedHwId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
              disabled={homeworksForDate.length === 0}
            >
              <option value="">
                {homeworksForDate.length === 0
                  ? `Aucune ${taskTypeFilter === 'RECITATION' ? 'récitation' : 'leçon'} pour cette date`
                  : `— Sélectionner (${homeworksForDate.length}) —`}
              </option>
              {homeworksForDate.map((hw) => (
                <option key={hw.id} value={hw.id}>
                  {hw.title}
                  {hw.subject?.name ? ` — ${hw.subject.name}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedHw && (
          <button
            onClick={() => onEdit(selectedHw)}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Modifier l'activité"
            type="button"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={loadHomeworks}
          disabled={loadingHw}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
          type="button"
        >
          <RefreshCw className={cn('w-4 h-4', loadingHw && 'animate-spin')} />
        </button>
      </div>

      {/* === États === */}
      {!classId ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune classe sélectionnée"
          subtitle="Sélectionnez une classe pour démarrer le suivi."
        />
      ) : !selectedHwId ? (
        <EmptyState
          icon={taskTypeFilter === 'RECITATION' ? Mic : BookOpen}
          title={`Aucune ${taskTypeFilter === 'RECITATION' ? 'récitation' : 'leçon'} sélectionnée`}
          subtitle={
            homeworksForDate.length === 0
              ? `Aucune ${taskTypeFilter === 'RECITATION' ? 'récitation' : 'leçon'} programmée pour le ${formatDateFR(date)}.`
              : 'Choisissez une activité dans la liste déroulante.'
          }
        />
      ) : loadingStudents ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des élèves…
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun élève inscrit dans cette classe"
          subtitle="Aucun élève n'est rattaché à cette activité."
        />
      ) : (
        <>
          {/* === Stats summary === */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <SummaryStat
              label="Total"
              value={summary.total}
              color="text-slate-700"
              bg="bg-slate-100"
            />
            <SummaryStat
              label={taskTypeFilter === 'RECITATION' ? 'Réussies' : 'Copiées'}
              value={summary.done}
              color="text-emerald-700"
              bg="bg-emerald-100"
            />
            <SummaryStat
              label={taskTypeFilter === 'RECITATION' ? 'Échouées' : 'Non copiées'}
              value={summary.notDone}
              color="text-rose-700"
              bg="bg-rose-100"
            />
            <SummaryStat
              label="Non évaluées"
              value={summary.pending}
              color="text-slate-600"
              bg="bg-slate-100"
            />
            <SummaryStat
              label="Moy. /20"
              valueDisplay={
                summary.avg != null ? String(summary.avg) : '—'
              }
              color="text-blue-700"
              bg="bg-blue-100"
            />
          </div>

          {/* === Carte d'activité + table === */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">
                    {selectedHw?.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedHw?.class?.name || '—'} •{' '}
                    {selectedHw?.subject?.name || '—'} •{' '}
                    {formatDateFR(selectedHw?.dueDate)}
                    {maxScore ? ` • Noté sur ${maxScore}` : ''}
                  </p>
                </div>
                {selectedHw?.observations && (
                  <p className="text-xs text-slate-600 italic max-w-xs truncate">
                    {selectedHw.observations}
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3">Élève</th>
                    {taskTypeFilter === 'RECITATION' && (
                      <th className="px-4 py-3">Récitation</th>
                    )}
                    {taskTypeFilter === 'LESSON' && (
                      <th className="px-4 py-3">Leçon copiée</th>
                    )}
                    <th className="px-4 py-3">Note /{maxScore}</th>
                    <th className="px-4 py-3">Appréciation</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const draft = drafts[s.id];
                    const currentStatus = draft?.status || s.status || 'PENDING';
                    const currentScore =
                      draft?.score !== undefined && draft?.score !== ''
                        ? draft.score
                        : s.score != null
                        ? String(s.score)
                        : '';
                    const currentApprec =
                      draft?.appreciation ?? s.appreciation ?? '';

                    const recitationBadge = renderRecitationBadge(currentStatus);
                    const lessonBadge = renderLessonBadge(currentStatus);

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
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

                        {taskTypeFilter === 'RECITATION' && (
                          <td className="px-4 py-3">{recitationBadge}</td>
                        )}
                        {taskTypeFilter === 'LESSON' && (
                          <td className="px-4 py-3">{lessonBadge}</td>
                        )}

                        {/* Note */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={maxScore}
                            value={currentScore}
                            onChange={(e) =>
                              setDraft(s.id, { score: e.target.value })
                            }
                            placeholder="—"
                            className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-center"
                          />
                        </td>

                        {/* Appreciation */}
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={currentApprec}
                            onChange={(e) =>
                              setDraft(s.id, { appreciation: e.target.value })
                            }
                            placeholder="Ex: Très bonne récitation"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium min-w-[200px]"
                          />
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3">
                          <select
                            value={currentStatus}
                            onChange={(e) =>
                              setDraft(s.id, { status: e.target.value })
                            }
                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold min-w-[140px]"
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
            </div>
          </div>

          {/* === Barre d'actions === */}
          <div className="sticky bottom-4 flex items-center justify-end gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500">
              {hasDirty
                ? `${Object.keys(drafts).length} modification(s) non enregistrée(s)`
                : 'Toutes les modifications sont enregistrées'}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || !hasDirty}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// HISTORIQUE — vue par Trimestre / Mois / Semaine / Jour
// ============================================================================

function HistoryLessonTracking({
  teacherId,
  academicYearId,
  classes,
}: {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}) {
  const [classId, setClassId] = useState('');
  const [periodKind, setPeriodKind] = useState<PeriodKind>('mois');
  const [anchorDate, setAnchorDate] = useState(formatDateInput(new Date().toISOString()));
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(currentTrimestre(new Date()));
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [studentsByHw, setStudentsByHw] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null);

  // Auto-sélection de la 1re classe
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].classId);
    }
  }, [classes, classId]);

  // === Chargement des homeworks LESSON + RECITATION ===
  const load = useCallback(async () => {
    if (!teacherId || !academicYearId || !classId) {
      setHomeworks([]);
      setStudentsByHw({});
      return;
    }
    setLoading(true);
    try {
      const baseParams = new URLSearchParams({ teacherId, academicYearId, classId });
      const [lessonsData, recitationsData] = await Promise.all([
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks?${baseParams.toString()}&taskType=LESSON`,
        ).catch(() => [] as any[]),
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks?${baseParams.toString()}&taskType=RECITATION`,
        ).catch(() => [] as any[]),
      ]);
      const all = [...(Array.isArray(lessonsData) ? lessonsData : []),
                    ...(Array.isArray(recitationsData) ? recitationsData : [])];
      // Tri par dueDate desc
      all.sort(
        (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
      );
      setHomeworks(all);
      setStudentsByHw({});
      setExpandedHwId(null);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setHomeworks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // === Calcul de la plage ===
  const range = useMemo(() => {
    return computeRange(periodKind, periodKind === 'trimestre' ? undefined : anchorDate, trimestre);
  }, [periodKind, anchorDate, trimestre]);

  // === Filtrer par plage ===
  const filtered = useMemo(() => {
    if (!range) return [];
    return homeworks.filter((hw) => {
      if (!hw.dueDate) return false;
      const d = new Date(hw.dueDate);
      d.setHours(0, 0, 0, 0);
      const from = new Date(range.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(range.to);
      to.setHours(0, 0, 0, 0);
      return d >= from && d <= to;
    });
  }, [homeworks, range]);

  // === Charger les élèves d'un homework (lors de l'expand) ===
  const toggleExpand = async (hw: any) => {
    const hwId = hw.id;
    if (expandedHwId === hwId) {
      setExpandedHwId(null);
      return;
    }
    setExpandedHwId(hwId);
    if (studentsByHw[hwId]) return; // déjà chargé
    setLoadingStudents(hwId);
    try {
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${hwId}/students`,
      );
      setStudentsByHw((prev) => ({ ...prev, [hwId]: Array.isArray(data) ? data : [] }));
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

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Période
          </label>
          <select
            value={periodKind}
            onChange={(e) => setPeriodKind(e.target.value as PeriodKind)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
          >
            <option value="trimestre">Trimestre</option>
            <option value="mois">Mois</option>
            <option value="semaine">Semaine</option>
            <option value="jour">Jour</option>
          </select>
        </div>

        {periodKind === 'trimestre' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Trimestre
            </label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            >
              <option value={1}>T1</option>
              <option value={2}>T2</option>
              <option value={3}>T3</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Date repère
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
            />
          </div>
        )}

        <button
          onClick={load}
          disabled={loading}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Rafraîchir"
          type="button"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* === Plage affichée === */}
      {range && (
        <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
          <span className="font-bold uppercase tracking-widest text-slate-500 mr-2">
            Période :
          </span>
          {formatDateFR(range.from)} → {formatDateFR(range.to)}
          <span className="ml-2 text-slate-400">({filtered.length} activité(s))</span>
        </div>
      )}

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
          subtitle="Sélectionnez une classe pour consulter l'historique."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aucune activité sur cette période"
          subtitle="Aucune leçon ou récitation n'a été enregistrée pour la période sélectionnée."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((hw) => {
            const isExpanded = expandedHwId === hw.id;
            const isRecitation = hw.taskType === 'RECITATION';
            const students = studentsByHw[hw.id] || [];
            const isLoadingThis = loadingStudents === hw.id;
            const Icon = isRecitation ? Mic : BookOpen;
            const doneKey = isRecitation ? 'recited' : 'done';
            const notDoneKey = isRecitation ? 'notRecited' : 'notDone';
            const doneCount = (hw as any)[doneKey] ?? 0;
            const notDoneCount = (hw as any)[notDoneKey] ?? 0;
            const total = hw.totalStudents ?? 0;
            return (
              <div
                key={hw.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(hw)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div
                      className={cn(
                        'p-1.5 rounded-lg flex-shrink-0',
                        isRecitation
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {hw.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isRecitation ? 'Récitation' : 'Leçon à recopier'} •{' '}
                        {hw.class?.name || '—'} • {formatDateFR(hw.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                      {doneCount} {isRecitation ? 'réussie(s)' : 'copiée(s)'}
                    </span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold">
                      {notDoneCount} probl.
                    </span>
                    <span className="text-xs text-slate-400">/ {total}</span>
                  </div>
                </button>

                {/* Expanded: table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    {isLoadingThis ? (
                      <div className="px-5 py-4 flex items-center justify-center text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Chargement des élèves…
                      </div>
                    ) : students.length === 0 ? (
                      <p className="px-5 py-4 text-xs text-slate-400 text-center">
                        Aucun élève inscrit dans cette classe.
                      </p>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <th className="px-4 py-3">Élève</th>
                            <th className="px-4 py-3">Statut</th>
                            <th className="px-4 py-3">Note</th>
                            <th className="px-4 py-3">Appréciation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((s) => {
                            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                            return (
                              <tr
                                key={s.id}
                                className="hover:bg-slate-50/50 transition-colors"
                              >
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
                                  {s.score != null ? (
                                    <span className="font-bold">
                                      {s.score}/{hw.maxScore || 20}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      Non noté
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {s.appreciation || (
                                    <span className="text-xs text-slate-400 italic">
                                      — Aucune —
                                    </span>
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
  );
}

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================

function SummaryStat({
  label,
  value,
  valueDisplay,
  color,
  bg,
}: {
  label: string;
  value?: number;
  valueDisplay?: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200">
      <div
        className={cn(
          'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1.5',
          bg,
          color,
        )}
      >
        {label}
      </div>
      <p className="text-xl font-bold text-slate-900">
        {valueDisplay !== undefined ? valueDisplay : value}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-xl border border-slate-200 border-dashed">
      <Icon className="w-10 h-10 text-slate-200" />
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS — badges dérivés
// ============================================================================

function renderRecitationBadge(status: string) {
  // RECITED → vert, NOT_RECITED → rouge, autres → gris
  let cfg: { label: string; cls: string; icon: any };
  if (status === 'RECITED') {
    cfg = { label: 'Réussie', cls: 'bg-emerald-100 text-emerald-700', icon: Check };
  } else if (status === 'NOT_RECITED') {
    cfg = { label: 'Échouée', cls: 'bg-rose-100 text-rose-700', icon: X };
  } else if (status === 'LATE') {
    cfg = { label: 'En retard', cls: 'bg-orange-100 text-orange-700', icon: Clock };
  } else if (status === 'TO_REDO') {
    cfg = {
      label: 'À refaire',
      cls: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
    };
  } else {
    cfg = {
      label: 'Non évaluée',
      cls: 'bg-slate-100 text-slate-500',
      icon: Clock,
    };
  }
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
        cfg.cls,
      )}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function renderLessonBadge(status: string) {
  // DONE → vert, NOT_DONE → rouge, INCOMPLETE → orange, TO_REDO → orange
  let cfg: { label: string; cls: string; icon: any };
  if (status === 'DONE') {
    cfg = { label: 'Copiée', cls: 'bg-emerald-100 text-emerald-700', icon: Check };
  } else if (status === 'NOT_DONE') {
    cfg = { label: 'Non copiée', cls: 'bg-rose-100 text-rose-700', icon: X };
  } else if (status === 'INCOMPLETE') {
    cfg = {
      label: 'Partielle',
      cls: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
    };
  } else if (status === 'TO_REDO') {
    cfg = {
      label: 'À refaire',
      cls: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle,
    };
  } else {
    cfg = {
      label: 'Non vérifiée',
      cls: 'bg-slate-100 text-slate-500',
      icon: Clock,
    };
  }
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase',
        cfg.cls,
      )}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ============================================================================
// HELPERS — calcul de plages de dates
// ============================================================================

function currentTrimestre(d: Date): 1 | 2 | 3 {
  const m = d.getMonth(); // 0-11
  if (m >= 8) return 1; // Sep-Dec → T1
  if (m <= 2) return 2; // Jan-Mar → T2
  return 3; // Apr-Aug → T3
}

function computeRange(
  kind: PeriodKind,
  anchor?: string,
  trimestre?: 1 | 2 | 3,
): { from: string; to: string } | null {
  const today = anchor ? new Date(anchor) : new Date();
  if (isNaN(today.getTime())) return null;

  if (kind === 'trimestre') {
    const year = today.getFullYear();
    const t = trimestre || 1;
    if (t === 1) {
      return {
        from: new Date(year, 8, 1).toISOString(),
        to: new Date(year, 11, 31, 23, 59, 59).toISOString(),
      };
    }
    if (t === 2) {
      return {
        from: new Date(year, 0, 1).toISOString(),
        to: new Date(year, 2, 31, 23, 59, 59).toISOString(),
      };
    }
    return {
      from: new Date(year, 3, 1).toISOString(),
      to: new Date(year, 7, 31, 23, 59, 59).toISOString(),
    };
  }

  if (kind === 'mois') {
    const y = today.getFullYear();
    const m = today.getMonth();
    return {
      from: new Date(y, m, 1).toISOString(),
      to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
    };
  }

  if (kind === 'semaine') {
    const day = today.getDay();
    const offsetToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - offsetToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday.toISOString(), to: sunday.toISOString() };
  }

  // jour
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { from: d.toISOString(), to: end.toISOString() };
}
