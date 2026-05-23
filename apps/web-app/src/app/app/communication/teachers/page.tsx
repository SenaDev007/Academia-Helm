'use client';

import React from 'react';
import { 
  GraduationCap, 
  Search, 
  MessageSquare, 
  Clock, 
  FileText, 
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function TeacherCommunicationPage() {
  const teachers = [
    { id: 1, name: 'Jean Dupont', subject: 'Mathématiques', load: '18h/semaine', lastNote: 'Notes saisies', status: 'OK' },
    { id: 2, name: 'Marie Curie', subject: 'Physique-Chimie', load: '15h/semaine', lastNote: 'Retard de saisie', status: 'WARNING' },
    { id: 3, name: 'Albert Einstein', subject: 'Philosophie', load: '12h/semaine', lastNote: 'Réunion confirmée', status: 'OK' },
  ];

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Banner */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <GraduationCap size={160} />
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-black mb-4 tracking-tight">Communication Enseignants</h3>
            <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-2xl">
              Centralisez les échanges avec le corps professoral. Rappels de saisie, réunions pédagogiques et notes de service.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Enseignants', value: '42', icon: <GraduationCap />, color: 'text-blue-500' },
            { label: 'Réactifs (24h)', value: '38', icon: <Clock />, color: 'text-emerald-500' },
            { label: 'Rappels envoyés', value: '12', icon: <MessageSquare />, color: 'text-amber-500' },
            { label: 'Notes de service', value: '5', icon: <FileText />, color: 'text-blue-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-50 ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Content List */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-blue-600" /> Annuaire Pédagogique
            </h4>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 w-48" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all">
                <Plus size={14} /> Message Groupé
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-slate-50">
            {teachers.map((teacher) => (
              <div key={teacher.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg">
                    {teacher.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{teacher.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{teacher.subject} • {teacher.load}</p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-8">
                  <div className="text-right">
                    <p className={`text-xs font-bold ${teacher.status === 'OK' ? 'text-emerald-600' : 'text-amber-600'} flex items-center gap-1 justify-end`}>
                      {teacher.status === 'OK' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {teacher.lastNote}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Dernière activité</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                      <MessageSquare size={16} />
                    </button>
                    <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                      <Calendar size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}
