/**
 * ============================================================================
 * LIBRARY RETURNS (RETOURS) — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/library/loans?status=returned&academicYearId=...
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownCircle, CheckCircle2, AlertCircle, Calendar, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface LoanItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  returnDate?: string;
  returnedAt?: string;
  condition?: string;
  state?: string;
  penalty?: string;
  penaltyAmount?: number;
  fee?: number;
  [key: string]: any;
}

export default function LibraryReturns() {
  const { academicYear } = useModuleContext();
  const [search, setSearch] = useState('');
  const { data: returns, loading, error } = useModulesList<LoanItem>(
    'library',
    'loans',
    academicYear?.id,
    { status: 'returned', ...(search ? { search } : {}) },
  );

  const formatPenalty = (item: LoanItem) => {
    if (item.penalty) return item.penalty;
    const amt = item.penaltyAmount ?? item.fee ?? 0;
    return amt > 0 ? `${amt.toLocaleString('fr-FR')} F CFA` : '0 F CFA';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des retours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique des Retours</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none shadow-sm"
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-2 bg-navy-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">
            <ArrowDownCircle className="w-4 h-4 text-[#C9A84C]" />
            <span>Valider Retour</span>
          </button>
        </div>
      </div>

      {returns.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-slate-200">
          Aucun retour enregistré pour cette année scolaire.
        </div>
      ) : (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
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
            {returns.map((ret, i) => {
              const reader = ret.reader ?? ret.readerName ?? ret.student ?? ret.user ?? '—';
              const bookTitle = ret.book ?? ret.bookTitle ?? ret.title ?? '—';
              const returnDate = ret.date ?? ret.returnDate ?? ret.returnedAt ?? '—';
              const condition = (ret.condition ?? ret.state ?? 'CONFORME').toString().toUpperCase();
              const isConforme = condition === 'CONFORME';
              const penalty = formatPenalty(ret);
              return (
              <motion.tr
                key={ret.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-8 py-5">
                  <div>
                    <p className="font-black text-slate-900">{reader}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bookTitle}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center text-xs font-bold text-slate-500">
                    <Calendar className="w-4 h-4 mr-2 text-slate-300" />
                    {returnDate}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${
                    isConforme ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {isConforme ? <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> : <AlertCircle className="w-3.5 h-3.5 mr-2" />}
                    {condition}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`text-sm font-black ${penalty !== '0 F CFA' ? 'text-rose-600' : 'text-slate-900'}`}>{penalty}</span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="p-2.5 bg-slate-100 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all">
                    <ShieldCheck className="w-4 h-4" />
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
