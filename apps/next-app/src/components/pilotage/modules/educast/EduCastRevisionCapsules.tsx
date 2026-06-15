/**
 * ============================================================================
 * EDUCAST CAPSULES DE RÉVISION
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Zap, Play, Search, Filter, BookOpen, Clock, Star, Share2 } from 'lucide-react';

export default function EduCastRevisionCapsules() {
  const capsules = [
    { id: 1, title: 'Calcul des dérivées usuelles', subject: 'Maths', difficulty: 'Moyen', duration: '03:45', rating: 4.8 },
    { id: 2, title: 'L\'accord du participe passé', subject: 'Français', difficulty: 'Facile', duration: '04:12', rating: 4.9 },
    { id: 3, title: 'Structure de la cellule', subject: 'SVT', difficulty: 'Difficile', duration: '05:30', rating: 4.7 },
    { id: 4, title: 'Les temps du passé en anglais', subject: 'Anglais', difficulty: 'Facile', duration: '02:50', rating: 4.6 },
    { id: 5, title: 'Dates clés : Guerre Froide', subject: 'Histoire', difficulty: 'Moyen', duration: '04:45', rating: 4.9 },
    { id: 6, title: 'Lois de Newton', subject: 'Physique', difficulty: 'Difficile', duration: '06:15', rating: 4.8 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Zap className="w-6 h-6 mr-3 text-amber-500" />
            Capsules de Révision
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contenus courts (2-5 min) pour mémoriser les points essentiels.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          <span>Créer une Capsule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {capsules.map((capsule, i) => (
          <motion.div
            key={capsule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <div className="flex items-center gap-1.5 text-amber-500 font-black text-xs">
                <Star className="w-4 h-4 fill-current" />
                {capsule.rating}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md mb-2 inline-block ${
                  capsule.subject === 'Maths' ? 'bg-blue-50 text-blue-600' :
                  capsule.subject === 'Français' ? 'bg-rose-50 text-rose-600' :
                  capsule.subject === 'SVT' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  {capsule.subject}
                </span>
                <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{capsule.title}</h4>
              </div>

              <div className="flex items-center gap-6 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{capsule.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-slate-300" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    capsule.difficulty === 'Facile' ? 'text-emerald-500' :
                    capsule.difficulty === 'Moyen' ? 'text-amber-500' : 'text-rose-500'
                  }`}>{capsule.difficulty}</span>
                </div>
              </div>
            </div>

            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
              <Zap className="w-24 h-24 rotate-12" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
