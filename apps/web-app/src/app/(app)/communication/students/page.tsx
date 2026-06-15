'use client';

import React from 'react';
import { 
  User, 
  Search, 
  Bell, 
  BookOpen, 
  Trophy, 
  Zap,
  Filter,
  ArrowRight,
  Sparkles,
  Layout
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function StudentCommunicationPage() {
  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Banner with modern aesthetic */}
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-violet-200">
          <div className="absolute -bottom-10 -right-10 opacity-10">
            <User size={240} />
          </div>
          <div className="relative z-10">
            <div className="bg-white/20 backdrop-blur-xl w-fit px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-white/30">
              Engagement Élève
            </div>
            <h3 className="text-5xl font-black mb-4 tracking-tighter leading-none">Dialoguez avec <br/>vos apprenants.</h3>
            <p className="text-violet-100 font-medium text-lg leading-relaxed max-w-xl opacity-90">
              Diffusez des informations pédagogiques, des rappels d'examens et célébrez les réussites scolaires directement sur leur portail.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
                <Bell size={14} className="text-violet-600" /> Annonces Élèves Récentes
              </h4>
              <button className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline">Voir tout</button>
            </div>

            {[
              { title: 'Nouvelle ressource disponible : Algèbre Linéaire', target: 'Terminales', type: 'ACADEMIC', date: 'Aujourd\'hui', icon: <BookOpen size={18}/>, color: 'bg-blue-50 text-blue-600' },
              { title: 'Rappel : Épreuve blanche de Français demain', target: '3ème A, B', type: 'EXAM', date: 'Hier', icon: <Zap size={18}/>, color: 'bg-amber-50 text-amber-600' },
              { title: 'Félicitations au club de robotique !', target: 'Tous', type: 'NEWS', date: 'Il y a 3 jours', icon: <Trophy size={18}/>, color: 'bg-emerald-50 text-emerald-600' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-6 border border-slate-100 flex items-center justify-between hover:shadow-lg hover:shadow-slate-100 transition-all">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color}`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.target} • {item.date}</p>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                  <ArrowRight size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Section */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
              <Sparkles className="absolute top-4 right-4 text-violet-400 opacity-50" size={24} />
              <h5 className="text-xl font-black mb-4 tracking-tight">Ciblage Intelligent</h5>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                Utilisez Sara AI pour segmenter les élèves selon leurs performances ou leurs besoins spécifiques.
              </p>
              <button className="w-full bg-violet-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/50">
                Lancer une recommandation
              </button>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
              <h5 className="font-black text-slate-900 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <Layout size={14} className="text-slate-400" /> Configuration Portail
              </h5>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Notifications Push</span>
                  <div className="w-8 h-4 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 opacity-50">
                  <span className="text-xs font-bold text-slate-600">Echanges directs</span>
                  <div className="w-8 h-4 bg-slate-300 rounded-full relative"><div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}
