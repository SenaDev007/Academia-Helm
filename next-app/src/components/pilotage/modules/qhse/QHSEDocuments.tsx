/**
 * ============================================================================
 * QHSE PROCEDURES & DOCUMENTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { FileText, Download, Eye, Search, Plus, Filter, Tag, Calendar, MoreVertical, Shield } from 'lucide-react';

export default function QHSEDocuments() {
  const documents = [
    { id: 1, title: 'Protocole Évacuation Incendie', type: 'PROCÉDURE', version: 'v2.4', size: '2.4 MB', date: '15/05/2026', category: 'SÉCURITÉ' },
    { id: 2, title: 'Règlement Sanitaire Intérieur', type: 'POLITIQUE', version: 'v1.0', size: '1.2 MB', date: '10/05/2026', category: 'HYGIÈNE' },
    { id: 3, title: 'Guide Premier Secours', type: 'GUIDE', version: 'v3.1', size: '5.8 MB', date: '01/05/2026', category: 'SANTÉ' },
    { id: 4, title: 'Fiche de Contrôle Cantine', type: 'MODÈLE', version: 'v2.0', size: '450 KB', date: '14/05/2026', category: 'QUALITÉ' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <FileText className="w-6 h-6 mr-3 text-slate-400" /> Bibliothèque Documentaire QHSE
          </h3>
          <p className="text-slate-500 text-sm font-medium">Accédez aux procédures, consignes et rapports officiels.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          Ajouter un Document
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map((doc, i) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <FileText className="w-8 h-8" />
              </div>
              <div className="text-right">
                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-lg">{doc.version}</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{doc.title}</h4>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {doc.category}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 border-l border-slate-100 pl-3">
                    <Calendar className="w-3 h-3" /> {doc.date}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{doc.size} • {doc.type}</p>
                <div className="flex items-center gap-2">
                  <button className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-slate-900 transition-all">
                    <Eye className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-600/10">
                    <Download className="w-5 h-5" />
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
