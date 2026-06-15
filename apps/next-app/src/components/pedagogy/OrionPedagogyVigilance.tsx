/**
 * OrionPedagogyVigilance Component
 * 
 * Moteur de vigilance pédagogique ORION.
 * Détecte les baisses de niveau, les examens manquants et les retards de programme.
 * Wired to /api/pedagogy/orion/kpis, /api/pedagogy/orion/alerts, /api/pedagogy/orion-advanced/dashboard
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  BookOpen,
  BarChart3,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useToast } from '@/components/ui/use-toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrionAlert {
  id: string;
  severity: string;
  type: string;
  message: string;
  date?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface OrionKpi {
  label?: string;
  name?: string;
  value?: number;
  percentage?: number;
  color?: string;
  trend?: string;
  category?: string;
  [key: string]: unknown;
}

interface AdvancedDashboard {
  curriculumProgress?: number;
  curriculumTrend?: string;
  riskPoints?: Array<{
    label: string;
    value: number;
    color: string;
    trend: string;
  }>;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OrionPedagogyVigilance() {
  const { academicYear } = useModuleContext();
  const yearId = academicYear?.id ?? '';
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<OrionAlert[]>([]);
  const [kpis, setKpis] = useState<OrionKpi[]>([]);
  const [dashboard, setDashboard] = useState<AdvancedDashboard | null>(null);

  const [alertsLoading, setAlertsLoading] = useState(false);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch alerts                                                     */
  /* ---------------------------------------------------------------- */

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const qs = yearId ? `?academicYearId=${yearId}` : '';
      const data = await pedagogyFetch<OrionAlert[] | { data: OrionAlert[] }>(
        `/api/pedagogy/orion/alerts${qs}`,
      );
      if (Array.isArray(data)) {
        setAlerts(data);
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: OrionAlert[] }).data)) {
        setAlerts((data as { data: OrionAlert[] }).data);
      } else {
        setAlerts([]);
      }
    } catch (e) {
      console.error(e);
      setAlerts([]);
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de charger les alertes ORION.',
        variant: 'destructive',
      });
    } finally {
      setAlertsLoading(false);
    }
  }, [yearId, toast]);

  /* ---------------------------------------------------------------- */
  /*  Fetch KPIs                                                       */
  /* ---------------------------------------------------------------- */

  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const qs = yearId ? `?academicYearId=${yearId}` : '';
      const data = await pedagogyFetch<OrionKpi[] | { data: OrionKpi[] }>(
        `/api/pedagogy/orion/kpis${qs}`,
      );
      if (Array.isArray(data)) {
        setKpis(data);
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: OrionKpi[] }).data)) {
        setKpis((data as { data: OrionKpi[] }).data);
      } else {
        setKpis([]);
      }
    } catch (e) {
      console.error(e);
      setKpis([]);
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de charger les KPIs ORION.',
        variant: 'destructive',
      });
    } finally {
      setKpisLoading(false);
    }
  }, [yearId, toast]);

  /* ---------------------------------------------------------------- */
  /*  Fetch advanced dashboard                                         */
  /* ---------------------------------------------------------------- */

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const qs = yearId ? `?academicYearId=${yearId}` : '';
      const data = await pedagogyFetch<AdvancedDashboard>(
        `/api/pedagogy/orion-advanced/dashboard${qs}`,
      );
      setDashboard(data ?? null);
    } catch (e) {
      console.error(e);
      setDashboard(null);
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de charger le tableau de bord ORION.',
        variant: 'destructive',
      });
    } finally {
      setDashboardLoading(false);
    }
  }, [yearId, toast]);

  /* ---------------------------------------------------------------- */
  /*  Load all on mount                                                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    loadAlerts();
    loadKpis();
    loadDashboard();
  }, [loadAlerts, loadKpis, loadDashboard]);

  const refreshAll = () => {
    loadAlerts();
    loadKpis();
    loadDashboard();
  };

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const displayDate = (d?: string) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      const now = new Date();
      const diffMs = now.getTime() - dt.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays}j`;
      return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return d;
    }
  };

  /* Derive risk points from KPIs or dashboard */
  const riskPoints = dashboard?.riskPoints ?? kpis
    .filter((k) => k.category === 'risk' || k.label || k.name)
    .slice(0, 3)
    .map((k) => ({
      label: k.label ?? k.name ?? '—',
      value: k.value ?? k.percentage ?? 0,
      color: k.color ?? (k.value != null && k.value < 10 ? 'text-rose-600' : 'text-amber-600'),
      trend: k.trend ?? 'down',
    }));

  /* Provide defaults when no dashboard data */
  const curriculumProgress = dashboard?.curriculumProgress ?? 0;
  const curriculumTrend = dashboard?.curriculumTrend ?? '';

  const isAllLoading = alertsLoading && kpisLoading && dashboardLoading;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Orion Banner */}
      <div className="bg-indigo-950 rounded-[3rem] p-10 text-white relative overflow-hidden border border-white/5 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Orion Pedagogical Intelligence</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none mb-6">Vigilance Académique & Excellence</h2>
            <p className="text-indigo-200/70 text-sm leading-relaxed max-w-lg">
              Surveillance en temps réel de la progression des programmes et des performances des élèves. 
              Identification proactive des décrochages et optimisation de la réussite scolaire.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-indigo-900/50 flex items-center justify-center border border-white/10 relative">
              <Activity className="w-12 h-12 text-indigo-400 animate-pulse" />
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                <circle cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="377" strokeDashoffset={377 - (377 * curriculumProgress / 100)} className="text-indigo-500" />
              </svg>
            </div>
            <button
              onClick={refreshAll}
              disabled={isAllLoading}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all disabled:opacity-50"
              title="Rafraîchir"
            >
              <RefreshCw className={cn("w-5 h-5 text-white/70", isAllLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Journal */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Journal de Vigilance Pédagogique
          </h3>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {alertsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <span className="ml-3 text-sm text-slate-500">Chargement des alertes…</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ShieldCheck className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Aucune alerte pédagogique.</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-6 flex items-start gap-6 hover:bg-slate-50 transition-all group">
                  <div className={cn(
                    "p-4 rounded-2xl",
                    alert.severity === 'CRITICAL' ? "bg-rose-50 text-rose-600 shadow-sm" :
                    alert.severity === 'WARNING' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {alert.severity === 'CRITICAL' ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{alert.type}</p>
                      <span className="text-[10px] font-bold text-slate-400">
                        {displayDate(alert.date ?? alert.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{alert.message}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10">Détails</button>
                      <button className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all">Ignorer</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Advanced Metrics */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Points de Risque Académique</h4>
            {kpisLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : riskPoints.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Aucune donnée de risque disponible.</p>
            ) : (
              <div className="space-y-6">
                {riskPoints.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-lg font-black", m.color || 'text-amber-600')}>{m.value}%</span>
                      {m.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Avancement Global Programme</h4>
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <>
                <div className="text-center py-4">
                  <div className="text-5xl font-black text-slate-900 leading-none">
                    {curriculumProgress ? curriculumProgress.toFixed(1) : '0.0'}%
                  </div>
                  {curriculumTrend && (
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mt-2">
                      {curriculumTrend}
                    </p>
                  )}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${curriculumProgress || 0}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
