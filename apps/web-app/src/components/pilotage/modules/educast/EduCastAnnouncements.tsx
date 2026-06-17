/**
 * ============================================================================
 * EDUCAST ANNOUNCEMENTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Megaphone, Calendar, Users, Eye, MoreHorizontal, Plus, Bell, MessageSquare, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

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

export default function EduCastAnnouncements() {
  const { academicYear } = useModuleContext();
  const { data: announcements, loading, error } = useModulesList<AnnouncementItem>('educast', 'announcements', academicYear?.id);

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
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10">
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
    </div>
  );
}
