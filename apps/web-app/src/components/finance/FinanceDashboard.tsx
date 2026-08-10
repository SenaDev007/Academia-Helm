/**
 * ============================================================================
 * ACADEMIA HELM - FINANCE MODULE
 * Dashboard pilotage stratégique (style minimaliste — pattern Students)
 * ============================================================================
 *
 * Style : cartes simples (bg-white rounded-xl border), icônes colorées,
 * valeurs réelles depuis l'API. Aucune donnée mock.
 *
 * ============================================================================
 */
'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertCircle,
  TrendingDown,
  BarChart3,
  DollarSign,
  Wallet,
  ChevronRight,
  ArrowUpRight,
  Clock,
  RefreshCw,
  Percent,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';
import { orionService } from '@/services/orion.service';
import { formatCurrency } from '@/lib/utils';

function FinanceDashboardArrears({
  academicYearId,
  schoolLevelId,
}: {
  academicYearId?: string;
  schoolLevelId?: string;
}) {
  const [arrears, setArrears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);
    financeService
      .getArrears(Object.fromEntries(params.entries()))
      .then((data) => setArrears(Array.isArray(data) ? data : []))
      .catch(() => setArrears([]))
      .finally(() => setLoading(false));
  }, [academicYearId, schoolLevelId]);

  const topByStudent = arrears.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          Alertes de Recouvrement
        </h3>
        <Link
          href="/app/finance/collection"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : topByStudent.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-500 mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-500">Aucun impayé critique détecté.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {topByStudent.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                    {a.student?.lastName?.[0] ?? '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {a.student?.firstName} {a.student?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.student?.studentEnrollments?.[0]?.class?.name ?? 'Classe N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600 text-sm">{formatCurrency(a.balanceDue)}</p>
                  <Badge variant="outline" className="text-[10px] uppercase border-red-200 text-red-700 bg-red-50">
                    {a.arrearsLevel ?? 'CRITIQUE'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [kpis, setKpis] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [orionAlerts, setOrionAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!academicYear?.id) return;
      setLoading(true);
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id) params.set('schoolLevelId', schoolLevel.id);

      try {
        const [kpi, monthly, alerts] = await Promise.all([
          financeService.getKpiReports(Object.fromEntries(params.entries())).catch(() => ({})),
          financeService.getMonthlyEncaissements(Object.fromEntries(params.entries())).catch(() => []),
          orionService.getAlerts({ academicYearId: academicYear.id }).catch(() => []),
        ]);

        setKpis(kpi);
        setMonthlyData(Array.isArray(monthly) ? monthly : []);
        setOrionAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (e) {
        console.error('Finance dashboard load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [academicYear?.id, schoolLevel?.id]);

  // KPI values (réels, jamais mock)
  const totalEncaisse = kpis?.totalEncaissement ?? 0;
  const totalDu = kpis?.totalDue ?? 0;
  const tauxRecouvrement = kpis?.tauxRecouvrement ?? 0;
  const totalDepenses = kpis?.totalDepenses ?? 0;
  const soldeNet = (kpis?.soldeNet as number) ?? totalEncaisse - totalDepenses;
  // ⭐ Task 30 : Nouveaux KPIs pour les personnalisations
  const previsonnementGlobal = kpis?.previsonnementGlobal ?? totalDu;
  const totalReductions = kpis?.totalReductions ?? 0;

  // Calcul du max pour l'affichage du graphique mensuel
  const maxMonthly = monthlyData.length > 0
    ? Math.max(...monthlyData.map((d) => Number(d.total) || 0), 1)
    : 1;

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Section — cartes aérées (pattern PilotageDashboardV2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Prévisionnel Global (sans personnalisations) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Prévisionnel global</p>
              <p className="text-base lg:text-lg font-bold text-indigo-600 mt-1">
                {loading ? '—' : formatCurrency(previsonnementGlobal)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">avant personnalisations</p>
            </div>
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Réductions (personnalisations) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Réductions</p>
              <p className="text-base lg:text-lg font-bold text-purple-600 mt-1">
                {loading ? '—' : formatCurrency(totalReductions)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">personnalisations</p>
            </div>
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <Percent className="w-4 h-4 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Prévisionnel Net (après personnalisations) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Prévisionnel net</p>
              <p className="text-base lg:text-lg font-bold text-blue-600 mt-1">
                {loading ? '—' : formatCurrency(totalDu)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">après personnalisations</p>
            </div>
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        {/* Total Encaissé */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Total encaissé</p>
              <p className="text-base lg:text-lg font-bold text-emerald-600 mt-1">
                {loading ? '—' : formatCurrency(totalEncaisse)}
              </p>
            </div>
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Taux Recouvrement */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Taux recouvrement</p>
              <p className="text-base lg:text-lg font-bold text-amber-600 mt-1">
                {loading ? '—' : `${tauxRecouvrement}%`}
              </p>
            </div>
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <BarChart3 className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Dépenses */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Dépenses</p>
              <p className="text-base lg:text-lg font-bold text-rose-600 mt-1">
                {loading ? '—' : formatCurrency(totalDepenses)}
              </p>
            </div>
            <div className="p-1.5 bg-rose-50 rounded-lg">
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Solde Net */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-500">Solde net</p>
              <p className={`text-base lg:text-lg font-bold mt-1 ${soldeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {loading ? '—' : formatCurrency(soldeNet)}
              </p>
            </div>
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <Wallet className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Section principale : 2 colonnes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Colonne gauche : Graphique + Alertes */}
        <div className="xl:col-span-2 space-y-6">
          {/* Évolution mensuelle des recettes — style tableau simple */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Évolution des recettes</h3>
                <p className="text-xs text-gray-500 mt-0.5">Performance financière mensuelle</p>
              </div>
              <Link
                href="/app/finance/reports"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Détails <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
            ) : monthlyData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-200 rounded-lg">
                <BarChart3 className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucune donnée mensuelle disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Tableau simple des encaissements mensuels */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Mois</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Encaissements</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600 w-1/3">Proportion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((d, i) => {
                        const total = Number(d.total) || 0;
                        const percentage = Math.round((total / maxMonthly) * 100);
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-medium text-gray-900">
                              {d.month}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                              {formatCurrency(total)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{percentage}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Alertes de recouvrement */}
          <FinanceDashboardArrears academicYearId={academicYear?.id} schoolLevelId={schoolLevel?.id} />
        </div>

        {/* Colonne droite : ORION */}
        <div className="space-y-6">
          {/* ORION Intelligence */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">ORION — Alertes financières</h3>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                <div className="h-16 bg-gray-50 animate-pulse rounded" />
              </div>
            ) : orionAlerts.length === 0 ? (
              <div className="py-6 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-500 mb-2">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <p className="text-sm text-gray-500">
                  Aucune anomalie détectée. Santé financière optimale.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {orionAlerts.map((a, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      a.level === 'CRITICAL'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {a.level === 'CRITICAL' ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        {a.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{a.message}</p>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/app/finance/audit"
              className="mt-4 block text-center text-xs font-medium text-blue-600 hover:text-blue-700 py-2 border-t border-gray-100"
            >
              Voir le contrôle & audit complet →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
