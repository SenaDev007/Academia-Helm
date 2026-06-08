/**
 * OrionExamVigilance Component
 * 
 * Moteur de vigilance ORION dédié aux examens.
 * Détecte les fraudes potentielles, les anomalies de notation et les chutes de performance suspectes.
 */

'use client';

import { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  Zap,
  Lock,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrionExamVigilance() {
  const [alerts] = useState([
    { id: 'EXM-ALR-001', severity: 'CRITICAL', type: 'FRAUD_RISK', message: 'Incohérence statistique majeure détectée sur les notes de Mathématiques (Série C).', date: 'Il y a 15 min' },
    { id: 'EXM-ALR-002', severity: 'WARNING', type: 'GRADING_ANOMALY', message: 'Écart type anormalement bas constaté dans la salle d\'examen #12.', date: 'Il y a 2h' },
    { id: 'EXM-ALR-003', severity: 'INFO', type: 'SECURITY', message: 'Tentative de modification non autorisée d\'une note déjà validée bloquée par ORION.', date: 'Hier' },
  ]);

  return (
    <div className="space-y-6">
      {/* Orion Exam Banner */}
      <div className="bg-slate-950 rounded-[3rem] p-10 text-white relative overflow-hidden border border-slate-800 shadow-2xl">
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
               <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Orion Exam Security Shield</span>
               </div>
               <h2 className="text-4xl font-black tracking-tighter leading-none mb-4">Intégrité & Vigilance Certificative</h2>
               <p className="text-slate-400 text-sm leading-relaxed">
                  Surveillance algorithmique des processus d'examen. Détection de fraudes, 
                  analyse des écarts types et sécurisation des délibérations.
               </p>
            </div>
            <div className="flex-shrink-0">
               <div className="w-28 h-28 rounded-full border-4 border-emerald-500/20 flex items-center justify-center relative">
                  <ShieldCheck className="w-12 h-12 text-emerald-500" />
                  <div className="absolute inset-0 rounded-full border-t-4 border-emerald-500 animate-spin" />
               </div>
            </div>
         </div>
         {/* Background pattern */}
         <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Security Alerts */}
         <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <Activity className="w-4 h-4 text-emerald-500" /> Journal de Vigilance Examen
            </h3>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
               {alerts.map((alert, i) => (
                 <div key={i} className="p-6 flex items-start gap-6 hover:bg-slate-50 transition-all group">
                    <div className={cn(
                      "p-4 rounded-2xl",
                      alert.severity === 'CRITICAL' ? "bg-rose-50 text-rose-600" :
                      alert.severity === 'WARNING' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {alert.severity === 'CRITICAL' ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                       <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{alert.type}</p>
                          <span className="text-[10px] font-bold text-slate-400">{alert.date}</span>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed font-medium">{alert.message}</p>
                       <div className="mt-4 flex gap-3">
                          <button className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Audit complet</button>
                          <button className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Archiver</button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Statistical Anomaly Detection */}
         <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 italic">Analyse des Écarts Types</h4>
               <div className="space-y-6">
                  {[
                     { label: 'Mathématiques', val: 0.8, status: 'ANORMAL', color: 'text-rose-600' },
                     { label: 'Français', val: 4.2, status: 'NORMAL', color: 'text-emerald-600' },
                     { label: 'Physique', val: 1.1, status: 'SUSPECT', color: 'text-amber-600' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0">
                       <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">{item.label}</p>
                          <p className={cn("text-[10px] font-black uppercase", item.color)}>{item.status}</p>
                       </div>
                       <span className="text-lg font-black text-slate-900">{item.val}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl group overflow-hidden relative">
               <div className="relative z-10">
                  <Lock className="w-8 h-8 mb-4 text-emerald-200 group-hover:scale-110 transition-transform" />
                  <h4 className="font-black text-xl leading-tight">Indice d'Intégrité</h4>
                  <p className="text-4xl font-black mt-2">99.8%</p>
                  <p className="text-[10px] text-emerald-200 mt-2 uppercase font-bold tracking-widest">Processus Hautement Sécurisé</p>
               </div>
               <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
            </div>
         </div>
      </div>
    </div>
  );
}
