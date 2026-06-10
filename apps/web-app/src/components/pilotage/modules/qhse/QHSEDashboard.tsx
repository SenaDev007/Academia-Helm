/**
 * ============================================================================
 * QHSE DASHBOARD
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Activity, CheckCircle2, TrendingUp, TrendingDown, Clock, MapPin } from 'lucide-react';

export default function QHSEDashboard() {
  const stats = [
    { label: 'Incidents Déclarés', value: '12', trend: '+2', trendType: 'up', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Risques Critiques', value: '3', trend: '-1', trendType: 'down', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Audits en Cours', value: '2', trend: 'Non-conformités: 5', trendType: 'neutral', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Plans d\'Action', value: '8', trend: '65% complété', trendType: 'positive', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
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
            {[
              { id: 1, type: 'Accident élève', gravity: 'IMPORTANT', location: 'Cour de récréation', time: 'Il y a 2h', status: 'DECLARE' },
              { id: 2, type: 'Problème électrique', gravity: 'MODERE', location: 'Bâtiment B - Salle 12', time: 'Hier, 14:30', status: 'TRAITEMENT' },
              { id: 3, type: 'Malaise', gravity: 'URGENCE', location: 'Cantine', time: '12 Mai, 11:45', status: 'RESOLU' },
            ].map((incident) => (
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
                  <span className="text-emerald-400">92%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 w-[92%]" />
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
