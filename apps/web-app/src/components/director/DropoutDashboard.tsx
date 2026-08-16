/**
 * ============================================================================
 * DROPOUT DASHBOARD — Indicateur de décrochage scolaire
 * ============================================================================
 *
 * Vue dédiée au suivi du décrochage pour le Directeur et le SG.
 * Affiche :
 *   - Statistiques agrégées (taux de décrochage, répartition par sévérité)
 *   - Tendance inter-trimestres (évolution du taux de décrochage)
 *   - Liste des élèves en décrochage avec raisons détaillées
 *
 * Un élève est "en décrochage" si son score de risque a une dégradation
 * significative vs trimestre précédent, OU si son taux d'absence > 15%,
 * OU si sa conduite a chuté de 5+ points.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  TrendingDown, AlertTriangle, Users, Loader2, Activity, ArrowDownRight,
} from 'lucide-react';
import { useDropoutStudents, useDropoutStats, useDropoutTrends } from '@/hooks/useRiskScore';

const RISK_COLORS = {
  LOW: 'bg-green-100 text-green-700 border-green-300',
  MODERATE: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
};

export default function DropoutDashboard({
  tenant, academicYear, quarterId,
}: {
  tenant?: any;
  academicYear?: any;
  quarterId?: string;
}) {
  const [classFilter, setClassFilter] = useState<string>('');

  const tenantId = tenant?.id || tenant?.tenantId;
  const academicYearId = academicYear?.id || academicYear?.academicYearId;
  const effectiveQuarterId = quarterId || academicYear?.activeQuarterId;

  const { stats, isLoading: statsLoading } = useDropoutStats({
    tenantId, academicYearId, quarterId: effectiveQuarterId,
  });

  const { students, isLoading: studentsLoading } = useDropoutStudents({
    tenantId, academicYearId, quarterId: effectiveQuarterId,
    classId: classFilter || undefined,
  });

  const { trends, isLoading: trendsLoading } = useDropoutTrends({
    tenantId, academicYearId,
  });

  if (!tenantId || !academicYearId || !effectiveQuarterId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Sélectionnez une année scolaire et un trimestre pour visualiser le décrochage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <TrendingDown className="w-6 h-6" />
          Indicateur de Décrochage
        </h2>
        <p className="text-purple-100 text-sm mt-1">
          Élèves en dégradation (conduite ↓ + absences ↑ + retards) — calibré sur les seuils de l'école
        </p>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <div className="p-8 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-600" /></div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total élèves"
            value={stats.totalStudents}
            icon={Users}
            color="bg-blue-50 text-blue-700 border-blue-200"
          />
          <StatCard
            label="En décrochage"
            value={stats.dropoutCount}
            icon={TrendingDown}
            color="bg-purple-50 text-purple-700 border-purple-200"
          />
          <StatCard
            label="Taux décrochage"
            value={`${stats.dropoutRate.toFixed(1)}%`}
            icon={AlertTriangle}
            color="bg-orange-50 text-orange-700 border-orange-200"
          />
          <StatCard
            label="Dégradation moy."
            value={`${stats.avgScoreDelta.toFixed(1)} pts`}
            icon={ArrowDownRight}
            color="bg-red-50 text-red-700 border-red-200"
          />
        </div>
      ) : null}

      {/* Tendance inter-trimestres */}
      {trendsLoading ? (
        <div className="p-4 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-purple-600" /></div>
      ) : trends.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Évolution du décrochage par trimestre
          </h3>
          <div className="space-y-3">
            {trends.map(t => (
              <div key={t.quarterId} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium text-gray-700">{t.quarterName}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600"
                        style={{ width: `${Math.min(100, t.dropoutRate)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold text-gray-700">
                        {t.dropoutCount}/{t.totalStudents} ({t.dropoutRate.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Score moyen: {t.averages.total.toFixed(1)} | Conduite: {t.averages.conduct.toFixed(1)} | Pédagogie: {t.averages.pedagogy.toFixed(1)} | Assiduité: {t.averages.attendance.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filtre classe */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrer par classe :</span>
          <input
            type="text"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            placeholder="ID classe (optionnel)"
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-64"
          />
          {classFilter && (
            <button
              onClick={() => setClassFilter('')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ✕ Effacer
            </button>
          )}
        </div>
      </div>

      {/* Liste des élèves en décrochage */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-purple-50">
          <h3 className="font-semibold text-purple-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Élèves en décrochage ({students.length})
          </h3>
        </div>
        {studentsLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-600" /></div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun élève en décrochage sur ce trimestre. 🎉</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Élève</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Classe</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Score</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Niveau</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Δ vs N-1</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Raisons du décrochage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.slice(0, 50).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{s.studentName}</div>
                      <div className="text-xs text-gray-500">{s.studentMatricule}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{s.className}</td>
                    <td className="px-4 py-2 text-center font-bold text-gray-900">{s.totalScore?.toFixed(1)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${RISK_COLORS[s.riskLevel] || RISK_COLORS.MODERATE}`}>
                        {s.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {s.scoreDelta !== undefined && s.scoreDelta !== null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          <ArrowDownRight className="w-3 h-3" />
                          {Math.abs(s.scoreDelta).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <ul className="space-y-0.5">
                        {(s.dropoutReasons || []).map((reason, i) => (
                          <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1">
                            <span className="text-purple-500 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length > 50 && (
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t">
                Affichage des 50 premiers élèves sur {students.length}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: any; icon: any; color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs font-medium opacity-80">{label}</div>
        </div>
        <Icon className="w-8 h-8 opacity-50" />
      </div>
    </div>
  );
}
