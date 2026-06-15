/**
 * TeacherCommunication Component
 * 
 * ONGLET 8 — Communication Enseignants
 * Centralisation des échanges pédagogiques et administratifs avec le corps professoral.
 */

'use client';

import { useState } from 'react';
import { 
  GraduationCap, 
  Search, 
  Send, 
  Filter, 
  FileText,
  AlertCircle,
  MoreVertical,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeacherCommunication() {
  const [teachers] = useState([
    { id: 'TCH-001', name: 'Kouassi Jean', subject: 'Mathématiques', classes: 'Tle C, 1ère C', unread: 2, lastContact: 'Aujourd\'hui, 08:00', status: 'ONLINE' },
    { id: 'TCH-002', name: 'Traoré Aminata', subject: 'Physique-Chimie', classes: 'Tle C, 3ème A', unread: 0, lastContact: 'Hier, 16:30', status: 'OFFLINE' },
    { id: 'TCH-003', name: 'Diallo Oumar', subject: 'Français', classes: '6ème, 5ème', unread: 0, lastContact: 'Lundi, 10:15', status: 'AWAY' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher un enseignant..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
          </div>
          <button className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
            <AlertCircle className="w-4 h-4 text-amber-400" /> Rappel Saisie Notes
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all">
            <MessageSquare className="w-4 h-4" /> Message au Corps Professoral
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-violet-500" /> Répertoire des Enseignants
          </h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-violet-50 border-violet-100 text-violet-600">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full",
                    teacher.status === 'ONLINE' ? "bg-emerald-500" :
                    teacher.status === 'AWAY' ? "bg-amber-500" : "bg-slate-300"
                  )} />
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{teacher.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span className="font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{teacher.subject}</span>
                    <span className="text-slate-300">•</span>
                    <span>Classes : <strong className="text-slate-700">{teacher.classes}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernier Contact</p>
                  <p className="text-xs font-medium text-slate-700 mt-1">{teacher.lastContact}</p>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 bg-violet-50 text-violet-600 rounded-xl hover:bg-violet-100 transition-colors" title="Message interne">
                    <Send className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Dossier RH">
                    <FileText className="w-4 h-4" />
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
