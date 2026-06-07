/**
 * ============================================================================
 * EDUCAST PLAYLISTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ListMusic, Play, Clock, MoreVertical, Plus, ChevronRight, BookOpen } from 'lucide-react';

export default function EduCastPlaylists() {
  const playlists = [
    { id: 1, title: 'Préparation BAC : Histoire', contents: 12, duration: '4h 20min', target: 'Terminal D', author: 'M. Diallo' },
    { id: 2, title: 'Apprendre l\'Anglais par le Podcast', contents: 8, duration: '1h 45min', target: 'Tous Niveaux', author: 'Mme. Koffi' },
    { id: 3, title: 'Sciences de la Vie : Cycle 4', contents: 15, duration: '2h 10min', target: '3ème', author: 'M. Saliou' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <ListMusic className="w-6 h-6 mr-3 text-rose-600" />
            Playlists EduCast
          </h3>
          <p className="text-slate-500 text-sm font-medium">Parcours d'apprentissage structurés.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          Nouvelle Playlist
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {playlists.map((playlist, i) => (
          <motion.div
            key={playlist.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-slate-900 shadow-xl group-hover:shadow-2xl transition-all mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-600/40 to-navy-900/60 mix-blend-overlay group-hover:opacity-60 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white fill-current" />
                </div>
              </div>
              <div className="absolute bottom-6 right-6 px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-[10px] font-black text-white flex items-center gap-2">
                <ListMusic className="w-3 h-3" />
                {playlist.contents} Vidéos
              </div>
            </div>

            <div className="space-y-4 px-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest rounded-md mb-2 inline-block">{playlist.target}</span>
                  <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-rose-600 transition-colors">{playlist.title}</h4>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl">
                  <MoreVertical className="w-5 h-5 text-slate-300" />
                </button>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{playlist.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Par {playlist.author}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
