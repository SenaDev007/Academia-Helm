'use client';

/**
 * ============================================================================
 * NOTEBOOKS CHECKS TAB — Contrôle des cahiers (leçons à recopier)
 * ============================================================================
 *
 * Utilise GET /api/pedagogy-space/notebook-checks qui retourne :
 *   [{ homework: { id, title, description, dueDate, class, subject, observations },
 *      students: [{ id, studentId, firstName, lastName, matricule, photoUrl,
 *                   status (DONE/NOT_DONE/INCOMPLETE/TO_REDO/PENDING),
 *                   observation, appreciation, evaluatedAt }] }]
 *
 * Permet de mettre à jour le statut d'un élève via
 * PUT /api/pedagogy-space/task-students/:id (status, observation, appreciation)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, NotebookPen, CheckCircle, XCircle,
  AlertTriangle, RotateCcw, Clock,
} from 'lucide-react';
import {
  apiFetch, STATUS_CONFIG, formatDateFR,
} from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

interface NotebooksChecksTabProps {
  teacherId: string;
  academicYearId: string;
  schoolLevelId: string;
  classes: any[];
}

// Statuts pertinents pour les cahiers & copies (leçons à recopier)
const NOTEBOOK_STATUSES = ['PENDING', 'DONE', 'NOT_DONE', 'INCOMPLETE', 'TO_REDO'];

export function NotebooksChecksTab({
  teacherId,
  academicYearId,
  classes,
}: NotebooksChecksTabProps) {
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [observationDraft, setObservationDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId });
      if (filterClassId) params.append('classId', filterClassId);
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/notebook-checks?${params.toString()}`,
      );
      setChecks(Array.isArray(data) ? data : []);
      setObservationDraft({});
    } catch (e: any) {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, filterClassId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (student: any, newStatus: string) => {
    setUpdating(student.id);
    try {
      await apiFetch(`/api/pedagogy-space/task-students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          observation: student.observation || undefined,
          appreciation: student.appreciation || undefined,
          score: student.score ?? undefined,
        }),
      });
      toast.success('Statut cahier mis à jour.');
      // Mettre à jour localement
      setChecks((prev) =>
        prev.map((item) => ({
          ...item,
          students: (item.students || []).map((s: any) =>
            s.id === student.id ? { ...s, status: newStatus } : s,
          ),
        })),
      );
    } catch (e: any) {
      toast.error('Erreur lors de la mise à jour', { description: e.message });
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveObservation = async (student: any) => {
    const newObs = observationDraft[student.id] ?? student.observation ?? '';
    setUpdating(student.id);
    try {
      await apiFetch(`/api/pedagogy-space/task-students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: student.status,
          observation: newObs || undefined,
          appreciation: student.appreciation || undefined,
          score: student.score ?? undefined,
        }),
      });
      toast.success('Observation enregistrée.');
      setObservationDraft((prev) => ({ ...prev, [student.id]: '' }));
      setChecks((prev) =>
        prev.map((item) => ({
          ...item,
          students: (item.students || []).map((s: any) =>
            s.id === student.id ? { ...s, observation: newObs } : s,
          ),
        })),
      );
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e.message });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* === En-tête + filtres === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-blue-700" />
            Contrôle des cahiers & copies
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Vérifiez que chaque élève a recopié ses leçons et laissez un commentaire.
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement des contrôles…
        </div>
      ) : checks.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <NotebookPen className="w-10 h-10 text-slate-200" />
          <p className="text-sm font-semibold text-slate-400">
            Aucune leçon à recopier enregistrée
          </p>
          <p className="text-xs text-slate-300">
            Créez une activité de type « Leçon à recopier » dans l'onglet
            Leçons & Récitations pour démarrer le contrôle des cahiers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {checks.map((item) => (
            <div
              key={item.homework.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Header de la leçon */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {item.homework.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.homework.class?.name || '—'} •{' '}
                      {item.homework.subject?.name || '—'} •{' '}
                      {formatDateFR(item.homework.dueDate)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {item.students?.length || 0} élève(s)
                  </span>
                </div>
                {item.homework.observations && (
                  <p className="text-xs text-slate-600 mt-1 italic">
                    {item.homework.observations}
                  </p>
                )}
              </div>

              {/* Table des élèves */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="px-4 py-3">Élève</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Observation</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(item.students || []).map((s: any) => {
                      const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {s.lastName} {s.firstName}
                            </p>
                            {s.matricule && (
                              <p className="text-xs text-slate-400">
                                Mat: {s.matricule}
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
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              defaultValue={
                                observationDraft[s.id] ?? s.observation ?? ''
                              }
                              onChange={(e) =>
                                setObservationDraft((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                              placeholder="Ex: Cahier bien tenu"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <select
                                value={s.status}
                                onChange={(e) =>
                                  handleStatusChange(s, e.target.value)
                                }
                                disabled={updating === s.id}
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                              >
                                {NOTEBOOK_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {STATUS_CONFIG[st]?.label || st}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleSaveObservation(s)}
                                disabled={updating === s.id}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors"
                                title="Enregistrer l'observation"
                              >
                                {updating === s.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  'OK'
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
