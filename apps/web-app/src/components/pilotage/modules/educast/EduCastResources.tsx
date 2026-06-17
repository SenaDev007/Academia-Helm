/**
 * ============================================================================
 * EDUCAST ASSOCIATED RESOURCES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Paperclip, FileText, Download, Link as LinkIcon, Plus, ExternalLink, Search, Filter, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ResourceItem {
  id: string | number;
  title?: string;
  name?: string;
  associatedWith?: string;
  parentTitle?: string;
  linkedContent?: string;
  type?: string;
  fileType?: string;
  mimeType?: string;
  size?: string;
  fileSize?: string;
  url?: string;
  link?: string;
}

export default function EduCastResources() {
  const { academicYear } = useModuleContext();
  const { data: resources, loading, error } = useModulesList<ResourceItem>('educast', 'contents', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des ressources...</span>
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
            <Paperclip className="w-6 h-6 mr-3 text-blue-600" />
            Documents & Ressources
          </h3>
          <p className="text-slate-500 text-sm font-medium">Gérez les fichiers attachés à vos contenus multimédias.</p>
        </div>
        <button
          onClick={() => alert('Bientôt disponible')}
          className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10"
        >
          Attacher une Ressource
        </button>
      </div>

      {resources.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucune ressource attachée pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Ressource & Type</th>
                <th className="px-8 py-5">Contenu Associé</th>
                <th className="px-8 py-5">Taille / Lien</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resources.map((res, i) => {
                const title = res.title || res.name || 'Ressource';
                const type = (res.type || res.fileType || (res.mimeType && res.mimeType.split('/')[1]?.toUpperCase()) || 'FILE').toUpperCase();
                const isLink = type === 'LINK' || type === 'URL' || !!res.url || !!res.link;
                const associatedWith = res.associatedWith || res.parentTitle || res.linkedContent || '—';
                const size = res.size || res.fileSize || (isLink ? '-' : '—');
                return (
                  <motion.tr
                    key={res.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors">
                          {isLink ? <LinkIcon className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-rose-600" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 leading-tight">{title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 italic">"{associatedWith}"</td>
                    <td className="px-8 py-5 text-xs font-black text-slate-900">{size}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm">
                        {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                      </button>
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
