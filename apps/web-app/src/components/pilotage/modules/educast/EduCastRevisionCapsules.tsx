/**
 * ============================================================================
 * EDUCAST CAPSULES DE RÉVISION
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Zap, Play, Search, Filter, BookOpen, Clock, Star, Share2, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  subject?: string;
  category?: string;
  difficulty?: string;
  level?: string;
  duration?: string;
  length?: string;
  rating?: number;
  averageRating?: number;
  score?: number;
}

export default function EduCastRevisionCapsules() {
  const { academicYear } = useModuleContext();
  const { data: capsules, loading, error } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'capsule' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des capsules...</span>
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
            <Zap className="w-6 h-6 mr-3 text-amber-500" />
            Capsules de Révision
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contenus courts (2-5 min) pour mémoriser les points essentiels.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          <span>Créer une Capsule</span>
        </button>
      </div>

      {capsules.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune capsule de révision pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capsules.map((capsule, i) => {
            const title = capsule.title || capsule.name || 'Capsule';
            const subject = capsule.subject || capsule.category || '—';
            const difficulty = capsule.difficulty || capsule.level || 'Moyen';
            const duration = capsule.duration || capsule.length || '—';
            const rating = capsule.rating ?? capsule.averageRating ?? capsule.score ?? 0;
            return (
              <motion.div
                key={capsule.id ?? i}
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
                    {rating}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md mb-2 inline-block ${
                      subject === 'Maths' ? 'bg-blue-50 text-blue-600' :
                      subject === 'Français' ? 'bg-rose-50 text-rose-600' :
                      subject === 'SVT' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {subject}
                    </span>
                    <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{title}</h4>
                  </div>

                  <div className="flex items-center gap-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-slate-300" />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        difficulty === 'Facile' || difficulty === 'EASY' ? 'text-emerald-500' :
                        difficulty === 'Moyen' || difficulty === 'MEDIUM' ? 'text-amber-500' : 'text-rose-500'
                      }`}>{difficulty}</span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
                  <Zap className="w-24 h-24 rotate-12" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
