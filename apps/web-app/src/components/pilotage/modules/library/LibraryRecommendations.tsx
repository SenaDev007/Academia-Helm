/**
 * ============================================================================
 * LIBRARY RECOMMENDATIONS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)  : GET  /modules-complementaires/library/recommendations
 * Endpoint (création): POST /modules-complementaires/library/recommendations
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, GraduationCap, Plus, Send, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface RecommendationItem {
  id: string;
  target?: string;
  targetName?: string;
  audience?: string;
  type?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  reason?: string;
  description?: string;
  teacher?: string;
  author?: string;
  createdBy?: string;
  [key: string]: any;
}

interface NewRecommendationFormData {
  bookId: string;
  comment: string;
}

const emptyRecForm: NewRecommendationFormData = { bookId: '', comment: '' };

export default function LibraryRecommendations() {
  const { academicYear } = useModuleContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewRecommendationFormData>(emptyRecForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: recommendations, loading, error, refetch } = useModulesList<RecommendationItem>(
    'library',
    'recommendations',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/recommendations',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyRecForm);
      await refetch();
    } catch (e: any) {
      console.error('Erreur création recommandation :', e?.message || e);
      alert(e?.message || 'Erreur lors de la création de la recommandation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des recommandations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les recommandations. {error}
        </div>
      )}

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
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4 text-[#C9A84C]" />
          <span>Créer une recommandation</span>
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-slate-200">
          Aucune recommandation pédagogique pour cette année scolaire.
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recommendations.map((rec, i) => {
          const target = rec.target ?? rec.targetName ?? rec.audience ?? '—';
          const type = (rec.type ?? 'CLASSE').toString().toUpperCase();
          const bookTitle = rec.book ?? rec.bookTitle ?? rec.title ?? '—';
          const reason = rec.reason ?? rec.description ?? '';
          const teacher = rec.teacher ?? rec.author ?? rec.createdBy ?? '—';
          return (
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
                    type === 'CLASSE' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {type}: {target}
                  </span>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((_, j) => (
                      <div key={j} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white" />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{bookTitle}</h4>
                  {reason && <p className="text-sm font-medium text-slate-500 mt-2 italic">"{reason}"</p>}
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommandé par {teacher}</p>
                  </div>
                  <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
      )}

      {/* Modal Créer une recommandation */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">Créer une recommandation</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Livre (ID)</label>
                <input
                  type="text"
                  placeholder="ex : book-456"
                  value={formData.bookId}
                  onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Commentaire</label>
                <textarea
                  rows={4}
                  placeholder="Raison pédagogique..."
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Recommander'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
