/**
 * StudentCommunication Component
 * 
 * ONGLET 9 — Communication Élèves
 * Annonces, alertes et notifications directes vers le portail Élève.
 */

'use client';

import { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Send, 
  Filter, 
  AlertCircle,
  MoreVertical,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StudentCommunication() {
  const [students] = useState([
    { id: 'STU-001', name: 'Amadou Koné', class: 'Terminale C', alerts: 0, lastLogin: 'Aujourd\'hui, 10:30', status: 'ACTIVE' },
    { id: 'STU-002', name: 'Fatou Diallo', class: '3ème A', alerts: 1, lastLogin: 'Hier, 15:45', status: 'ACTIVE' },
    { id: 'STU-003', name: 'Ibrahim Sylla', class: 'Terminale C', alerts: 3, lastLogin: '10 Mai 2026', status: 'INACTIVE' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher un élève..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
          </div>
          <select className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-600 focus:ring-2 focus:ring-violet-500/20">
            <option>Toutes les classes</option>
            <option>Terminale C</option>
            <option>3ème A</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all">
            <Bell className="w-4 h-4" /> Alerte Devoir
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all">
            <Send className="w-4 h-4" /> Message Direct
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" /> Répertoire des Élèves (Portail)
          </h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {students.map((student) => (
            <div key={student.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border",
                    student.status === 'INACTIVE' ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                  )}>
                    <BookOpen className="w-6 h-6" />
                  </div>
                  {student.alerts > 0 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                      {student.alerts}
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{student.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span className="font-medium text-slate-700">{student.class}</span>
                    <span className="text-slate-300">•</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      student.status === 'ACTIVE' ? "text-emerald-500" : "text-slate-400"
                    )}>
                      {student.status === 'ACTIVE' ? 'Compte Actif' : 'Jamais Connecté'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernière Connexion</p>
                  <p className="text-xs font-medium text-slate-700 mt-1">{student.lastLogin}</p>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors" title="Notification Portail">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-violet-50 text-violet-600 rounded-xl hover:bg-violet-100 transition-colors" title="Message privé">
                    <Send className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
