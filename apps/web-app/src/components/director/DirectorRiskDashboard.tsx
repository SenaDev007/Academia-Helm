/**
 * ============================================================================
 * DIRECTOR RISK DASHBOARD — Tableau de bord Score de Risque
 * ============================================================================
 *
 * Vue globale du Directeur croisant 3 signaux par élève :
 *   1. Conduite (Vie Scolaire)
 *   2. Pédagogie (Censeur)
 *   3. Assiduité (Présences)
 *
 * Différenciateur marché : aucun concurrent béninois ne croise ces données.
 * ============================================================================
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Activity, AlertTriangle, TrendingDown, TrendingUp, RefreshCw,
  Users, Shield, BookOpen, CalendarX, Loader2, Settings,
} from 'lucide-react';
import { useRiskScoreStudents, useRiskScoreDashboard, useRecalculateRiskScores, useRiskScoreSettings } from '@/hooks/useRiskScore';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const RISK_LEVEL_CONFIG = {
  LOW: { label: 'Faible', color: 'bg-green-100 text-green-700 border-green-300', bar: 'bg-green-500', icon: '✓' },
  MODERATE: { label: 'Moyen', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', bar: 'bg-yellow-500', icon: '⚠' },
  HIGH: { label: 'Élevé', color: 'bg-orange-100 text-orange-700 border-orange-300', bar: 'bg-orange-500', icon: '⚠' },
  CRITICAL: { label: 'Critique', color: 'bg-red-100 text-red-700 border-red-300', bar: 'bg-red-500', icon: '✕' },
};

export default function DirectorRiskDashboard({
  tenant, academicYear, quarterId,
}: {
  tenant?: any;
  academicYear?: any;
  quarterId?: string;
}) {
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'>('ALL');
  const [dropoutOnly, setDropoutOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const tenantId = tenant?.id || tenant?.tenantId;
  const academicYearId = academicYear?.id || academicYear?.academicYearId;
  const effectiveQuarterId = quarterId || academicYear?.activeQuarterId;

  const { dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useRiskScoreDashboard({
    tenantId, academicYearId, quarterId: effectiveQuarterId,
  });

  const { scores, isLoading: scoresLoading } = useRiskScoreStudents({
    tenantId, academicYearId, quarterId: effectiveQuarterId,
    riskLevel: riskFilter === 'ALL' ? undefined : riskFilter,
    dropoutOnly,
  });

  const { recalculate, isRecalculating } = useRecalculateRiskScores();

  const handleRecalculate = async () => {
    if (!tenantId || !academicYearId || !effectiveQuarterId) return;
    try {
      const result = await recalculate({ tenantId, academicYearId, quarterId: effectiveQuarterId });
      console.log('Recalculate result:', result);
      refetchDashboard();
    } catch (err) {
      console.error('Recalculate failed:', err);
    }
  };

  if (!tenantId || !academicYearId || !effectiveQuarterId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Sélectionnez une année scolaire et un trimestre pour visualiser les scores de risque.</p>
      </div>
    );
  }

  if (dashboardLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-gray-600">Chargement du tableau de bord…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Score de Risque Élève
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Croisement conduite (SG) + pédagogie (Censeur) + assiduité — vue stratégique Direction
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Settings className="w-4 h-4 mr-2" /> Configurer
            </Button>
            <Button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              {isRecalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Recalculer
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total élèves"
            value={dashboard.total}
            icon={Users}
            color="bg-blue-50 text-blue-700 border-blue-200"
          />
          <StatCard
            label="Risque élevé"
            value={dashboard.byLevel.HIGH + dashboard.byLevel.CRITICAL}
            icon={AlertTriangle}
            color="bg-orange-50 text-orange-700 border-orange-200"
          />
          <StatCard
            label="Risque critique"
            value={dashboard.byLevel.CRITICAL}
            icon={AlertTriangle}
            color="bg-red-50 text-red-700 border-red-200"
          />
          <StatCard
            label="Décrochage"
            value={dashboard.dropoutCount}
            icon={TrendingDown}
            color="bg-purple-50 text-purple-700 border-purple-200"
          />
        </div>
      )}

      {/* Distribution par niveau */}
      {dashboard && dashboard.total > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Distribution des scores
          </h3>
          <div className="space-y-3">
            {(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const).map(level => {
              const count = dashboard.byLevel[level];
              const pct = dashboard.total > 0 ? (count / dashboard.total) * 100 : 0;
              const config = RISK_LEVEL_CONFIG[level];
              return (
                <div key={level} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700">{config.label}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${config.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-gray-900">
                    {count} ({pct.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <AvgDisplay label="Conduite" value={dashboard.averages.conduct} icon={Shield} color="text-red-600" />
            <AvgDisplay label="Pédagogie" value={dashboard.averages.pedagogy} icon={BookOpen} color="text-blue-600" />
            <AvgDisplay label="Assiduité" value={dashboard.averages.attendance} icon={CalendarX} color="text-orange-600" />
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && <SettingsPanel tenantId={tenantId!} />}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrer :</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as any)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
          >
            <option value="ALL">Tous les niveaux</option>
            <option value="LOW">Faible</option>
            <option value="MODERATE">Moyen</option>
            <option value="HIGH">Élevé</option>
            <option value="CRITICAL">Critique</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={dropoutOnly}
              onChange={(e) => setDropoutOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <TrendingDown className="w-4 h-4 text-purple-600" />
            Décrochage seulement
          </label>
        </div>
      </div>

      {/* Students table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            Élèves à risque ({scores.length})
          </h3>
        </div>
        {scoresLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-600" />
          </div>
        ) : scores.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun élève avec ce filtre. Lancez un recalcul si nécessaire.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Élève</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Classe</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Conduite</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Pédagogie</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Assiduité</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Score total</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Niveau</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Décrochage</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Tendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scores.slice(0, 100).map(s => {
                  const config = RISK_LEVEL_CONFIG[s.riskLevel] || RISK_LEVEL_CONFIG.LOW;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{s.studentName}</div>
                        <div className="text-xs text-gray-500">{s.studentMatricule}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{s.className}</td>
                      <td className="px-4 py-2 text-center">
                        <ScoreBar value={s.conductScore} max={40} color="bg-red-500" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <ScoreBar value={s.pedagogyScore} max={40} color="bg-blue-500" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <ScoreBar value={s.attendanceScore} max={20} color="bg-orange-500" />
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-gray-900">{s.totalScore.toFixed(1)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {s.dropoutRiskFlag ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">
                            <TrendingDown className="w-3 h-3" /> Oui
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {s.scoreDelta !== undefined && s.scoreDelta !== null ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.scoreDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {s.scoreDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {s.scoreDelta > 0 ? '+' : ''}{s.scoreDelta.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {scores.length > 100 && (
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t">
                Affichage des 100 premiers élèves sur {scores.length}. Affinez le filtre pour voir plus.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
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

function AvgDisplay({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value.toFixed(1)}</div>
    </div>
  );
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-left">{value.toFixed(1)}</span>
    </div>
  );
}

function SettingsPanel({ tenantId }: { tenantId: string }) {
  const { settings, isLoading, update, isUpdating } = useRiskScoreSettings(tenantId);
  const [form, setForm] = useState<any>(null);

  useMemo(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings, form]);

  if (isLoading || !form) {
    return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }

  const handleSave = async () => {
    await update(form);
  };

  const totalWeight = (form.conductWeight || 0) + (form.pedagogyWeight || 0) + (form.attendanceWeight || 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-blue-600" />
        Configuration du score de risque
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Pondération Conduite (%)</label>
          <input
            type="number" min={0} max={100} value={form.conductWeight}
            onChange={(e) => setForm({ ...form, conductWeight: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Pondération Pédagogie (%)</label>
          <input
            type="number" min={0} max={100} value={form.pedagogyWeight}
            onChange={(e) => setForm({ ...form, pedagogyWeight: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Pondération Assiduité (%)</label>
          <input
            type="number" min={0} max={100} value={form.attendanceWeight}
            onChange={(e) => setForm({ ...form, attendanceWeight: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>
      {totalWeight !== 100 && (
        <div className="mt-2 text-xs text-red-600 font-medium">
          ⚠️ La somme des pondérations doit être 100 (actuel: {totalWeight})
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Seuil Faible→Moyen</label>
          <input
            type="number" value={form.lowThreshold}
            onChange={(e) => setForm({ ...form, lowThreshold: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Seuil Moyen→Élevé</label>
          <input
            type="number" value={form.moderateThreshold}
            onChange={(e) => setForm({ ...form, moderateThreshold: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Seuil Élevé→Critique</label>
          <input
            type="number" value={form.highThreshold}
            onChange={(e) => setForm({ ...form, highThreshold: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={isUpdating || totalWeight !== 100}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
