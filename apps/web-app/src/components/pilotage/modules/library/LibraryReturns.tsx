/**
 * ============================================================================
 * LIBRARY RETURNS (RETOURS)
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ArrowDownCircle, CheckCircle2, AlertCircle, Calendar, ShieldCheck, Search, Filter } from 'lucide-react';

export default function LibraryReturns() {
  const returns = [
    { id: 'RE-1001', reader: 'Saliou Diallo', book: 'L\'Enfant Noir', date: '15/05/2026', condition: 'CONFORME', penalty: '0 FCFA' },
    { id: 'RE-1002', reader: 'Mme. Koffi', book: 'Physique-Chimie 3ème', date: '14/05/2026', condition: 'ABÎMÉ', penalty: '5,000 FCFA' },
    { id: 'RE-1003', reader: 'Jean Lawson', book: 'Le Petit Prince', date: '13/05/2026', condition: 'RETARD', penalty: '1,500 FCFA' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique des Retours</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none shadow-sm" />
          </div>
          <button className="flex items-center space-x-2 px-6 py-2 bg-navy-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">
            <ArrowDownCircle className="w-4 h-4 text-[#C9A84C]" />
            <span>Valider Retour</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Lecteur & Livre</th>
              <th className="px-8 py-5">Date Retour</th>
              <th className="px-8 py-5">État au Retour</th>
              <th className="px-8 py-5">Pénalité Appliquée</th>
              <th className="px-8 py-5 text-right">Justificatif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {returns.map((ret, i) => (
              <motion.tr
                key={ret.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-8 py-5">
                  <div>
                    <p className="font-black text-slate-900">{ret.reader}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ret.book}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center text-xs font-bold text-slate-500">
                    <Calendar className="w-4 h-4 mr-2 text-slate-300" />
                    {ret.date}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${
                    ret.condition === 'CONFORME' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {ret.condition === 'CONFORME' ? <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> : <AlertCircle className="w-3.5 h-3.5 mr-2" />}
                    {ret.condition}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`text-sm font-black ${ret.penalty !== '0 FCFA' ? 'text-rose-600' : 'text-slate-900'}`}>{ret.penalty}</span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="p-2.5 bg-slate-100 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all">
                    <ShieldCheck className="w-4 h-4" />
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
