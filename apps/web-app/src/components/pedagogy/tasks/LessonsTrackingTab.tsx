'use client';

/**
 * ============================================================================
 * LESSONS TRACKING TAB — Leçons à recopier + Récitations
 * ============================================================================
 *
 * Affiche deux sections :
 *   1. Récitations (homeworks avec taskType=RECITATION) + statut par élève
 *      (RECITED / NOT_RECITED / PENDING / LATE / TO_REDO)
 *   2. Leçons à recopier (homeworks avec taskType=LESSON) + statut par élève
 *      (DONE / NOT_DONE / INCOMPLETE / TO_REDO / PENDING)
 *
 * Pour chaque devoir, on charge la liste des élèves via
 * GET /api/pedagogy-space/homeworks/:id/students et on permet de mettre à
 * jour le statut d'un élève via PUT /api/pedagogy-space/task-students/:id.
 *
 * Bouton "Créer une leçon / récitation" → ouvre le HomeworkFormModal du parent
 * (avec taskType=LESSON par défaut, l'utilisateur peut changer pour
 * RECITATION dans le select du modal).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Plus, RefreshCw, Mic, BookOpen, Edit,
} from 'lucide-react';
import {
  apiFetch, STATUS_CONFIG, STATUS_BY_TASK_TYPE,
  formatDateFR, TASK_TYPES,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

interface LessonsTrackingTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
  onCreate: () => void;
  onEdit: (hw: any) => void;
}

export function LessonsTrackingTab({
  teacherId,
  academicYearId,
  classes,
  onCreate,
  onEdit,
}: LessonsTrackingTabProps) {
  const [recitations, setRecitations] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const baseParams = new URLSearchParams({
        teacherId,
        academicYearId,
      });
      if (filterClassId) baseParams.append('classId', filterClassId);

      const [recitationsData, lessonsData] = await Promise.all([
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks?${baseParams.toString()}&taskType=RECITATION`,
        ).catch(() => [] as any[]),
        apiFetch<any[]>(
          `/api/pedagogy-space/homeworks?${baseParams.toString()}&taskType=LESSON`,
        ).catch(() => [] as any[]),
      ]);
      setRecitations(Array.isArray(recitationsData) ? recitationsData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, filterClassId]);

  useEffect(() => {
    load();
  }, [load]);

  // Mettre à jour le statut d'un élève pour un devoir
  const handleStatusChange = async (
    student: any,
    newStatus: string,
    list: 'recitation' | 'lesson',
  ) => {
    setUpdating(student.id);
    try {
      await apiFetch(`/api/pedagogy-space/task-students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          score: student.score ?? undefined,
          appreciation: student.appreciation ?? undefined,
          observation: student.observation ?? undefined,
        }),
      });
      toast.success('Statut mis à jour.');
      // Pas besoin de recharger toute la liste — l'expand mettra à jour son état local
      // Mais on force le reload des expand pour avoir les bonnes stats
      if (list === 'recitation') {
        setRecitations((prev) =>
          prev.map((hw) =>
            hw._studentsExpanded
              ? {
                  ...hw,
                  _students: hw._students.map((s: any) =>
                    s.id === student.id ? { ...s, status: newStatus } : s,
                  ),
                }
              : hw,
          ),
        );
      } else {
        setLessons((prev) =>
          prev.map((hw) =>
            hw._studentsExpanded
              ? {
                  ...hw,
                  _students: hw._students.map((s: any) =>
                    s.id === student.id ? { ...s, status: newStatus } : s,
                  ),
                }
              : hw,
          ),
        );
      }
    } catch (e: any) {
      toast.error('Erreur lors de la mise à jour', { description: e.message });
    } finally {
      setUpdating(null);
    }
  };

  // Charger les élèves d'un devoir (lors de l'expand)
  const toggleExpand = async (hw: any, list: 'recitation' | 'lesson') => {
    const isExpanded = !!hw._studentsExpanded;
    if (isExpanded) {
      // Collapse
      const { _students, _studentsExpanded, ...rest } = hw;
      void _students; void _studentsExpanded;
      if (list === 'recitation') {
        setRecitations((prev) => prev.map((h) => (h.id === hw.id ? rest : h)));
      } else {
        setLessons((prev) => prev.map((h) => (h.id === hw.id ? rest : h)));
      }
      return;
    }
    // Expand : charger les élèves
    try {
      const students = await apiFetch<any[]>(
        `/api/pedagogy-space/homeworks/${hw.id}/students`,
      );
      const newHw = { ...hw, _studentsExpanded: true, _students: students };
      if (list === 'recitation') {
        setRecitations((prev) => prev.map((h) => (h.id === hw.id ? newHw : h)));
      } else {
        setLessons((prev) => prev.map((h) => (h.id === hw.id ? newHw : h)));
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement des élèves', {
        description: e.message,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* === En-tête + filtres === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Leçons & Récitations
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Suivi du statut par élève (récitée / copiée / à refaire…)
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
            Nouvelle activité
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LessonSection
            title="Suivi des Récitations"
            icon={Mic}
            iconColor="text-purple-700"
            iconBg="bg-purple-100"
            homeworks={recitations}
            taskType="RECITATION"
            onToggleExpand={(hw) => toggleExpand(hw, 'recitation')}
            onStatusChange={(s, newStatus) =>
              handleStatusChange(s, newStatus, 'recitation')
            }
            onEdit={onEdit}
            updating={updating}
          />
          <LessonSection
            title="Leçons à Recopier"
            icon={BookOpen}
            iconColor="text-blue-700"
            iconBg="bg-blue-100"
            homeworks={lessons}
            taskType="LESSON"
            onToggleExpand={(hw) => toggleExpand(hw, 'lesson')}
            onStatusChange={(s, newStatus) =>
              handleStatusChange(s, newStatus, 'lesson')
            }
            onEdit={onEdit}
            updating={updating}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION — Une carte avec liste de homeworks + expand élève par élève
// ============================================================================

function LessonSection({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  homeworks,
  taskType,
  onToggleExpand,
  onStatusChange,
  onEdit,
  updating,
}: {
  title: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  homeworks: any[];
  taskType: string;
  onToggleExpand: (hw: any) => void;
  onStatusChange: (student: any, newStatus: string) => void;
  onEdit: (hw: any) => void;
  updating: string | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <div
            className={cn(
              'p-1.5 rounded-lg',
              iconBg,
              iconColor,
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
          {title}
        </h4>
        <span className="text-xs font-semibold text-slate-400">
          {homeworks.length} activité(s)
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {homeworks.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
            <Icon className="w-8 h-8 text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">
              Aucune activité
            </p>
            <p className="text-xs text-slate-300">
              Créez une activité pour commencer le suivi.
            </p>
          </div>
        ) : (
          homeworks.map((hw) => {
            const expanded = !!hw._studentsExpanded;
            const students: any[] = hw._students || [];
            const statusOptions = STATUS_BY_TASK_TYPE[taskType] || STATUS_BY_TASK_TYPE.HOMEWORK;
            const doneKey = taskType === 'RECITATION' ? 'recited' : 'done';
            const notDoneKey = taskType === 'RECITATION' ? 'notRecited' : 'notDone';
            const doneCount = hw[doneKey] ?? 0;
            const notDoneCount = hw[notDoneKey] ?? 0;
            const total = hw.totalStudents ?? 0;
            return (
              <div key={hw.id}>
                {/* Header de ligne */}
                <div
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => onToggleExpand(hw)}
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-slate-900 text-sm">
                      {hw.title}
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {hw.class?.name || '—'} • {formatDateFR(hw.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                      {doneCount} {taskType === 'RECITATION' ? 'récitée(s)' : 'copiée(s)'}
                    </span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold">
                      {notDoneCount} à faire
                    </span>
                    <span className="text-xs text-slate-400">/ {total}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(hw);
                    }}
                    className="ml-3 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Expand : liste des élèves */}
                {expanded && (
                  <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100">
                    {students.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Aucun élève inscrit dans cette classe.
                      </p>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-bold text-slate-400 uppercase">
                            <th className="pb-2">Élève</th>
                            <th className="pb-2">Statut</th>
                            <th className="pb-2 text-right">Changer en</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((s) => {
                            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                            return (
                              <tr key={s.id}>
                                <td className="py-2 text-sm font-semibold text-slate-900">
                                  {s.student?.lastName} {s.student?.firstName}
                                </td>
                                <td className="py-2">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                                      cfg.color,
                                    )}
                                  >
                                    <cfg.icon className="w-3 h-3" />
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <select
                                    value={s.status}
                                    onChange={(e) =>
                                      onStatusChange(s, e.target.value)
                                    }
                                    disabled={updating === s.id}
                                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
