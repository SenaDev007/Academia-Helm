/**
 * ============================================================================
 * EDUCAST ANALYTICS
 * ============================================================================
 * TODO: endpoint non disponible — `educast/dashboard` n'existe pas encore côté backend.
 *       Les statistiques utilisent des données mockées. Quand l'endpoint sera disponible,
 *       remplacer par : const { data, loading, error } = useModulesDashboard('educast', academicYear?.id);
 *       ou : const stats = await modulesApi.get('educast/stats', buildModulesApiOptions(academicYear.id));
 */

'use client';

import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Play, Clock, Share2, MousePointer2, PieChart } from 'lucide-react';

export default function EduCastAnalytics() {
  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de Complétion</h4>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">74%</div>
          <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg">+5% vs moyenne</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temps Visionnage / Élève</h4>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">42 min</div>
          <p className="text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-0.5 rounded-lg">Hebdomadaire</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Partages Internes</h4>
            <Share2 className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">1,240</div>
          <p className="text-[10px] font-bold text-rose-600 bg-rose-50 w-fit px-2 py-0.5 rounded-lg">+120 aujourd'hui</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engagement Global</h4>
            <MousePointer2 className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">8.5/10</div>
          <p className="text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-lg">Score Sarah AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Engagement Chart Placeholder */}
        <div className="bg-navy-900 rounded-[2.5rem] p-10 text-white min-h-[400px] flex flex-col justify-between shadow-xl shadow-navy-900/20">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">Consultations par Matière</h3>
              <p className="text-white/60 text-sm font-medium">Répartition du temps de visionnage hebdomadaire</p>
            </div>
            <BarChart3 className="w-8 h-8 text-[#C9A84C]" />
          </div>
          
          <div className="flex items-end justify-between h-48 gap-4 px-4">
            {[45, 80, 55, 90, 65, 30].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.1, duration: 1 }}
                className="w-full bg-gradient-to-t from-[#C9A84C]/20 to-[#C9A84C] rounded-t-xl relative group"
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-navy-900 px-2 py-1 rounded text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity">
                  {h}%
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest px-4 pt-8">
            <span>MATHS</span>
            <span>FRANÇAIS</span>
            <span>SVT</span>
            <span>ANGLAIS</span>
            <span>HG</span>
            <span>AUTRE</span>
          </div>
        </div>

        {/* Engagement Level by Class */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Top Classes Actives</h3>
            <PieChart className="w-6 h-6 text-slate-300" />
          </div>
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            {[
              { class: 'Terminal D', score: 98, color: 'bg-emerald-500' },
              { class: '3ème B', score: 85, color: 'bg-blue-500' },
              { class: '6ème A', score: 72, color: 'bg-blue-500' },
              { class: '2nde C', score: 64, color: 'bg-amber-500' },
            ].map((c, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-900">{c.class}</span>
                  <span className="text-slate-500">{c.score}% engagement</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.score}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
                    className={`h-full ${c.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
