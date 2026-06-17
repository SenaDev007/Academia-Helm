/**
 * ============================================================================
 * EDUCAST PLAYLISTS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play, Clock, MoreVertical, Plus, ChevronRight, BookOpen, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface PlaylistItem {
  id: string | number;
  title?: string;
  name?: string;
  contents?: number;
  contentCount?: number;
  itemCount?: number;
  duration?: string;
  totalDuration?: string;
  target?: string;
  targetLevel?: string;
  audience?: string;
  author?: string;
  createdBy?: string;
  teacherName?: string;
}

const EMPTY_FORM = { name: '', description: '' };

export default function EduCastPlaylists() {
  const { academicYear } = useModuleContext();
  const { data: playlists, loading, error, refetch } = useModulesList<PlaylistItem>('educast', 'playlists', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.name) {
      alert('Le nom est requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/playlists', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la création de la playlist');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des playlists...</span>
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
            <ListMusic className="w-6 h-6 mr-3 text-rose-600" />
            Playlists EduCast
          </h3>
          <p className="text-slate-500 text-sm font-medium">Parcours d'apprentissage structurés.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          Nouvelle Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune playlist pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {playlists.map((playlist, i) => {
            const title = playlist.title || playlist.name || 'Playlist';
            const contents = playlist.contents ?? playlist.contentCount ?? playlist.itemCount ?? 0;
            const duration = playlist.duration || playlist.totalDuration || '—';
            const target = playlist.target || playlist.targetLevel || playlist.audience || '—';
            const author = playlist.author || playlist.createdBy || playlist.teacherName || '—';
            return (
              <motion.div
                key={playlist.id ?? i}
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
                    {contents} Vidéos
                  </div>
                </div>

                <div className="space-y-4 px-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest rounded-md mb-2 inline-block">{target}</span>
                      <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-rose-600 transition-colors">{title}</h4>
                    </div>
                    <button className="p-2 hover:bg-slate-50 rounded-xl">
                      <MoreVertical className="w-5 h-5 text-slate-300" />
                    </button>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{duration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Par {author}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Nouvelle playlist */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouvelle playlist</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder="Ex: Révisions Bac 2026"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                  placeholder="Décrivez la playlist..."
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
