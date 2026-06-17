/**
 * ============================================================================
 * EDUCAST PODCASTS & AUDIOS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Headphones, Search, Filter, Plus, Clock, Play, MoreVertical, Music, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  teacherName?: string;
  uploadedBy?: string;
  category?: string;
  duration?: string;
  length?: string;
  date?: string;
  createdAt?: string;
  listens?: number;
  viewCount?: number;
  views?: number;
}

export default function EduCastPodcasts() {
  const { academicYear } = useModuleContext();
  const { data: podcasts, loading, error } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'podcast' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des podcasts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Headphones className="w-6 h-6 mr-3 text-blue-600" />
            Podcasts & Audios
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contenus audio pour apprendre partout, tout le temps.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
          Publier Podcast
        </button>
      </div>

      {podcasts.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucun podcast pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {podcasts.map((podcast, i) => {
            const title = podcast.title || podcast.name || 'Podcast';
            const author = podcast.author || podcast.teacherName || podcast.uploadedBy || '—';
            const category = podcast.category || 'Audio';
            const date = podcast.date || (podcast.createdAt ? new Date(podcast.createdAt).toLocaleDateString('fr-FR') : '—');
            const duration = podcast.duration || podcast.length || '—';
            const listens = podcast.listens ?? podcast.viewCount ?? podcast.views ?? 0;
            return (
              <motion.div
                key={podcast.id ?? i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Music className="w-8 h-8" />
                    </div>
                    <button className="absolute -bottom-2 -right-2 p-2 bg-[#C9A84C] rounded-full text-navy-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md">{category}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{date}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{title}</h4>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tighter">Par {author}</p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-black text-slate-900 flex items-center justify-end">
                      <Clock className="w-3.5 h-3.5 mr-2 text-slate-300" />
                      {duration}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Durée</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{listens.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Écoutes</p>
                  </div>
                  <button className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-300" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
