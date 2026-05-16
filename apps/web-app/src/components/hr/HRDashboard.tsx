/**
 * HRDashboard Component
 * 
 * Vue d'ensemble du capital humain.
 */

'use client';

import { 
  Users, 
  Clock, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HRDashboard() {
  return (
    <div className="space-y-6">
      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'Nouveaux ce mois', value: '12', icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: 'Taux de Rétention', value: '98.5%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: 'Absences (Moy.)', value: '2.4j', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
           { label: 'Alerte Contrats', value: '5', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
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
        {/* Left: Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-blue-600" /> Activité Récente RH
              </h3>
              <button className="text-xs font-bold text-blue-600 hover:underline">Voir tout</button>
           </div>
           <div className="divide-y divide-slate-100">
              {[
                { name: 'Dr. Kouadio Koffi', type: 'Signature Contrat', date: 'Aujourd\'hui 09:45', color: 'bg-emerald-500' },
                { name: 'Mme. Traoré Alima', type: 'Demande de Congé', date: 'Hier 16:30', color: 'bg-amber-500' },
                { name: 'M. Sylla Moussa', type: 'Nouvelle Affectation', date: 'Hier 11:15', color: 'bg-blue-500' },
              ].map((act, i) => (
                <div key={i} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:bg-white transition-colors">
                         {act.name.charAt(0)}
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-900">{act.name}</p>
                         <p className="text-xs text-slate-400">{act.type}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-medium">{act.date}</p>
                      <div className={cn("w-2 h-2 rounded-full ml-auto mt-1", act.color)} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Right: Department Distribution */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between">
           <div>
              <h3 className="font-bold flex items-center gap-2 mb-6">
                 <Users className="w-4 h-4 text-blue-400" /> Effectif par Département
              </h3>
              <div className="space-y-6">
                 {[
                   { label: 'Enseignement', value: 65, color: 'bg-blue-500' },
                   { label: 'Administration', value: 20, color: 'bg-emerald-500' },
                   { label: 'Logistique', value: 15, color: 'bg-amber-500' },
                 ].map((dept, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                         <span className="text-slate-400 font-bold uppercase tracking-widest">{dept.label}</span>
                         <span className="font-black">{dept.value}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                         <div className={cn("h-full rounded-full transition-all duration-1000", dept.color)} style={{ width: `${dept.value}%` }} />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
           <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                 "La force d'une institution réside dans l'excellence de son capital humain."
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
