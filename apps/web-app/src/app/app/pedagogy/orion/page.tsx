/**
 * MODULE 2 — Analytique pédagogique ORION (SM8)
 * Dashboard, insights, risk flags, forecasts (lecture seule).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ModuleContainer,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Target,
} from 'lucide-react';

interface OrionSummary {
  insightsCount: number;
  riskFlagsCount: number;
  criticalRisks: number;
  warningRisks: number;
  forecastsCount: number;
}

interface OrionDashboard {
  insights: Array<{
    id: string;
    scopeType?: string | null;
    severity?: string | null;
    title?: string | null;
    description?: string | null;
    createdAt: string;
  }>;
  riskFlags: Array<{
    id: string;
    entityType?: string | null;
    level?: string | null;
    message?: string | null;
    createdAt: string;
  }>;
  forecasts: Array<{
    id: string;
    entityType?: string | null;
    predictedValue?: number | null;
    confidence?: number | null;
    generatedAt: string;
  }>;
  summary: OrionSummary | null;
}

export default function OrionPedagogyPage() {
  const { academicYear } = useModuleContext();
  const [dashboard, setDashboard] = useState<OrionDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!academicYear?.id) {
      setDashboard(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/pedagogy/orion-advanced/dashboard?academicYearId=${encodeURIComponent(academicYear.id)}`;
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? res.statusText);
      }
      const data = (await res.json()) as OrionDashboard;
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <ModuleContainer
      header={{
        title: 'Analytique pédagogique ORION',
        description: 'KPI pédagogiques, alertes, prévisions, recommandations',
        icon: 'bookOpen',
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            <p className="text-gray-600">
              ORION analyse la production pédagogique, les résultats et l&apos;assiduité pour produire
              des insights, des flags de risque et des prévisions. Lecture seule.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!academicYear?.id ? (
              <p className="text-gray-500">
                Sélectionnez une année scolaire pour afficher les indicateurs ORION.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement…
              </div>
            ) : dashboard ? (
              <>
                {dashboard.summary && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Recommandations</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-800">
                        {dashboard.summary.insightsCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <span className="font-medium text-gray-900">Risques</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-800">
                        {dashboard.summary.riskFlagsCount}
                        {(dashboard.summary.criticalRisks > 0 || dashboard.summary.warningRisks > 0) && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            ({dashboard.summary.criticalRisks} critique, {dashboard.summary.warningRisks} alerte)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-gray-900">Prévisions</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-800">
                        {dashboard.summary.forecastsCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-gray-900">KPI pédagogiques</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Couverture, validation fiches, volume horaire
                      </p>
                    </div>
                  </div>
                )}

                {dashboard.riskFlags.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="border-b bg-gray-50 px-4 py-2 flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-amber-600" />
                      <h3 className="font-medium text-gray-900">Risques (OrionRiskFlag)</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {dashboard.riskFlags.slice(0, 20).map((r) => (
                        <li key={r.id} className="px-4 py-2 flex items-start gap-2">
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                              r.level === 'RED'
                                ? 'bg-red-100 text-red-800'
                                : r.level === 'YELLOW'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {r.level ?? '—'}
                          </span>
                          <span className="text-sm text-gray-700">{r.message ?? r.entityType ?? '—'}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dashboard.insights.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="border-b bg-gray-50 px-4 py-2 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-purple-600" />
                      <h3 className="font-medium text-gray-900">Recommandations (OrionPedagogicalInsight)</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {dashboard.insights.slice(0, 20).map((i) => (
                        <li key={i.id} className="px-4 py-2">
                          <p className="font-medium text-gray-900">{i.title ?? i.scopeType ?? '—'}</p>
                          {i.description && (
                            <p className="text-sm text-gray-600 mt-1">{i.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {i.severity && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5">{i.severity}</span>
                            )}{' '}
                            {new Date(i.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dashboard.forecasts.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <div className="border-b bg-gray-50 px-4 py-2 flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      <h3 className="font-medium text-gray-900">Prévisions (OrionForecast)</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                      {dashboard.forecasts.slice(0, 20).map((f) => (
                        <li key={f.id} className="px-4 py-2 flex items-center justify-between">
                          <span className="text-sm text-gray-700">{f.entityType ?? '—'}</span>
                          <span className="text-sm font-medium text-gray-900">
                            {f.predictedValue != null ? f.predictedValue : '—'}
                            {f.confidence != null && (
                              <span className="text-gray-500 font-normal ml-1">
                                (conf. {Math.round((f.confidence ?? 0) * 100)} %)
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(f.generatedAt).toLocaleDateString('fr-FR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dashboard.summary &&
                  dashboard.insights.length === 0 &&
                  dashboard.riskFlags.length === 0 &&
                  dashboard.forecasts.length === 0 && (
                    <p className="text-gray-500 text-sm">
                      Aucune donnée ORION pour cette année. Les indicateurs se remplissent au fil de l&apos;usage.
                    </p>
                  )}
              </>
            ) : null}

            <p className="text-sm text-gray-500">
              Dashboard ORION global :{' '}
              <Link href="/app/orion" className="text-blue-600 hover:underline">
                /app/orion
              </Link>
            </p>
          </div>
        ),
      }}
    />
  );
}
