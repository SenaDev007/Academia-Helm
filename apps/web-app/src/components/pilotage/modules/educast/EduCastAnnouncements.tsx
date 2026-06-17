/**
 * ============================================================================
 * EDUCAST ANNOUNCEMENTS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Calendar, Users, Eye, MoreHorizontal, Plus, Bell, MessageSquare, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface AnnouncementItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  createdBy?: string;
  authorName?: string;
  target?: string;
  targetAudience?: string;
  audience?: string;
  date?: string;
  publishedAt?: string;
  createdAt?: string;
  views?: number;
  viewCount?: number;
  important?: boolean;
  isImportant?: boolean;
  priority?: string;
}

const EMPTY_FORM = { title: '', content: '', targetAudience: 'TOUS' };

export default function EduCastAnnouncements() {
  const { academicYear } = useModuleContext();
  const { data: announcements, loading, error, refetch } = useModulesList<AnnouncementItem>('educast', 'announcements', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      alert('Le titre et le contenu sont requis');
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/announcements', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la création de l\'annonce');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des annonces...</span>
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
            <Megaphone className="w-6 h-6 mr-3 text-amber-600" />
            Publications & Annonces
          </h3>
          <p className="text-slate-500 text-sm font-medium">Communiquez officiellement via des formats audio/vidéo.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10"
        >
          Créer une Annonce
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune annonce pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {announcements.map((ann, i) => {
            const title = ann.title || ann.name || 'Annonce';
            const author = ann.author || ann.createdBy || ann.authorName || '—';
            const target = ann.target || ann.targetAudience || ann.audience || '—';
            const date = ann.date || (ann.publishedAt ? new Date(ann.publishedAt).toLocaleDateString('fr-FR') : ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('fr-FR') : '—');
            const views = ann.views ?? ann.viewCount ?? 0;
            const important = ann.important || ann.isImportant || ann.priority === 'HIGH' || ann.priority === 'URGENT';
            return (
              <motion.div
                key={ann.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-white rounded-3xl border p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${
                  important ? 'border-amber-200 border-l-8 border-l-amber-500' : 'border-slate-200 border-l-8 border-l-blue-500'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-8 flex-1">
                    <div className={`p-5 rounded-2xl ${important ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Bell className="w-8 h-8" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md">{date}</span>
                        {important && <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest animate-pulse">IMPORTANT</span>}
                      </div>
                      <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{title}</h4>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Cible: {target}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Par {author}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{views}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vues</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl transition-all">
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Créer une annonce */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Créer une annonce</h3>
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
                  placeholder="Ex: Rentrée scolaire 2026"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contenu</label>
                <textarea
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                  placeholder="Contenu de l'annonce..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audience cible</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="TOUS">Tous</option>
                  <option value="ELEVES">Élèves</option>
                  <option value="PARENTS">Parents</option>
                  <option value="ENSEIGNANTS">Enseignants</option>
                  <option value="PERSONNEL">Personnel</option>
                </select>
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
                {submitting ? 'Envoi...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
