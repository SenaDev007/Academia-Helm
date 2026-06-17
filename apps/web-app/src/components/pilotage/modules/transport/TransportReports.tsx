'use client';

import { FileBarChart, Download, Search, Filter, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

// Rapports statiques (templates) — pas d'endpoint GET dédié pour la liste de rapports générés.
// Les statistiques de performance flotte proviennent du dashboard du module transport.
const REPORT_TEMPLATES = [
  { title: 'Rapport journalier des trajets', date: '15/05/2026', type: 'Daily' },
  { title: 'Synthèse mensuelle des présences', date: 'Avril 2026', type: 'Monthly' },
  { title: 'Audit de maintenance flotte', date: 'T1 2026', type: 'Quarterly' },
  { title: 'Rapport financier transport', date: 'Mai 2026', type: 'Financial' },
];

interface TransportDashboard {
  fleetPerformance?: Array<{ month?: string; label?: string; val?: number; value?: number }>;
  monthlyPerformance?: Array<{ month?: string; label?: string; val?: number; value?: number }>;
  [key: string]: any;
}

export default function TransportReports() {
  const { academicYear } = useModuleContext();
  const { data: dashboard, loading, error } = useModulesDashboard<TransportDashboard>('transport', academicYear?.id);

  // Données de performance flotte depuis le dashboard (fallback: données statiques)
  const rawPerf = dashboard?.fleetPerformance || dashboard?.monthlyPerformance;
  const performanceData = Array.isArray(rawPerf) && rawPerf.length > 0
    ? rawPerf.map((d, i) => ({
        month: d.month || d.label || `M${i + 1}`,
        val: d.val ?? d.value ?? 0,
      }))
    : [45, 65, 35, 85, 75, 95, 60].map((val, i) => ({ month: `M${i + 1}`, val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-navy-900" /> Rapports & Statistiques
        </h3>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          Générer un nouveau rapport
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {REPORT_TEMPLATES.map((report, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-navy-900 group-hover:text-white transition-all mb-6 w-fit">
              <Download className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-tight mb-2">{report.title}</h4>
            <div className="flex items-center justify-between mt-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{report.date}</span>
              <span className="text-[10px] font-black text-navy-900 uppercase tracking-widest bg-navy-50 px-3 py-1 rounded-full">{report.type}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Performances Flotte (Mensuel)</h4>
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="h-64 flex items-end justify-between gap-4">
          {performanceData.map((d, i) => (
            <div key={i} className="flex-1 space-y-2">
              <div className="w-full bg-navy-50 rounded-t-xl group relative cursor-pointer">
                <div className="bg-navy-900 rounded-t-xl transition-all duration-500 hover:bg-emerald-500" style={{ height: `${d.val}%` }}></div>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.val}%
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase text-center">{d.month}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
