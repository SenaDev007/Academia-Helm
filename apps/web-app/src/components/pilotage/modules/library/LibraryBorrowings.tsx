/**
 * ============================================================================
 * LIBRARY BORROWINGS (EMPRUNTS) — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/library/loans?academicYearId=...
 * Endpoint : POST /modules-complementaires/library/loans/:id/return
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpCircle, Calendar, Clock, MoreVertical, Plus, Filter, Search, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface LoanItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  class?: string;
  className?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  loanDate?: string;
  borrowedAt?: string;
  due?: string;
  dueDate?: string;
  expectedReturnDate?: string;
  status?: string;
  [key: string]: any;
}

export default function LibraryBorrowings() {
  const { academicYear } = useModuleContext();
  const [search, setSearch] = useState('');
  const { data: loans, loading, error, refetch } = useModulesList<LoanItem>(
    'library',
    'loans',
    academicYear?.id,
    { status: 'active', ...(search ? { search } : {}) },
  );

  const handleReturn = async (loanId: string) => {
    try {
      await modulesApi.post(
        `library/loans/${loanId}/return`,
        {},
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
    } catch (e: any) {
      console.error('Erreur retour de prêt :', e?.message || e);
      alert(`Erreur lors du retour : ${e?.message || 'Erreur inconnue'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des emprunts...</span>
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un emprunt..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouvel Emprunt</span>
          </button>
        </div>
      </div>

      {loans.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-slate-200">
          Aucun emprunt actif pour cette année scolaire.
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4">
        {loans.map((loan, i) => {
          const reader = loan.reader ?? loan.readerName ?? loan.student ?? loan.user ?? '—';
          const className = loan.class ?? loan.className ?? '—';
          const bookTitle = loan.book ?? loan.bookTitle ?? loan.title ?? '—';
          const loanDate = loan.date ?? loan.loanDate ?? loan.borrowedAt ?? '—';
          const dueDate = loan.due ?? loan.dueDate ?? loan.expectedReturnDate ?? '—';
          const status = (loan.status ?? 'ACTIVE').toString().toUpperCase();
          const isOverdue = status === 'OVERDUE';
          return (
          <motion.div
            key={loan.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 ${
              isOverdue ? 'border-rose-200 border-l-rose-500' : 'border-slate-100 border-l-blue-500'
            }`}
          >
            <div className="flex items-center gap-6 flex-1">
              <div className={`p-4 rounded-2xl ${isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                <ArrowUpCircle className="w-8 h-8" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lecteur</p>
                  <p className="font-black text-slate-900">{reader}</p>
                  <p className="text-xs font-bold text-blue-600">{className}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Livre / Ressource</p>
                  <p className="font-bold text-slate-700 leading-tight">{bookTitle}</p>
                  <p className="text-xs font-medium text-slate-400">ID: {loan.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date d'emprunt</p>
                  <p className="font-bold text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {loanDate}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retour prévu</p>
                  <p className={`font-black flex items-center ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                    <Clock className="w-3.5 h-3.5 mr-2" />
                    {dueDate}
                  </p>
                  {isOverdue && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest animate-pulse">En retard !</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReturn(loan.id)}
                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
              >
                Retourner
              </button>
              <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
}
