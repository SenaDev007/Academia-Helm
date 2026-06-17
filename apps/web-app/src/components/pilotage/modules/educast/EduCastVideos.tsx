/**
 * ============================================================================
 * EDUCAST VIDEOS PÉDAGOGIQUES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Play, Search, Filter, Plus, Clock, Eye, GraduationCap, ChevronRight, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  subject?: string;
  category?: string;
  level?: string;
  targetLevel?: string;
  author?: string;
  uploadedBy?: string;
  teacherName?: string;
  duration?: string;
  length?: string;
  views?: number;
  viewCount?: number;
  thumbnail?: string;
  thumbnailUrl?: string;
}

export default function EduCastVideos() {
  const { academicYear } = useModuleContext();
  const { data: videos, loading, error } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'video' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des vidéos...</span>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <GraduationCap className="w-6 h-6 mr-3 text-blue-600" />
            Vidéos Pédagogiques
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contenus éducatifs structurés par niveau et matière.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher un cours..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none shadow-sm" />
          </div>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Ajouter Vidéo</span>
          </button>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune vidéo pédagogique pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((video, i) => {
            const title = video.title || video.name || 'Vidéo';
            const subject = video.subject || video.category || '—';
            const level = video.level || video.targetLevel || '—';
            const author = video.author || video.teacherName || video.uploadedBy || '—';
            const duration = video.duration || video.length || '—';
            const views = video.views ?? video.viewCount ?? 0;
            const thumbnail = video.thumbnail || video.thumbnailUrl;
            return (
              <motion.div
                key={video.id ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-navy-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <div className="p-4 bg-[#C9A84C] rounded-full scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-8 h-8 text-navy-900 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white z-10">
                    {duration}
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 rounded-lg text-[9px] font-black text-white uppercase tracking-widest z-10">
                    {subject}
                  </div>
                  {thumbnail ? (
                    <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{level}</p>
                    <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[40px]">{title}</h4>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{author}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black">{views}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
