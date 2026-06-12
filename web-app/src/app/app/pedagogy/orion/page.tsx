/**
 * MODULE 2 — Analytique pédagogique ORION (SM8)
 * Dashboard, insights, risk flags, forecasts (IA-driven).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ModuleContainer,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Target,
  ArrowRight,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [analyzing, setAnalyzing] = useState(false);
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
      const data = await pedagogyFetch<OrionDashboard>(url);
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

  const handleRunAnalysis = async () => {
    if (!academicYear?.id) return;
    setAnalyzing(true);
    try {
      await pedagogyFetch(`/api/pedagogy/orion-advanced/analyze?academicYearId=${academicYear.id}`, { method: 'POST' });
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur analyse');
    } finally {
      setAnalyzing(false);
    }
  };


  return (
    <ModuleContainer
      header={{
        title: 'Intelligence ORION',
        description: 'Analyse prédictive et conformité pédagogique augmentée par IA',
        icon: 'sparkles',
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-8">
            {/* Intro section */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 to-blue-950 text-white shadow-xl overflow-hidden relative"
            >
              <div className="absolute right-0 top-0 p-8 opacity-10">
                <Zap className="h-32 w-32" />
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
                <Sparkles className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Moteur d'IA ORION</h2>
                <p className="text-sm text-white/60 max-w-2xl">
                  Analyse temps-réel de la production pédagogique, des incidents et des tendances pour sécuriser la réussite de l'établissement.
                </p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={handleRunAnalysis}
                  disabled={analyzing || loading}
                  className="px-4 py-2 rounded-xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-blue-600" />}
                  Lancer l'analyse
                </button>
              </div>
            </motion.div>


            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            {!academicYear?.id ? (
              <div className="text-center py-20 space-y-4 rounded-3xl border-2 border-dashed">
                <BarChart3 className="h-12 w-12 text-gray-200 mx-auto" />
                <p className="text-gray-500">
                  Sélectionnez une année scolaire pour initialiser l'analyse ORION.
                </p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-600">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="font-medium animate-pulse">Calcul des insights en cours...</p>
              </div>
            ) : dashboard ? (
              <AnimatePresence mode="wait">
                <motion.div 
                  key="dashboard-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {/* Summary Cards */}
                  {dashboard.summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Conseils IA', val: dashboard.summary.insightsCount, icon: Lightbulb, color: 'purple' },
                        { label: 'Risques Actifs', val: dashboard.summary.riskFlagsCount, icon: AlertTriangle, color: 'amber' },
                        { label: 'Prévisions', val: dashboard.summary.forecastsCount, icon: Target, color: 'emerald' },
                        { label: 'Alertes Critiques', val: dashboard.summary.criticalRisks, icon: ShieldAlert, color: 'rose' },
                      ].map((item, idx) => (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          key={item.label}
                          className="rounded-2xl border bg-white p-5 shadow-sm"
                        >
                          <div className={cn("inline-flex p-2 rounded-xl bg-gray-50 mb-3", `text-${item.color}-600`)}>
                            <item.icon className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-medium text-gray-500">{item.label}</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{item.val}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Risks Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-amber-500" />
                          Risques Détectés
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">OrionRiskFlag</span>
                      </div>
                      
                      <div className="space-y-3">
                        {dashboard.riskFlags.length > 0 ? (
                          dashboard.riskFlags.map((r, i) => (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              key={r.id}
                              className="group rounded-2xl border bg-white p-4 transition-all hover:border-amber-200 hover:shadow-md"
                            >
                              <div className="flex items-start gap-4">
                                <div className={cn(
                                  "mt-1 h-3 w-3 shrink-0 rounded-full",
                                  r.level === 'RED' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                                )} />
                                <div className="flex-1 space-y-1">
                                  <p className="text-sm font-semibold text-gray-900">{r.message ?? r.entityType}</p>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
                                    <span className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                      r.level === 'RED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                    )}>{r.level}</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="rounded-3xl border-2 border-dashed p-12 text-center text-gray-400">
                            Aucun risque détecté.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Insights & Forecasts */}
                    <div className="space-y-8">
                      {/* Insights */}
                      <div className="space-y-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 px-1">
                          <Lightbulb className="h-5 w-5 text-purple-500" />
                          Recommandations Stratégiques
                        </h3>
                        <div className="space-y-3">
                          {dashboard.insights.map((i, idx) => (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 + idx * 0.05 }}
                              key={i.id}
                              className="rounded-2xl border border-purple-100 bg-purple-50/30 p-4"
                            >
                              <p className="text-sm font-bold text-purple-900">{i.title}</p>
                              {i.description && <p className="text-xs text-purple-700/70 mt-1 line-clamp-2">{i.description}</p>}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{i.scopeType}</span>
                                <button className="text-[10px] font-bold text-purple-600 flex items-center gap-1 hover:underline">
                                  Actionner <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Forecasts */}
                      <div className="space-y-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 px-1">
                          <TrendingUp className="h-5 w-5 text-emerald-500" />
                          Prévisions Pédagogiques
                        </h3>
                        <div className="rounded-3xl border bg-white overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Sujet</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600">Prédiction</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600">Confiance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dashboard.forecasts.map((f) => (
                                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-800">{f.entityType}</td>
                                  <td className="px-4 py-3 text-right font-bold text-blue-600">
                                    {f.predictedValue != null ? f.predictedValue : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div 
                                          className="h-full bg-emerald-500" 
                                          style={{ width: `${(f.confidence ?? 0) * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-gray-500">
                                        {Math.round((f.confidence ?? 0) * 100)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-500">
                    <Info className="h-4 w-4 text-blue-400" />
                    <p>
                      Les données ORION sont générées par des modèles probabilistes. Elles constituent une aide à la décision et ne remplacent pas le jugement pédagogique. 
                      Dashboard global : <Link href="/app/orion" className="text-blue-600 hover:underline font-bold">/app/orion</Link>
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : null}
          </div>
        ),
      }}
    />
  );
}
