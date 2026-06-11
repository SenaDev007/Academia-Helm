/**
 * ============================================================================
 * EDUCAST MODERATION
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Eye, CheckCircle2, XCircle, AlertTriangle, Clock, Filter, MoreVertical } from 'lucide-react';

export default function EduCastModeration() {
  const queue = [
    { id: 1, title: 'Expérience Chimie 3ème', author: 'Saliou Diallo (Élève)', type: 'Vidéo', date: '15/05/2026', status: 'PENDING', reason: 'Publication élève' },
    { id: 2, title: 'Pack : Prépa BEPC Maths', author: 'M. Koffi', type: 'Pack Premium', date: '15/05/2026', status: 'PENDING', reason: 'Monétisation à valider' },
    { id: 3, title: 'Commentaire sur cours Maths', author: 'Inconnu', type: 'Commentaire', date: '15/05/2026', status: 'FLAGGED', reason: 'Contenu inapproprié suspecté' },
    { id: 4, title: 'Mini-Capsule : Verbes irréguliers', author: 'Mme. Koffi', type: 'Capsule', date: '14/05/2026', status: 'PENDING', reason: 'Nouveau contenu' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <ShieldCheck className="w-6 h-6 mr-3 text-emerald-600" />
            File de Modération
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contrôlez et validez les contenus avant publication.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400">
            <Filter className="w-5 h-5" />
          </button>
          <button className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20">
            Tout Valider
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Contenu & Auteur</th>
              <th className="px-8 py-5">Type</th>
              <th className="px-8 py-5">Raison Modération</th>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5 text-right">Décision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {queue.map((item, i) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-8 py-5">
                  <div>
                    <p className="font-black text-slate-900">{item.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Par {item.author}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{item.type}</span>
                </td>
                <td className="px-8 py-5">
                  <div className={`flex items-center text-[10px] font-bold uppercase tracking-widest ${
                    item.status === 'FLAGGED' ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {item.status === 'FLAGGED' ? <AlertTriangle className="w-3.5 h-3.5 mr-2" /> : <Clock className="w-3.5 h-3.5 mr-2" />}
                    {item.reason}
                  </div>
                </td>
                <td className="px-8 py-5 text-xs font-bold text-slate-500">{item.date}</td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-xl text-emerald-600 transition-all">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl text-rose-600 transition-all">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
