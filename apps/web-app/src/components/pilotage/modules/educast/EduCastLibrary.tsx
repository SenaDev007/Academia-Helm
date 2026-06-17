/**
 * ============================================================================
 * EDUCAST MEDIA LIBRARY
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Search, Filter, MoreVertical, Play, Headphones, Zap, Download, Eye, FileText, Plus, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  mediaType?: string;
  category?: string;
  subject?: string;
  author?: string;
  uploadedBy?: string;
  teacherName?: string;
  date?: string;
  createdAt?: string;
  views?: number;
  viewCount?: number;
  duration?: string;
  length?: string;
}

export default function EduCastLibrary() {
  const { academicYear } = useModuleContext();
  const { data: media, loading, error } = useModulesList<MediaItem>('educast', 'contents', academicYear?.id, { scope: 'library' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de la médiathèque...</span>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch ((type || '').toUpperCase()) {
      case 'VIDEO': return <Play className="w-5 h-5" />;
      case 'AUDIO':
      case 'PODCAST': return <Headphones className="w-5 h-5" />;
      case 'CAPSULE': return <Zap className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher dans la médiathèque..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm" />
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Importer</span>
          </button>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucun média dans votre bibliothèque pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Titre & Type</th>
                <th className="px-8 py-5">Auteur</th>
                <th className="px-8 py-5">Catégorie</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Durée</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {media.map((item, i) => {
                const title = item.title || item.name || 'Média';
                const type = (item.type || item.mediaType || 'FILE').toUpperCase();
                const category = item.category || item.subject || '—';
                const author = item.author || item.teacherName || item.uploadedBy || '—';
                const date = item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—');
                const duration = item.duration || item.length || '—';
                const views = item.views ?? item.viewCount ?? 0;
                return (
                  <motion.tr
                    key={item.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors">
                          {getTypeIcon(type)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 leading-tight">{title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{author}</td>
                    <td className="px-8 py-5">
                      <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-lg">{category}</span>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500">{date}</td>
                    <td className="px-8 py-5 text-xs font-black text-slate-900">{duration}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all">
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                          <MoreVertical className="w-5 h-5 text-slate-300" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
