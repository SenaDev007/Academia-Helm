/**
 * ============================================================================
 * QHSE REPORTS & ANALYTICS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Download, FileText, BarChart3, PieChart, Calendar, ChevronRight, Share2, Printer, Search, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface QHSEDashboardData {
  reports?: Array<{
    id: string | number;
    title?: string;
    type?: string;
    date?: string;
    author?: string;
    size?: string;
  }>;
  incidentsByCategory?: Array<{ label: string; value: number; color?: string }>;
  totalIncidents?: number;
}

export default function QHSEReports() {
  const { academicYear } = useModuleContext();
  const { data: dashboard, loading, error } = useModulesDashboard<QHSEDashboardData>('qhse', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des rapports QHSE...</span>
      </div>
    );
  }

  const reports = dashboard?.reports ?? [];
  const incidentsByCategory = dashboard?.incidentsByCategory ?? [
    { label: 'Sécurité', value: 38, color: 'bg-rose-500' },
    { label: 'Hygiène', value: 25, color: 'bg-amber-400' },
    { label: 'Environnement', value: 21, color: 'bg-emerald-500' },
  ];
  const totalIncidents = dashboard?.totalIncidents ?? incidentsByCategory.reduce((acc, x) => acc + x.value, 0);

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      {/* Analytics Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Répartition Incidents</h4>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="aspect-square flex items-center justify-center relative">
             <div className="w-full h-full rounded-full border-[1.5rem] border-emerald-500 border-t-rose-500 border-r-amber-400 opacity-20" />
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{totalIncidents}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total An</p>
             </div>
          </div>
          <div className="space-y-2">
            {incidentsByCategory.map((cat, i) => {
              const pct = totalIncidents > 0 ? Math.round((cat.value / totalIncidents) * 100) : 0;
              const colorClass = cat.color || (i === 0 ? 'bg-rose-500' : i === 1 ? 'bg-amber-400' : 'bg-emerald-500');
              return (
                <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                   <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${colorClass}`} /> {cat.label} ({pct}%)</span>
                   <span className="text-slate-900">{cat.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Générateur de Rapports</h3>
            <div className="flex items-center gap-2">
               <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400">
                <Printer className="w-5 h-5" />
              </button>
              <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">
                Nouveau Rapport
              </button>
            </div>
          </div>
          
          {reports.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
              Aucun rapport QHSE disponible pour cette année scolaire.
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               {reports.map((report, i) => (
                 <div key={report.id ?? i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group cursor-pointer">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="font-black text-slate-900 leading-tight">{report.title || 'Rapport'}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Par {report.author || '—'} • {report.size || '—'}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                         <p className="text-xs font-black text-slate-900">{report.type || '—'}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{report.date || '—'}</p>
                      </div>
                      <button className="p-3 bg-slate-50 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                         <Download className="w-5 h-5" />
                      </button>
                   </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
