'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Megaphone, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Eye, 
  Clock,
  Filter,
  FileText
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([
    { 
      id: 1, 
      title: 'Réunion de rentrée - Parents CM2', 
      audience: 'Parents CM2', 
      priority: 'HIGH', 
      status: 'PUBLISHED', 
      views: 145, 
      date: '2026-05-10',
      category: 'ADMIN'
    },
    { 
      id: 2, 
      title: 'Changement d\'emploi du temps - Classe Terminale C', 
      audience: 'Terminale C', 
      priority: 'CRITICAL', 
      status: 'PUBLISHED', 
      views: 42, 
      date: '2026-05-12',
      category: 'ACADEMIC'
    },
    { 
      id: 3, 
      title: 'Événement sportif : Coupe de l\'école', 
      audience: 'Tous', 
      priority: 'NORMAL', 
      status: 'DRAFT', 
      views: 0, 
      date: '2026-05-20',
      category: 'EVENT'
    },
  ]);

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'CRITICAL': return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">Critique</span>;
      case 'HIGH': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter">Haute</span>;
      default: return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter">Normale</span>;
    }
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header Action Banner */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
          <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
            <Megaphone size={160} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-4xl font-black mb-4 tracking-tight">Annonces Officielles</h3>
            <p className="text-indigo-100 font-medium text-lg leading-relaxed">
              Publiez des communications institutionnelles ciblées et suivez l'engagement de votre communauté scolaire en temps réel.
            </p>
            <div className="flex gap-4 mt-8">
              <button className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-lg">
                <Plus size={20} /> Nouvelle Annonce
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
              Toutes <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{announcements.length}</span>
            </button>
            <button className="bg-white text-slate-500 border border-slate-100 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50">
              Actives
            </button>
            <button className="bg-white text-slate-500 border border-slate-100 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50">
              Brouillons
            </button>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Rechercher une annonce..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div key={ann.id} className="group bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-indigo-100/30 transition-all flex flex-col md:flex-row md:items-center gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${ann.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'} group-hover:scale-105 transition-transform`}>
                <Bell size={24} fill="currentColor" className="opacity-20" />
                <Bell size={24} className="absolute" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{ann.title}</h4>
                  {getPriorityBadge(ann.priority)}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Users size={12} className="text-indigo-400" /> {ann.audience}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400" /> {ann.date}</span>
                  <span className="flex items-center gap-1.5"><FileText size={12} className="text-slate-400" /> {ann.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 pl-6 border-l border-slate-50">
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 flex items-center gap-1">
                    <Eye size={16} className="text-indigo-500" /> {ann.views}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Vues</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                    <CheckCircle2 size={18} />
                  </button>
                  <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                    <Clock size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State Action */}
        <button className="w-full py-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-300 font-black uppercase tracking-widest text-sm hover:border-indigo-300 hover:text-indigo-400 hover:bg-indigo-50/20 transition-all flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-100">
            <Plus size={32} />
          </div>
          Créer une nouvelle annonce officielle
        </button>
      </div>
    </ModuleContentArea>
  );
}
