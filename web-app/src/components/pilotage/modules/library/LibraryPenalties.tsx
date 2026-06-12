/**
 * ============================================================================
 * LIBRARY PENALTIES & LOSSES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Search, Filter, MoreVertical, CreditCard, Clock, CheckCircle2, ChevronRight, Ban } from 'lucide-react';

export default function LibraryPenalties() {
  const penalties = [
    { id: 'PN-4001', reader: 'Jean Lawson', book: 'Le Petit Prince', motif: 'RETARD (15 jours)', amount: '1,500 FCFA', status: 'PENDING', date: '12/05/2026' },
    { id: 'PN-4002', reader: 'Saliou Diallo', book: 'Physique 3ème', motif: 'LIVRE ABÎMÉ', amount: '5,000 FCFA', status: 'PAID', date: '10/05/2026' },
    { id: 'PN-4003', reader: 'Sarah Goussi', book: 'Dictionnaire Anglais', motif: 'PERTE DE LIVRE', amount: '12,500 FCFA', status: 'OVERDUE', date: '05/05/2026' },
    { id: 'PN-4004', reader: 'M. Saliou', book: 'L\'Enfant Noir', motif: 'RETARD (2 jours)', amount: '1,000 FCFA', status: 'CANCELLED', date: '01/05/2026' },
  ];

  return (
    <div className="space-y-6">
      {/* Alert Banner for serious issues */}
      <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-6 flex items-center gap-6">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-600">
          <Ban className="w-8 h-8 animate-pulse" />
        </div>
        <div className="flex-1">
          <h4 className="text-lg font-black text-rose-900 uppercase tracking-tighter">Lecteurs Suspendus</h4>
          <p className="text-rose-700/80 text-sm font-medium">3 lecteurs ont des pénalités critiques en attente. Leurs droits d'emprunt sont automatiquement bloqués.</p>
        </div>
        <button className="px-6 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20">
          Gérer les blocages
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Registre des Pénalités</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Lecteur..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none shadow-sm" />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Lecteur & Motif</th>
              <th className="px-8 py-5">Montant</th>
              <th className="px-8 py-5">Statut</th>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {penalties.map((pn, i) => (
              <motion.tr
                key={pn.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-8 py-5">
                  <div>
                    <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{pn.reader}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pn.motif} • {pn.book}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-sm font-black text-slate-900">{pn.amount}</span>
                </td>
                <td className="px-8 py-5">
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    pn.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                    pn.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                    pn.status === 'OVERDUE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {pn.status === 'PAID' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                    {pn.status === 'PENDING' && <Clock className="w-3.5 h-3.5 mr-2" />}
                    {pn.status === 'OVERDUE' && <Ban className="w-3.5 h-3.5 mr-2" />}
                    {pn.status}
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-bold text-slate-500">{pn.date}</td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all" title="Encaisser">
                      <CreditCard className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                      <MoreVertical className="w-5 h-5 text-slate-300" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
