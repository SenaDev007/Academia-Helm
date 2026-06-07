/**
 * OrionHRVigilance Component
 * 
 * Moteur de vigilance RH ORION.
 * Détecte les anomalies d'absentéisme, les contrats expirant et les risques de turnover.
 */

'use client';

import { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Briefcase,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrionHRVigilance() {
  const [alerts] = useState([
    { id: 'RH-ALR-001', severity: 'CRITICAL', type: 'EXPIRATION', message: '5 contrats de vacataires expirent dans moins de 15 jours.', date: 'Il y a 1h' },
    { id: 'RH-ALR-002', severity: 'WARNING', type: 'ABSENTEEISM', message: 'Pic d\'absentéisme détecté au département Sciences (+25%).', date: 'Hier' },
    { id: 'RH-ALR-003', severity: 'INFO', type: 'TRAINING', message: 'Session de formation pédagogique à planifier pour le cycle 3.', date: 'Hier' },
  ]);

  return (
    <div className="space-y-6">
      {/* Orion HR Banner */}
      <div className="bg-slate-950 rounded-[2.5rem] p-10 text-white relative overflow-hidden border border-slate-800 shadow-2xl">
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
               <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Orion RH Vigilance System</span>
               </div>
               <h2 className="text-4xl font-black tracking-tighter leading-none mb-4">Pilotage Prédictif du Capital Humain</h2>
               <p className="text-slate-400 text-sm leading-relaxed">
                  Surveillance algorithmique des contrats, de la performance et de la conformité RH. 
                  Détection proactive des risques opérationnels et stratégiques.
               </p>
            </div>
            <div className="flex flex-col items-center gap-2">
               <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 flex items-center justify-center relative">
                  <Activity className="w-10 h-10 text-blue-500 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin" />
               </div>
               <span className="text-[10px] font-bold text-slate-500 uppercase">Analyse en cours</span>
            </div>
         </div>
         {/* Decorative Grid */}
         <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Alerts Journal */}
         <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-emerald-500" /> Journal de Vigilance RH
            </h3>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
               {alerts.map((alert, i) => (
                 <div key={i} className="p-6 flex items-start gap-5 hover:bg-slate-50 transition-all group">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      alert.severity === 'CRITICAL' ? "bg-rose-50 text-rose-600" :
                      alert.severity === 'WARNING' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {alert.severity === 'CRITICAL' ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                       <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{alert.type}</p>
                          <span className="text-[10px] font-bold text-slate-400">{alert.date}</span>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed">{alert.message}</p>
                       <div className="mt-4 flex gap-3">
                          <button className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition-all">Action</button>
                          <button className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all">Détails</button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Predictive Insights */}
         <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Risque de Turnover (Prévision)</h4>
               <div className="space-y-6">
                  {[
                    { label: 'Primaire', risk: 8, color: 'bg-emerald-500' },
                    { label: 'Secondaire', risk: 24, color: 'bg-amber-500' },
                    { label: 'Admin', risk: 12, color: 'bg-blue-500' },
                  ].map((r, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-600">{r.label}</span>
                          <span className="text-slate-900">{r.risk}%</span>
                       </div>
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all duration-1000", r.color)} style={{ width: `${r.risk}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10">
                  <BarChart3 className="w-8 h-8 mb-4 text-blue-200 group-hover:scale-110 transition-transform" />
                  <h4 className="font-black text-xl leading-tight">Indice de Stabilité RH</h4>
                  <p className="text-3xl font-black mt-2">92/100</p>
                  <p className="text-[10px] text-blue-200 mt-2 uppercase font-bold tracking-widest">Forte rétention d'effectifs</p>
               </div>
               <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
            </div>
         </div>
      </div>
    </div>
  );
}
