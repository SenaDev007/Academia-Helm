/**
 * ============================================================================
 * LIBRARY RECOMMENDATIONS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Sparkles, GraduationCap, Users, BookOpen, Star, Send, Plus, ChevronRight } from 'lucide-react';

export default function LibraryRecommendations() {
  const recommendations = [
    { id: 'REC-001', target: 'Terminal D', type: 'CLASSE', book: 'Annales BAC Mathématiques', reason: 'Préparation intensive examen', teacher: 'M. Diallo' },
    { id: 'REC-002', target: '6ème A', type: 'CLASSE', book: 'Le Petit Prince', reason: 'Lecture obligatoire trimestre 3', teacher: 'Mme. Goussi' },
    { id: 'REC-003', target: 'Saliou Diallo', type: 'ÉLÈVE', book: 'L\'Enfant Noir', reason: 'Excellence en littérature', teacher: 'M. Lawson' },
  ];

  return (
    <div className="space-y-8">
      {/* AI Recommendation Spotlight */}
      <div className="bg-gradient-to-r from-navy-900 to-blue-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm text-[#C9A84C]">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">Sarah AI Suggestion</h3>
              <p className="text-white/60 text-sm font-medium">Basé sur les performances de la classe 3ème B</p>
            </div>
          </div>
          <p className="text-lg font-medium max-w-2xl text-white/90 leading-relaxed">
            "Le livre <span className="font-black text-[#C9A84C]">Physique-Chimie 3ème</span> est recommandé pour cette période afin d'accompagner le chapitre sur la pesanteur. 85% des élèves l'ont trouvé utile l'an dernier."
          </p>
          <div className="flex gap-3">
            <button className="px-6 py-2.5 bg-[#C9A84C] text-navy-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#C9A84C]/20 hover:scale-105 transition-all">
              Partager avec la classe
            </button>
            <button className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
              Ignorer
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
          <GraduationCap className="w-6 h-6 mr-3 text-emerald-600" />
          Recommandations Pédagogiques
        </h3>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4 text-[#C9A84C]" />
          <span>Créer une recommandation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex items-start gap-8">
              <div className="w-20 h-28 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 font-black text-xs uppercase group-hover:bg-blue-50 transition-colors shrink-0">
                LIVRE
              </div>
              <div className="space-y-4 flex-1">
                <div className="flex justify-between">
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    rec.type === 'CLASSE' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {rec.type}: {rec.target}
                  </span>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((_, j) => (
                      <div key={j} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white" />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{rec.book}</h4>
                  <p className="text-sm font-medium text-slate-500 mt-2 italic">"{rec.reason}"</p>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommandé par {rec.teacher}</p>
                  </div>
                  <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
