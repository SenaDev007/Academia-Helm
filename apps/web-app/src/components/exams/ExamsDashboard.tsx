/**
 * ExamsDashboard Component
 * 
 * Vue d'ensemble des certifications et examens.
 */

'use client';

import { 
  Award, 
  Users, 
  Calendar, 
  TrendingUp,
  Target,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExamsDashboard() {
  return (
    <div className="space-y-6">
      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
            { label: 'Taux de Participation', value: '98.2%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Examens en cours', value: '4', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Moyenne Globale', value: '13.45', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Absences Signalées', value: '12', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
         ].map((stat, i) => (
           <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                 <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={cn("p-4 rounded-xl transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                 <stat.icon className="w-6 h-6" />
              </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam Success Forecast */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
           <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                 <Award className="w-5 h-5 text-emerald-500" /> Prévisions de Réussite par Série
              </h3>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">Données SARA AI</span>
           </div>
           <div className="p-8 space-y-8 flex-1">
              {[
                { serie: 'Série C (Sciences)', rate: 82, trend: '+5%', color: 'bg-emerald-500' },
                { serie: 'Série D (Bio-Terre)', rate: 68, trend: '-2%', color: 'bg-blue-500' },
                { serie: 'Série A (Lettres)', rate: 75, trend: '+1%', color: 'bg-indigo-500' },
              ].map((s, i) => (
                <div key={i} className="space-y-3">
                   <div className="flex items-center justify-between">
                      <div>
                         <p className="text-sm font-bold text-slate-900">{s.serie}</p>
                         <p className="text-[10px] text-slate-400 font-medium">Tendance : {s.trend}</p>
                      </div>
                      <span className="text-lg font-black text-slate-900">{s.rate}%</span>
                   </div>
                   <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all duration-1000", s.color)} style={{ width: `${s.rate}%` }} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Next Key Dates */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col">
           <h3 className="font-bold flex items-center gap-2 mb-8 text-emerald-400 uppercase text-xs tracking-widest">
              <Calendar className="w-4 h-4" /> Prochaines Échéances
           </h3>
           <div className="space-y-6 flex-1">
              {[
                { date: '22 MAI', title: 'Délibérations Trimestre 2', type: 'Réunion Commission' },
                { date: '15 JUIN', title: 'Début Baccalauréat Blanc', type: 'Examen National' },
                { date: '30 JUIN', title: 'Proclamation Résultats', type: 'Cérémonie' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group">
                   <div className="flex-shrink-0 w-12 text-center">
                      <p className="text-lg font-black leading-none">{item.date.split(' ')[0]}</p>
                      <p className="text-[10px] font-bold text-emerald-500 mt-1">{item.date.split(' ')[1]}</p>
                   </div>
                   <div className="flex-1 pb-6 border-b border-white/10 group-last:border-0">
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-medium">{item.type}</p>
                   </div>
                </div>
              ))}
           </div>
           <button className="mt-8 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
              Calendrier Complet
           </button>
        </div>
      </div>
    </div>
  );
}
