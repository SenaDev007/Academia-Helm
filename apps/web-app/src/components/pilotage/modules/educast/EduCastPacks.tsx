/**
 * ============================================================================
 * EDUCAST CONTENT PACKS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ListMusic, Play, Clock, MoreVertical, Plus, ChevronRight, BookOpen, GraduationCap, Package, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

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

export default function EduCastPacks() {
  const { academicYear } = useModuleContext();
  const { data: packs, loading, error } = useModulesList<PackItem>('educast', 'packs', academicYear?.id);

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
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
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
    </div>
  );
}
