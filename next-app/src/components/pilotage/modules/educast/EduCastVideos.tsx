/**
 * ============================================================================
 * EDUCAST VIDEOS PÉDAGOGIQUES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Play, Search, Filter, Plus, Clock, Eye, GraduationCap, ChevronRight } from 'lucide-react';

export default function EduCastVideos() {
  const videos = [
    { id: 1, title: 'La photosynthèse expliquée', subject: 'SVT', level: '3ème', author: 'M. Diallo', duration: '15:20', views: 340, thumbnail: '/api/placeholder/400/225' },
    { id: 2, title: 'Résolution des systèmes d\'équations', subject: 'Maths', level: 'Terminale', author: 'M. Lawson', duration: '22:10', views: 512, thumbnail: '/api/placeholder/400/225' },
    { id: 3, title: 'The Industrial Revolution', subject: 'Anglais', level: '2nde', author: 'Mme. Koffi', duration: '18:45', views: 215, thumbnail: '/api/placeholder/400/225' },
    { id: 4, title: 'Lecture de cartes géographiques', subject: 'HG', level: '6ème', author: 'Mme. Goussi', duration: '12:30', views: 890, thumbnail: '/api/placeholder/400/225' },
  ];

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {videos.map((video, i) => (
          <motion.div
            key={video.id}
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
                {video.duration}
              </div>
              <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 rounded-lg text-[9px] font-black text-white uppercase tracking-widest z-10">
                {video.subject}
              </div>
              <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{video.level}</p>
                <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[40px]">{video.title}</h4>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-100" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{video.author}</p>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black">{video.views}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
