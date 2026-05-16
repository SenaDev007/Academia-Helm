/**
 * ============================================================================
 * LIBRARY DIGITAL RESOURCES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Globe, FileText, Video, Headphones, Link as LinkIcon, Search, Eye, Download, Plus, Filter, MoreVertical } from 'lucide-react';

export default function LibraryDigitalResources() {
  const resources = [
    { id: 'DR-001', title: 'Guide de la grammaire française', type: 'PDF', category: 'Français', author: 'Prof. Diallo', views: 1240, status: 'PUBLIC' },
    { id: 'DR-002', title: 'Vidéo : La photosynthèse', type: 'VIDEO', category: 'SVT', author: 'Academia Prod', views: 856, status: 'CLASSE' },
    { id: 'DR-003', title: 'Podcast : Histoire du Mali', type: 'AUDIO', category: 'Histoire', author: 'Radio Scolaire', views: 320, status: 'PUBLIC' },
    { id: 'DR-004', title: 'Simulateur Circuits Logiques', type: 'LINK', category: 'Technologie', author: 'External Lab', views: 560, status: 'ENSEIGNANT' },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PDF': return <FileText className="w-6 h-6 text-rose-500" />;
      case 'VIDEO': return <Video className="w-6 h-6 text-blue-500" />;
      case 'AUDIO': return <Headphones className="w-6 h-6 text-emerald-500" />;
      case 'LINK': return <LinkIcon className="w-6 h-6 text-indigo-500" />;
      default: return <Globe className="w-6 h-6 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher une ressource numérique..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Publier une ressource</span>
          </button>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {resources.map((res, i) => (
          <motion.div
            key={res.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                {getTypeIcon(res.type)}
              </div>
              <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-300">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-md mb-2 inline-block">{res.category}</span>
                <h4 className="text-sm font-black text-slate-900 leading-tight line-clamp-2 min-h-[40px] group-hover:text-blue-600 transition-colors">{res.title}</h4>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Par {res.author}</p>
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">{res.views}</span>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all" title="Ouvrir">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all" title="Télécharger">
                    <Download className="w-4 h-4" />
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
