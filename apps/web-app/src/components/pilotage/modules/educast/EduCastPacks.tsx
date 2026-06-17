/**
 * ============================================================================
 * EDUCAST CONTENT PACKS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play, Clock, MoreVertical, Plus, ChevronRight, BookOpen, GraduationCap, Package, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface PackItem {
  id: string | number;
  title?: string;
  name?: string;
  contents?: number;
  contentCount?: number;
  itemCount?: number;
  duration?: string;
  totalDuration?: string;
  price?: string | number;
  amount?: string | number;
  author?: string;
  createdBy?: string;
  teacherName?: string;
  sales?: number;
  salesCount?: number;
}

const EMPTY_FORM = { name: '', description: '', price: 0, mediaIds: '' };

export default function EduCastPacks() {
  const { academicYear } = useModuleContext();
  const { data: packs, loading, error, refetch } = useModulesList<PackItem>('educast', 'packs', academicYear?.id);

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
      const mediaIds = formData.mediaIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await modulesApi.post(
        'educast/packs',
        { ...formData, price: Number(formData.price), mediaIds },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la création du pack');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des packs...</span>
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
            <Package className="w-6 h-6 mr-3 text-rose-600" />
            Packs de Contenus Premium
          </h3>
          <p className="text-slate-500 text-sm font-medium">Groupement de vidéos, documents et quiz pour un apprentissage complet.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all"
        >
          Créer un Pack
        </button>
      </div>

      {packs.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucun pack de contenu pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {packs.map((pack, i) => {
            const title = pack.title || pack.name || 'Pack';
            const contents = pack.contents ?? pack.contentCount ?? pack.itemCount ?? 0;
            const duration = pack.duration || pack.totalDuration || '—';
            const price = pack.price ?? pack.amount ?? '—';
            const author = pack.author || pack.createdBy || pack.teacherName || '—';
            const sales = pack.sales ?? pack.salesCount ?? 0;
            return (
              <motion.div
                key={pack.id ?? i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group"
              >
                <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-slate-900 shadow-xl group-hover:shadow-2xl transition-all mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-600 to-navy-900 opacity-60 mix-blend-overlay group-hover:opacity-80 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Package className="w-12 h-12 mb-4 text-[#C9A84C]" />
                    <p className="text-3xl font-black tracking-tighter">{price} <span className="text-xs">F CFA</span></p>
                  </div>
                  <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">
                    {sales} Ventes
                  </div>
                </div>

                <div className="space-y-4 px-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-rose-600 transition-colors line-clamp-1">{title}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Par {author}</p>
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
                      <span className="text-[10px] font-bold uppercase tracking-widest">{contents} Contenus</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal: Créer un pack */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Créer un pack</h3>
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
                  placeholder="Ex: Pack Terminale S - Maths"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                  placeholder="Décrivez le pack..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prix (F CFA)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IDs des médias (séparés par virgule)</label>
                <input
                  type="text"
                  value={formData.mediaIds}
                  onChange={(e) => setFormData({ ...formData, mediaIds: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder="Ex: 1, 5, 12"
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
