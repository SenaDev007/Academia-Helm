/**
 * ============================================================================
 * LIBRARY BORROWINGS (EMPRUNTS)
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ArrowUpCircle, User, Book, Calendar, Clock, MoreVertical, Plus, Filter, Search } from 'lucide-react';

export default function LibraryBorrowings() {
  const borrowings = [
    { id: 'LO-9001', reader: 'Saliou Diallo', class: 'Terminal D', book: 'L\'Enfant Noir', date: '12/05/2026', due: '19/05/2026', status: 'ACTIVE' },
    { id: 'LO-9002', reader: 'Mme. Koffi (Prof)', class: 'Enseignant', book: 'Physique-Chimie 3ème', date: '10/05/2026', due: '10/06/2026', status: 'ACTIVE' },
    { id: 'LO-9003', reader: 'Lawson Jean', class: '3ème B', book: 'Le Petit Prince', date: '05/05/2026', due: '12/05/2026', status: 'OVERDUE' },
    { id: 'LO-9004', reader: 'Goussi Sarah', class: '6ème A', book: 'Dictionnaire Anglais', date: '14/05/2026', due: '21/05/2026', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher un emprunt..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm" />
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

      <div className="grid grid-cols-1 gap-4">
        {borrowings.map((loan, i) => (
          <motion.div
            key={loan.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 ${
              loan.status === 'OVERDUE' ? 'border-rose-200 border-l-rose-500' : 'border-slate-100 border-l-blue-500'
            }`}
          >
            <div className="flex items-center gap-6 flex-1">
              <div className={`p-4 rounded-2xl ${loan.status === 'OVERDUE' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                <ArrowUpCircle className="w-8 h-8" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lecteur</p>
                  <p className="font-black text-slate-900">{loan.reader}</p>
                  <p className="text-xs font-bold text-blue-600">{loan.class}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Livre / Ressource</p>
                  <p className="font-bold text-slate-700 leading-tight">{loan.book}</p>
                  <p className="text-xs font-medium text-slate-400">ID: {loan.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date d'emprunt</p>
                  <p className="font-bold text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {loan.date}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retour prévu</p>
                  <p className={`font-black flex items-center ${loan.status === 'OVERDUE' ? 'text-rose-600' : 'text-slate-700'}`}>
                    <Clock className="w-3.5 h-3.5 mr-2" />
                    {loan.due}
                  </p>
                  {loan.status === 'OVERDUE' && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest animate-pulse">En retard !</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
                Retourner
              </button>
              <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
