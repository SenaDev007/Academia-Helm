/**
 * ============================================================================
 * EDUCAST CONTENT PACKS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ListMusic, Play, Clock, MoreVertical, Plus, ChevronRight, BookOpen, GraduationCap, Package } from 'lucide-react';

export default function EduCastPacks() {
  const packs = [
    { id: 1, title: 'Pack Révision BEPC : Math & Physique', contents: 24, duration: '12h 45min', price: '15.000', author: 'M. Koffi', sales: 45 },
    { id: 2, title: 'Maîtriser les Verbes Irréguliers', contents: 8, duration: '2h 10min', price: '3.500', author: 'Mme. Koffi', sales: 120 },
    { id: 3, title: 'SVT : Le Programme Complet 3ème', contents: 32, duration: '18h 30min', price: '25.000', author: 'M. Saliou', sales: 28 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Package className="w-6 h-6 mr-3 text-rose-600" />
            Packs de Contenus Premium
          </h3>
          <p className="text-slate-500 text-sm font-medium">Groupement de vidéos, documents et quiz pour un apprentissage complet.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          Créer un Pack
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {packs.map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-slate-900 shadow-xl group-hover:shadow-2xl transition-all mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-600 to-navy-900 opacity-60 mix-blend-overlay group-hover:opacity-80 transition-opacity" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <Package className="w-12 h-12 mb-4 text-[#C9A84C]" />
                <p className="text-3xl font-black tracking-tighter">{pack.price} <span className="text-xs">FCFA</span></p>
              </div>
              <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">
                {pack.sales} Ventes
              </div>
            </div>

            <div className="space-y-4 px-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-rose-600 transition-colors line-clamp-1">{pack.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Par {pack.author}</p>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl">
                  <MoreVertical className="w-5 h-5 text-slate-300" />
                </button>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{pack.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{pack.contents} Contenus</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
