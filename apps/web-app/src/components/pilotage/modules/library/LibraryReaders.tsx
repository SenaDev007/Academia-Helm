/**
 * ============================================================================
 * LIBRARY READERS (LECTEURS)
 * ============================================================================
 *
 * TODO: endpoint non disponible — garder mock. Aucun endpoint GET library/readers
 * n'est exposé par le backend modules-complementaires. Les lecteurs sont
 * actuellement déduits des prêts (library/loans) côté backend.
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Search, Filter, Star, BookOpen, ChevronRight } from 'lucide-react';

export default function LibraryReaders() {
  const readers = [
    { id: 'RD-001', name: 'Saliou Diallo', type: 'ÉLÈVE', class: 'Terminal D', loans: 4, score: 98, status: 'ACTIF' },
    { id: 'RD-002', name: 'Mme. Koffi', type: 'ENSEIGNANT', class: 'Physique', loans: 12, score: 100, status: 'ACTIF' },
    { id: 'RD-003', name: 'Jean Lawson', type: 'ÉLÈVE', class: '3ème B', loans: 1, score: 45, status: 'SUSPENDU' },
    { id: 'RD-004', name: 'Sarah Goussi', type: 'ÉLÈVE', class: '6ème A', loans: 2, score: 92, status: 'ACTIF' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher un lecteur..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm" />
        </div>
        <button className="flex items-center space-x-2 px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
          <Filter className="w-4 h-4" />
          <span>Filtres</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {readers.map((reader, i) => (
          <motion.div
            key={reader.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group text-center"
          >
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-300 font-black text-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                {reader.name.charAt(0)}
              </div>
              <div className="absolute bottom-0 right-0 p-1 bg-white rounded-full border border-slate-100">
                <div className={`w-3.5 h-3.5 rounded-full ${reader.status === 'ACTIF' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <h4 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">{reader.name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reader.type} • {reader.class}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Emprunts</p>
                <div className="flex items-center justify-center gap-1.5 font-black text-slate-900">
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  {reader.loans}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Score</p>
                <div className="flex items-center justify-center gap-1.5 font-black text-slate-900">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  {reader.score}%
                </div>
              </div>
            </div>

            <button className="w-full flex items-center justify-center text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
              Voir Profil Complet
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
