/**
 * DirectionKpiPage
 *
 * Module Bilans & Indicateurs pour directeurs/promoteurs.
 * - Lecture seule
 * - KPI clairs, sans calcul ambigu côté frontend
 * - Graphiques sobres (barres horizontales, timelines simples)
 */

'use client';

import { useEffect, useState } from 'react';
import { getDirectionKpi } from '@/services/kpi.service';
import type { DirectionKpiResponse } from '@/types';
import { BarChart3, Users, Calculator, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface KpiState {
  data: DirectionKpiResponse | null;
  loading: boolean;
  error?: string;
}

export default function DirectionKpiPage() {
  const [state, setState] = useState<KpiState>({
    data: null,
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getDirectionKpi();
        setState({ data, loading: true, error: undefined });
        setState({ data, loading: false });
      } catch (error: any) {
        setState({
          data: null,
          loading: false,
          error: error.message || 'Erreur lors du chargement des indicateurs',
        });
      }
    }
    load();
  }, []);

  const { data, loading, error } = state;

  const summary = data?.summary;
  const revenueByPeriod = data?.revenueByPeriod || [];
  const moduleKpis = data?.moduleKpis || [];

  return (
    <div className="space-y-6">
      {/* En-tête contexte direction */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 mb-1">
            Bilans & Indicateurs — Direction
          </h1>
          <p className="text-sm text-slate-600">
            Vue synthétique de l&apos;établissement. Lecture seule, chiffres consolidés.
          </p>
        </div>
        <div className="hidden md:flex items-center text-slate-500 text-xs">
          <BarChart3 className="w-5 h-5 mr-2" />
          <span>Données agrégées et traçables, sans modification possible depuis ce module.</span>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 flex items-center justify-center">
          <Loader className="w-6 h-6 text-navy-900 animate-spin mr-3" />
          <span className="text-slate-600 text-sm">Chargement des indicateurs...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
          <div>
            <p className="text-sm text-red-800">{error}</p>
            <p className="text-xs text-red-700 mt-1">
              Si le problème persiste, contactez la direction ou le support Academia Helm.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          {/* KPI synthétiques principaux */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-4">
              Indicateurs clés — {summary.periodLabel}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600">Effectif total</p>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-navy-900">
                  {summary.totalStudents.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Élèves inscrits</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600">Recettes sur la période</p>
                  <Calculator className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-navy-900">
                  {summary.totalRevenue.toLocaleString()} {summary.currency}
                </p>
                <p className="text-xs text-slate-500 mt-1">Tous encaissements consolidés</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600">Taux de recouvrement</p>
                  <CheckCircle className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-navy-900">
                  {summary.recoveryRate.toFixed(1)}%
                </p>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-green-600"
                    style={{ width: `${Math.min(100, Math.max(0, summary.recoveryRate))}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Part des montants facturés effectivement encaissés.
                </p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-600">Présence enseignants</p>
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-navy-900">
                  {summary.teacherPresenceRate.toFixed(1)}%
                </p>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, summary.teacherPresenceRate),
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Taux moyen de présence des enseignants sur la période.
                </p>
              </div>
            </div>
          </div>

          {/* Recettes par période */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-4">
              Recettes par période
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              {revenueByPeriod.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Aucune donnée de recettes disponible pour la période sélectionnée.
                </p>
              ) : (
                <div className="space-y-3">
                  {revenueByPeriod.map((point) => {
                    const max = Math.max(
                      ...revenueByPeriod.map((p) => p.amount || 0),
                    );
                    const width =
                      max > 0 ? Math.max(5, (point.amount / max) * 100) : 0;
                    return (
                      <div key={point.period} className="flex items-center space-x-3">
                        <div className="w-24 text-xs text-slate-600">{point.period}</div>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-3 bg-navy-900"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="w-28 text-right text-xs text-slate-700">
                          {point.amount.toLocaleString()} {summary.currency}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bilans par module */}
          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-4">
              Bilans par module
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {moduleKpis.map((module) => (
                <div
                  key={module.module}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
                >
                  <h3 className="text-sm font-semibold text-navy-900 mb-3">
                    {module.label}
                  </h3>
                  <ul className="space-y-2">
                    {module.indicators.map((ind) => (
                      <li key={ind.name} className="text-xs text-slate-600">
                        <span className="block">{ind.name}</span>
                        <span className="font-semibold text-navy-900">
                          {ind.value.toLocaleString()}{' '}
                          {ind.unit ? ind.unit : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


