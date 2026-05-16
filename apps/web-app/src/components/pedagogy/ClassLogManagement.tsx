/**
 * ClassLogManagement Component
 * 
 * Cahier de textes digital. Gestion des séances, leçons et devoirs.
 */

'use client';

import { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  Clock, 
  FileText,
  Calendar,
  Search,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClassLogManagement() {
  const [logs] = useState([
    { id: 'LOG-001', subject: 'Mathématiques', class: 'Terminale C', topic: 'Intégrales définies', date: 'Aujourd\'hui', status: 'COMPLETED', homework: 'Ex. 4, 5 p. 112' },
    { id: 'LOG-002', subject: 'Physique', class: 'Terminale C', topic: 'Lois de Newton', date: 'Aujourd\'hui', status: 'IN_PROGRESS', homework: 'Révision chap. 3' },
    { id: 'LOG-003', subject: 'Philosophie', class: 'Terminale C', topic: 'La Conscience', date: 'Hier', status: 'COMPLETED', homework: 'Dissertation' },
  ]);

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Rechercher une séance ou une leçon..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10">
          <Plus className="w-4 h-4" /> Remplir Cahier de Textes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Timeline of Sessions */}
        <div className="lg:col-span-3 space-y-4">
           {logs.map((log) => (
             <div key={log.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-start gap-6 group">
                <div className="flex flex-col items-center">
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110",
                     log.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                   )}>
                      {log.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                   </div>
                   <div className="w-0.5 h-full bg-slate-100 group-last:hidden" />
                </div>
                <div className="flex-1">
                   <div className="flex items-center justify-between mb-1">
                      <h4 className="text-lg font-black text-slate-900">{log.topic}</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.date}</span>
                   </div>
                   <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-md uppercase">{log.subject}</span>
                      <span className="text-xs font-medium text-slate-400">{log.class}</span>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                         <FileText className="w-3 h-3" /> Travail à faire (Devoirs)
                      </p>
                      <p className="text-sm font-medium text-slate-700">{log.homework}</p>
                   </div>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                   <Clock className="w-5 h-5 text-slate-300" />
                </button>
             </div>
           ))}
        </div>

        {/* Right: Quick Stats & Calendar */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                 <h3 className="font-bold mb-6 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Aperçu Hebdomadaire
                 </h3>
                 <div className="space-y-4">
                    {[
                      { day: 'Lundi', count: 6 },
                      { day: 'Mardi', count: 5 },
                      { day: 'Mercredi', count: 4 },
                      { day: 'Jeudi', count: 6 },
                      { day: 'Vendredi', count: 5 },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                         <span className="text-xs text-slate-400 w-16">{d.day}</span>
                         <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(d.count / 8) * 100}%` }} />
                         </div>
                         <span className="text-[10px] font-bold">{d.count}h</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
