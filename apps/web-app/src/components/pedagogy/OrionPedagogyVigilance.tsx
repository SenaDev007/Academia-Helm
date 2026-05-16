/**
 * OrionPedagogyVigilance Component
 * 
 * Moteur de vigilance pédagogique ORION.
 * Détecte les baisses de niveau, les examens manquants et les retards de programme.
 */

'use client';

import { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  BookOpen,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrionPedagogyVigilance() {
  const [alerts] = useState([
    { id: 'PED-ALR-001', severity: 'CRITICAL', type: 'PERFORMANCE', message: 'La moyenne de la 3ème A a chuté de 3.5 points en Mathématiques.', date: 'Il y a 30 min' },
    { id: 'PED-ALR-002', severity: 'WARNING', type: 'CURRICULUM', message: 'Retard de 15% détecté sur le programme de Français (Cycle 4).', date: 'Hier' },
    { id: 'PED-ALR-003', severity: 'INFO', type: 'ASSESSMENT', message: '3 évaluations prévues en Terminale n\'ont pas encore de notes saisies.', date: 'Hier' },
  ]);

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
            <div className="flex-shrink-0">
               <div className="w-32 h-32 rounded-full bg-indigo-900/50 flex items-center justify-center border border-white/10 relative">
                  <Activity className="w-12 h-12 text-indigo-400 animate-pulse" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                     <circle cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                     <circle cx="64" cy="64" r="60" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="377" strokeDashoffset="80" className="text-indigo-500" />
                  </svg>
               </div>
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
               {alerts.map((alert, i) => (
                 <div key={i} className="p-6 flex items-start gap-6 hover:bg-slate-50 transition-all group">
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
                          <span className="text-[10px] font-bold text-slate-400">{alert.date}</span>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed font-medium">{alert.message}</p>
                       <div className="mt-4 flex gap-2">
                          <button className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10">Détails</button>
                          <button className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all">Ignorer</button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Advanced Metrics */}
         <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Points de Risque Académique</h4>
               <div className="space-y-6">
                  {[
                    { label: 'Décrochage', value: 5.2, color: 'text-rose-600', trend: 'up' },
                    { label: 'Excellence', value: 18.5, color: 'text-emerald-600', trend: 'up' },
                    { label: 'Inégalités', value: 12.4, color: 'text-amber-600', trend: 'down' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-500">{m.label}</span>
                       <div className="flex items-center gap-3">
                          <span className={cn("text-lg font-black", m.color)}>{m.value}%</span>
                          {m.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Avancement Global Programme</h4>
               <div className="text-center py-4">
                  <div className="text-5xl font-black text-slate-900 leading-none">78.5%</div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase mt-2">+5% par rapport à l'année dernière</p>
               </div>
               <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '78.5%' }} />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
