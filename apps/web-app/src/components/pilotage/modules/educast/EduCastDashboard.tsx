/**
 * ============================================================================
 * EDUCAST DASHBOARD
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Play, Headphones, Users, Star, Eye, Clock, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Zap, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface EduCastStats {
  totalContents?: number;
  totalViews?: number;
  activeChannels?: number;
  totalSubscribers?: number;
  recentContents?: Array<{ id: string | number; title: string; type: string; duration: string; author: string; views: number; status: string; monetization: string; price?: string }>;
  topChannels?: Array<{ id?: string; name?: string; subscribers?: number; views?: number }>;
}

const DEFAULT_STATS: EduCastStats = {
  totalContents: 0,
  totalViews: 0,
  activeChannels: 0,
  totalSubscribers: 0,
  recentContents: [],
  topChannels: [],
};

export default function EduCastDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<EduCastStats>('educast', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  const kpiCards = [
    { label: 'Contenus Publiés', value: String(stats.totalContents ?? 0), icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12 ce mois' },
    { label: 'Vues Totales', value: (stats.totalViews ?? 0).toLocaleString('fr-FR'), icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+24% vs avril' },
    { label: 'Chaînes Actives', value: String(stats.activeChannels ?? 0), icon: Star, color: 'text-[#C9A84C]', bg: 'bg-amber-50', trend: 'Dont 3 certifiées' },
    { label: 'Abonnés', value: (stats.totalSubscribers ?? 0).toLocaleString('fr-FR'), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+85 cette semaine' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((stat, i) => (
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
              {(stats.recentContents?.length ? stats.recentContents : []).map((content) => (
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
                          {content.monetization === 'PAYANT' ? `${content.price ?? '0'} F` : 'Gratuit'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                    </div>
                </div>
              ))}
              {(!stats.recentContents || stats.recentContents.length === 0) && (
                <div className="text-center py-12 text-sm text-slate-400">
                  Aucune publication récente.
                </div>
              )}
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
