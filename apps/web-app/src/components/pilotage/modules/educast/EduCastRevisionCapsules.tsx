/**
 * ============================================================================
 * EDUCAST CAPSULES DE RÉVISION
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Search, Filter, BookOpen, Clock, Star, Share2, Loader2, X, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

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

const EMPTY_FORM = { title: '', description: '', type: 'capsule', url: '' };

export default function EduCastRevisionCapsules() {
  const { academicYear } = useModuleContext();
  const { data: capsules, loading, error, refetch } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'capsule' });

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.url) {
      alert('Le titre et l\'URL sont requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/media', { ...formData, type: 'capsule' }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

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
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4 text-[#C9A84C]" />
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

      {/* Modal: Créer une capsule */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Créer une capsule</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Ex: Les identités remarquables"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                  placeholder="Décrivez la capsule..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">URL du média</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
