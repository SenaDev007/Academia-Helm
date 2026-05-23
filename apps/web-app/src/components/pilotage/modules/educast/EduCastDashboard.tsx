/**
 * ============================================================================
 * EDUCAST DASHBOARD
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Play, Headphones, Users, Star, Eye, Clock, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

export default function EduCastDashboard() {
  const stats = [
    { label: 'Contenus Publiés', value: '458', icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12 ce mois' },
    { label: 'Vues Totales', value: '12.5k', icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+24% vs avril' },
    { label: 'Revenus (FCFA)', value: '245k', icon: Star, color: 'text-[#C9A84C]', bg: 'bg-amber-50', trend: '+15% ce mois' },
    { label: 'Ventes Contenus', value: '124', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '85% conversion' },
  ];

  const recentContents = [
    { id: 1, title: 'La Révolution Française - Partie 1', type: 'Vidéo', duration: '12:45', author: 'M. Diallo', views: 245, status: 'PUBLISHED', monetization: 'GRATUIT' },
    { id: 2, title: 'Pack : Les secrets de la grammaire', type: 'Pack', duration: '05:30', author: 'Mme. Koffi', views: 189, status: 'PUBLISHED', monetization: 'PAYANT', price: '2.500' },
    { id: 3, title: 'Capsule : Les équations du second degré', type: 'Capsule', duration: '03:15', author: 'M. Lawson', views: 412, status: 'PUBLISHED', monetization: 'GRATUIT' },
    { id: 4, title: 'Annonce : Fête de fin d\'année', type: 'Vidéo', duration: '01:20', author: 'Direction', views: 856, status: 'PUBLISHED', monetization: 'GRATUIT' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</h4>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-bold text-emerald-600">{stat.trend}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Contents */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Publications Récentes</h3>
            <button className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Voir Tout</button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {recentContents.map((content) => (
                <div key={content.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {content.type === 'Vidéo' ? <Play className="w-6 h-6" /> : content.type === 'Audio' ? <Headphones className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{content.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{content.type} • {content.author} • {content.duration}</p>
                    </div>
                  </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-900">{content.views}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vues</p>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${content.monetization === 'PAYANT' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          {content.monetization === 'PAYANT' ? `${content.price} F` : 'Gratuit'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                    </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Health / Modération */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">État du Système</h3>
          <div className="bg-navy-900 rounded-3xl p-8 text-white space-y-8 relative overflow-hidden shadow-xl shadow-navy-900/20">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Star className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#C9A84C]" />
                <p className="text-sm font-black uppercase tracking-widest">Modération Active</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl font-black text-[#C9A84C]">0</p>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Contenus en attente</p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-2">
                  <span>Stockage Utilisé</span>
                  <span>65%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#C9A84C] w-[65%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Rappel Modération</p>
              <p className="text-xs text-amber-800/70 font-medium leading-relaxed">Les vidéos d'élèves doivent être validées sous 24h par le responsable communication.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
