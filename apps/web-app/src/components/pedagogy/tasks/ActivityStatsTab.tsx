'use client';

/**
 * ============================================================================
 * ACTIVITY STATS TAB — Statistiques & alertes globales
 * ============================================================================
 *
 * Utilise GET /api/pedagogy-space/activity-stats?teacherId&academicYearId qui
 * retourne :
 *   { totalTasks, totalStudents, totalDone, totalPending, totalLate,
 *     totalNotDone, averageParticipation, averageScore,
 *     studentsAtRiskCount, studentsAtRisk: [{ studentId, firstName, lastName,
 *       participationRate, averageScore, alerts }],
 *     tasksByType: { HOMEWORK: n, RESEARCH: n, ... },
 *     tasksByStatus: { ASSIGNED: n, COMPLETED: n, ... } }
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, AlertTriangle, BarChart3,
  ClipboardList, Users, Clock, XCircle, CheckCircle2,
} from 'lucide-react';
import { apiFetch } from './TeacherTasksWorkspace';
import { cn } from '@/lib/utils';

interface ActivityStatsTabProps {
  teacherId: string;
  academicYearId: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  HOMEWORK: 'Devoirs & exercices',
  RESEARCH: 'Recherches & exposés',
  LESSON: 'Leçons à recopier',
  RECITATION: 'Récitations',
  PRACTICAL: 'Activités pratiques',
  PROJECT: 'Projets',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ASSIGNED: 'Assigné',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

export function ActivityStatsTab({
  teacherId,
  academicYearId,
}: ActivityStatsTabProps) {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(
        `/api/pedagogy-space/activity-stats?teacherId=${encodeURIComponent(teacherId)}&academicYearId=${encodeURIComponent(academicYearId)}`,
      );
      setStats(data);
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e.message });
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYearId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement des statistiques…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
        <BarChart3 className="w-10 h-10 text-slate-200" />
        <p className="text-sm font-semibold text-slate-400">
          Aucune statistique disponible
        </p>
        <p className="text-xs text-slate-300">
          Créez des activités pour générer des statistiques.
        </p>
      </div>
    );
  }

  const participation = stats.averageParticipation ?? 0;
  const avgScore = stats.averageScore ?? null;
  const tasksByType = stats.tasksByType || {};
  const tasksByStatus = stats.tasksByStatus || {};
  const studentsAtRisk = stats.studentsAtRisk || [];

  return (
    <div className="space-y-5">
      {/* === En-tête === */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-700" />
            Statistiques d'engagement & alertes
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Vue d'ensemble de votre activité pédagogique
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* === KPIs globaux (4 cartes) === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Activités totales"
          value={String(stats.totalTasks ?? 0)}
          icon={ClipboardList}
          color="text-slate-700"
          bg="bg-slate-100"
        />
        <KpiCard
          label="Élèves concernés"
          value={String(stats.totalStudents ?? 0)}
          icon={Users}
          color="text-blue-700"
          bg="bg-blue-100"
        />
        <KpiCard
          label="Participation moyenne"
          value={`${participation}%`}
          icon={CheckCircle2}
          color="text-emerald-700"
          bg="bg-emerald-100"
        />
        <KpiCard
          label="Score moyen"
          value={avgScore != null ? `${avgScore}/20` : '—'}
          icon={BarChart3}
          color="text-purple-700"
          bg="bg-purple-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* === Détail par statut === */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-900">Détail par statut</h4>
          </div>
          <div className="p-5 space-y-3">
            <StatRow
              icon={CheckCircle2}
              color="text-emerald-700"
              bg="bg-emerald-50"
              label="Faits / Terminés"
              value={stats.totalDone ?? 0}
            />
            <StatRow
              icon={Clock}
              color="text-amber-700"
              bg="bg-amber-50"
              label="En attente"
              value={stats.totalPending ?? 0}
            />
            <StatRow
              icon={Clock}
              color="text-orange-700"
              bg="bg-orange-50"
              label="En retard"
              value={stats.totalLate ?? 0}
            />
            <StatRow
              icon={XCircle}
              color="text-rose-700"
              bg="bg-rose-50"
              label="Non faits"
              value={stats.totalNotDone ?? 0}
            />
          </div>
        </div>

        {/* === Répartition par type d'activité === */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-900">
              Répartition par type d'activité
            </h4>
          </div>
          <div className="p-5 space-y-2">
            {Object.keys(tasksByType).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                Aucune activité enregistrée.
              </p>
            ) : (
              Object.entries(tasksByType).map(([type, count]) => {
                const total = stats.totalTasks || 1;
                const pct = Math.round(((count as number) / total) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {TASK_TYPE_LABELS[type] || type}
                      </span>
                      <span className="text-slate-500">
                        {count as number} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-700 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* === Élèves à risque === */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Élèves à risque ({stats.studentsAtRiskCount ?? 0})
          </h4>
        </div>
        {studentsAtRisk.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-300" />
            <p className="text-sm font-semibold text-slate-400">
              Aucun élève à risque
            </p>
            <p className="text-xs text-slate-300">
              Tous vos élèves suivent correctement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0">
                  <th className="px-4 py-3">Élève</th>
                  <th className="px-4 py-3">Participation</th>
                  <th className="px-4 py-3">Moyenne</th>
                  <th className="px-4 py-3">Alertes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentsAtRisk.map((s: any) => (
                  <tr key={s.studentId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">
                        {s.lastName} {s.firstName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-rose-700">
                      {s.participationRate}%
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {s.averageScore != null ? `${s.averageScore}/20` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.alerts || []).map((a: string) => (
                          <span
                            key={a}
                            className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-semibold rounded"
                          >
                            {humanizeAlert(a)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
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
          'p-2 w-9 h-9 rounded-lg mb-2 flex items-center justify-center',
          bg,
          color,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{value}</h3>
    </div>
  );
}

function StatRow({
  icon: Icon,
  color,
  bg,
  label,
  value,
}: {
  icon: any;
  color: string;
  bg: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'p-1.5 w-7 h-7 rounded-md flex items-center justify-center',
          bg,
          color,
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm text-slate-700 flex-1">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
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
