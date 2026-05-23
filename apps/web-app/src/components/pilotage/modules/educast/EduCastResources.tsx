/**
 * ============================================================================
 * EDUCAST ASSOCIATED RESOURCES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Paperclip, FileText, Download, Link as LinkIcon, Plus, ExternalLink, Search, Filter } from 'lucide-react';

export default function EduCastResources() {
  const resources = [
    { id: 1, title: 'Fiche de cours : Dérivées', associatedWith: 'Calcul des dérivées usuelles', type: 'PDF', size: '1.2 MB' },
    { id: 2, title: 'Exercices d\'entraînement', associatedWith: 'La photosynthèse expliquée', type: 'DOCX', size: '850 KB' },
    { id: 3, title: 'Quiz Interactif', associatedWith: 'Les secrets de la grammaire', type: 'LINK', size: '-' },
    { id: 4, title: 'Document de référence BAC', associatedWith: 'La Révolution Française', type: 'PDF', size: '2.5 MB' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Paperclip className="w-6 h-6 mr-3 text-blue-600" />
            Documents & Ressources
          </h3>
          <p className="text-slate-500 text-sm font-medium">Gérez les fichiers attachés à vos contenus multimédias.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10">
          Attacher une Ressource
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
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
            {resources.map((res, i) => (
              <motion.tr
                key={res.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors">
                      {res.type === 'LINK' ? <LinkIcon className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-rose-600" />}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{res.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{res.type}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-xs font-bold text-slate-500 italic">"{res.associatedWith}"</td>
                <td className="px-8 py-5 text-xs font-black text-slate-900">{res.size}</td>
                <td className="px-8 py-5 text-right">
                  <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm">
                    {res.type === 'LINK' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
