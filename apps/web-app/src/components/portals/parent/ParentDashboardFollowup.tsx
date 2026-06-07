'use client';

import { motion } from 'framer-motion';
import {
  ClipboardList,
  Bell,
  AlertCircle,
  BookOpen,
  NotebookPen,
  ChevronRight,
  Zap,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function ParentDashboardFollowup() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Main Stats Block */}
      <div className="lg:col-span-2 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ClipboardList className="w-40 h-40 text-indigo-600" />
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Suivi pédagogique</h3>
            <p className="text-sm text-slate-500">Activités et progrès de votre enfant</p>
          </div>
          <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all">
            Voir le détail
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'À faire', val: 5, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'En retard', val: 2, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
            { label: 'Non faits', val: 1, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Récitations', val: 3, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/30 flex flex-col items-center text-center">
              <div className={`p-2 rounded-lg mb-2 ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-slate-900">{stat.val}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-50">
           <div className="flex items-center justify-between mb-4">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dernières observations</span>
           </div>
           <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <NotebookPen className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  &quot;Trés bon effort sur la dernière recherche historique. La présentation était soignée.&quot;
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">— M. DJOSSOU, Histoire-Géo</p>
              </div>
           </div>
        </div>
      </div>

      {/* ORION / Alerts Sidebar */}
      <div className="p-8 bg-indigo-900 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10">
          <Zap className="w-48 h-48" />
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <h3 className="font-bold">Analyse ORION</h3>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-300 uppercase">Engagement</span>
              <span className="text-sm font-bold">Excellent</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400" style={{ width: '92%' }} />
            </div>
            <p className="text-[10px] text-indigo-200 mt-2">Votre enfant est dans le top 5% de la classe sur les devoirs rendus.</p>
          </div>

          <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
            <div className="flex items-center gap-2 text-rose-300 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Points d'attention</span>
            </div>
            <p className="text-[10px] text-rose-100 leading-relaxed">
              2 leçons de Sciences n'ont pas été copiées cette semaine. Un suivi à la maison est recommandé.
            </p>
          </div>

          <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
            Consulter la timeline complète
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
