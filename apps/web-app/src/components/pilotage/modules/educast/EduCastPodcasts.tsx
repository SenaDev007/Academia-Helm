/**
 * ============================================================================
 * EDUCAST PODCASTS & AUDIOS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Headphones, Search, Filter, Plus, Clock, Play, MoreVertical, Music } from 'lucide-react';

export default function EduCastPodcasts() {
  const podcasts = [
    { id: 1, title: 'Histoire de l\'Afrique : Les Grands Empires', author: 'Prof. Saliou', category: 'Culture', duration: '25:40', date: '12/05/2026', listens: 1450 },
    { id: 2, title: 'English Pronunciation Masterclass', author: 'Ms. Sarah', category: 'Langues', duration: '12:15', date: '10/05/2026', listens: 890 },
    { id: 3, title: 'Résumé de cours : La littérature négro-africaine', author: 'Mme. Koffi', category: 'Français', duration: '08:30', date: '08/05/2026', listens: 670 },
    { id: 4, title: 'Conseils pour les examens de fin d\'année', author: 'Direction', category: 'Orientation', duration: '15:00', date: '05/05/2026', listens: 2100 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Headphones className="w-6 h-6 mr-3 text-indigo-600" />
            Podcasts & Audios
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contenus audio pour apprendre partout, tout le temps.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
          Publier Podcast
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {podcasts.map((podcast, i) => (
          <motion.div
            key={podcast.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-center gap-6 flex-1">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Music className="w-8 h-8" />
                </div>
                <button className="absolute -bottom-2 -right-2 p-2 bg-[#C9A84C] rounded-full text-navy-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-4 h-4 fill-current" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md">{podcast.category}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{podcast.date}</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{podcast.title}</h4>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tighter">Par {podcast.author}</p>
              </div>
            </div>

            <div className="flex items-center gap-12">
              <div className="text-right hidden md:block">
                <p className="text-xs font-black text-slate-900 flex items-center justify-end">
                  <Clock className="w-3.5 h-3.5 mr-2 text-slate-300" />
                  {podcast.duration}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Durée</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-900">{podcast.listens.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Écoutes</p>
              </div>
              <button className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
