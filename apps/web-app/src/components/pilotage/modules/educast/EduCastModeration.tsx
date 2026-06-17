/**
 * ============================================================================
 * EDUCAST MODERATION
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Eye, CheckCircle2, XCircle, AlertTriangle, Clock, Filter, MoreVertical, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ModerationItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  submittedBy?: string;
  uploader?: string;
  type?: string;
  contentType?: string;
  date?: string;
  createdAt?: string;
  submittedAt?: string;
  status?: string;
  reason?: string;
  flagReason?: string;
  moderationReason?: string;
}

export default function EduCastModeration() {
  const { academicYear } = useModuleContext();
  const { data: queue, loading, error } = useModulesList<ModerationItem>('educast', 'contents', academicYear?.id, { status: 'pending' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de la file de modération...</span>
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
            <ShieldCheck className="w-6 h-6 mr-3 text-emerald-600" />
            File de Modération
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contrôlez et validez les contenus avant publication.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400">
            <Filter className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('Bientôt disponible')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20"
          >
            Tout Valider
          </button>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-3xl border border-slate-200">
          Aucun contenu en attente de modération pour cette année scolaire.
        </div>
      ) : (
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
              {queue.map((item, i) => {
                const title = item.title || item.name || 'Contenu';
                const author = item.author || item.submittedBy || item.uploader || '—';
                const type = item.type || item.contentType || 'Contenu';
                const date = item.date || (item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('fr-FR') : item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—');
                const status = item.status || 'PENDING';
                const reason = item.reason || item.flagReason || item.moderationReason || 'Nouveau contenu';
                const flagged = status === 'FLAGGED';
                return (
                  <motion.tr
                    key={item.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div>
                        <p className="font-black text-slate-900">{title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Par {author}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{type}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`flex items-center text-[10px] font-bold uppercase tracking-widest ${
                        flagged ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {flagged ? <AlertTriangle className="w-3.5 h-3.5 mr-2" /> : <Clock className="w-3.5 h-3.5 mr-2" />}
                        {reason}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500">{date}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => alert('Bientôt disponible')}
                          className="p-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => alert('Bientôt disponible')}
                          className="p-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-xl text-emerald-600 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => alert('Bientôt disponible')}
                          className="p-2 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl text-rose-600 transition-all"
                        >
                          <XCircle className="w-4 h-4" />
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
