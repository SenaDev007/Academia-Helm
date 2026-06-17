/**
 * ============================================================================
 * QHSE DASHBOARD
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Activity, CheckCircle2, TrendingUp, TrendingDown, Clock, MapPin, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface QHSEStats {
  openIncidents?: number;
  resolvedIncidents?: number;
  pendingAudits?: number;
  complianceRate?: number;
  recentIncidents?: Array<{ id: string | number; type: string; gravity: string; location: string; time: string; status: string }>;
  alerts?: Array<{ id?: string; type?: string; title?: string; desc?: string; time?: string }>;
}

const DEFAULT_STATS: QHSEStats = {
  openIncidents: 0,
  resolvedIncidents: 0,
  pendingAudits: 0,
  complianceRate: 0,
  recentIncidents: [],
  alerts: [],
};

export default function QHSEDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<QHSEStats>('qhse', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };
  const complianceRate = Math.min(Math.max(stats.complianceRate ?? 0, 0), 100);

  const kpiCards = [
    { label: 'Incidents Ouverts', value: String(stats.openIncidents ?? 0), trend: '+2', trendType: 'up', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Incidents Résolus', value: String(stats.resolvedIncidents ?? 0), trend: '-1', trendType: 'down', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Audits en Cours', value: String(stats.pendingAudits ?? 0), trend: 'Non-conformités: 5', trendType: 'neutral', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Taux de Conformité', value: `${complianceRate}%`, trend: '65% complété', trendType: 'positive', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                {stat.trendType === 'up' ? <TrendingUp className="w-4 h-4 text-rose-500" /> : stat.trendType === 'down' ? <TrendingDown className="w-4 h-4 text-emerald-500" /> : null}
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</h4>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
              <p className={`text-[10px] font-bold ${stat.trendType === 'up' ? 'text-rose-500' : stat.trendType === 'down' ? 'text-emerald-500' : 'text-slate-400'}`}>
                {stat.trend}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Incidents */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Incidents Récents</h3>
            <button className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline">Voir Registre</button>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            {(stats.recentIncidents?.length ? stats.recentIncidents : []).map((incident) => (
              <div key={incident.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    incident.gravity === 'URGENCE' ? 'bg-rose-100 text-rose-600' : 
                    incident.gravity === 'IMPORTANT' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-tight">{incident.type}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {incident.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {incident.time}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                     incident.status === 'RESOLU' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                   }`}>
                     {incident.status}
                   </span>
                </div>
              </div>
            ))}
            {(!stats.recentIncidents || stats.recentIncidents.length === 0) && (
              <div className="text-center py-12 text-sm text-slate-400">
                Aucun incident récent enregistré.
              </div>
            )}
          </div>
        </div>

        {/* Safety Meter */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Santé Globale</h3>
          <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-navy-900/20">
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <p className="text-sm font-black uppercase tracking-widest">Niveau de Sécurité</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-5xl font-black text-emerald-400 tracking-tighter">OPTIMAL</p>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Dernier audit : 14/05/2026</p>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span>Conformité Sanitaire</span>
                  <span className="text-emerald-400">{complianceRate}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${complianceRate}%` }} />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 -right-8 opacity-10">
              <ShieldCheck className="w-48 h-48" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
