'use client';

/**
 * ============================================================================
 * STUDENT ENGAGEMENT TAB — Suivi par élève (agrégation)
 * ============================================================================
 *
 * Utilise GET /api/pedagogy-space/student-engagement?teacherId&academicYearId&classId?
 * qui retourne pour chaque élève :
 *   { studentId, firstName, lastName, matricule, photoUrl, gender,
 *     totalTasks, done, notDone, pending, late, incomplete, toRedo,
 *     recited, notRecited, presented, notPresented,
 *     participationRate, averageScore, alerts: string[] }
 *
 * Affichage en table avec :
 *   - barre de progression participation
 *   - score moyen
 *   - alertes (PARTICIPATION_FAIBLE, MOYENNE_FAIBLE, TACHES_NON_RENDUES)
 *   - bouton "Notifier parent" pour les élèves à risque (placeholder — action
 *     à implémenter dans une prochaine phase)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { apiFetch } from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

interface StudentEngagementTabProps {
  teacherId: string;
  academicYearId: string;
  classes: any[];
}

export function StudentEngagementTab({
  teacherId,
  academicYearId,
  classes,
}: StudentEngagementTabProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacherId, academicYearId });
      if (filterClassId) params.append('classId', filterClassId);
      const data = await apiFetch<any[]>(
        `/api/pedagogy-space/student-engagement?${params.toString()}`,
      );
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId, filterClassId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) ||
        (s.matricule || '').toLowerCase().includes(q),
    );
  }, [students, search]);

  return (
    <div className="space-y-4">
      {/* === En-tête + filtres === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Engagement pédagogique par élève
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Agrégation des activités — participation, scores et alertes
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
            placeholder="Rechercher un élève…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
          />
          <button
            onClick={load}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* === Table === */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <Users className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">
              Aucun élève à suivre
            </p>
            <p className="text-xs text-slate-300">
              Les élèves apparaîtront ici dès qu'une activité leur sera assignée.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-4 py-3">Élève</th>
                  <th className="px-4 py-3">Total / Fait</th>
                  <th className="px-4 py-3">Participation</th>
                  <th className="px-4 py-3">Moyenne</th>
                  <th className="px-4 py-3">Alertes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const participation = s.participationRate ?? 0;
                  const score = s.averageScore ?? null;
                  const isAtRisk = (s.alerts || []).length > 0;
                  return (
                    <tr
                      key={s.studentId}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">
                          {s.lastName} {s.firstName}
                        </p>
                        {s.matricule && (
                          <p className="text-xs text-slate-400">
                            Mat: {s.matricule}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <span className="font-semibold">{s.done || 0}</span>
                        <span className="text-slate-400"> / {s.totalTasks || 0}</span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {s.late > 0 && (
                            <span className="mr-2 text-orange-700">
                              {s.late} retard
                            </span>
                          )}
                          {s.notDone > 0 && (
                            <span className="text-rose-700">
                              {s.notDone} non fait
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                participation < 40
                                  ? 'bg-rose-500'
                                  : participation < 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500',
                              )}
                              style={{ width: `${Math.min(participation, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 min-w-[35px]">
                            {participation}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {score != null ? (
                          <span
                            className={cn(
                              'text-sm font-bold',
                              score < 10
                                ? 'text-rose-700'
                                : score < 14
                                ? 'text-amber-700'
                                : 'text-emerald-700',
                            )}
                          >
                            {score}/20
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Non noté</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAtRisk ? (
                          <div className="flex flex-wrap gap-1">
                            {(s.alerts || []).map((a: string) => (
                              <span
                                key={a}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-semibold rounded"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {humanizeAlert(a)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">R.A.S</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function humanizeAlert(code: string): string {
  switch (code) {
    case 'PARTICIPATION_FAIBLE':
      return 'Participation faible';
    case 'MOYENNE_FAIBLE':
      return 'Moyenne faible';
    case 'TACHES_NON_RENDUES':
      return 'Tâches non rendues';
    default:
      return code.replace(/_/g, ' ').toLowerCase();
  }
}
