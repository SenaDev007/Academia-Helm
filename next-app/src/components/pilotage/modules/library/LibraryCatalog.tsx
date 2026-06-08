/**
 * ============================================================================
 * LIBRARY CATALOG
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Search, Filter, BookOpen, MoreVertical, Bookmark, Star, ChevronRight } from 'lucide-react';

export default function LibraryCatalog() {
  const books = [
    { id: '1', title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', category: 'Littérature', level: 'Tous Niveaux', availability: 12, total: 15, rating: 4.8 },
    { id: '2', title: 'L\'Enfant Noir', author: 'Camara Laye', category: 'Littérature Africaine', level: 'Collège', availability: 0, total: 8, rating: 4.5 },
    { id: '3', title: 'Physique-Chimie 3ème', author: 'Edicef', category: 'Manuels Scolaires', level: '3ème', availability: 25, total: 30, rating: 4.2 },
    { id: '4', title: 'Sous l\'orage', author: 'Seydou Badian', category: 'Littérature Africaine', level: 'Collège', availability: 5, total: 10, rating: 4.6 },
    { id: '5', title: 'Dictionnaire Larousse', author: 'Larousse', category: 'Dictionnaires', level: 'Tous Niveaux', availability: 4, total: 5, rating: 4.9 },
    { id: '6', title: 'Annales BAC Mathématiques', author: 'Nathan', category: 'Annales', level: 'Terminale', availability: 18, total: 20, rating: 4.7 },
  ];

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher par titre, auteur, ISBN..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" />
            <span>Filtres Avancés</span>
          </button>
          <button className="p-3.5 bg-navy-900 text-white rounded-2xl hover:bg-navy-800 transition-all">
            <Bookmark className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group"
          >
            <div className="flex gap-6">
              <div className="w-24 h-32 bg-slate-50 rounded-xl flex-shrink-0 flex items-center justify-center text-slate-300 relative overflow-hidden group-hover:scale-105 transition-transform">
                <BookOpen className="w-8 h-8" />
                <div className="absolute top-0 right-0 p-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{book.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{book.author}</p>
                  </div>
                  <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg">{book.category}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-lg">{book.level}</span>
                </div>

                <div className="pt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Disponibilité</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <div key={dot} className={`w-1.5 h-1.5 rounded-full ${book.availability >= (book.total / 5) * dot ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <span className={`text-[10px] font-black ${book.availability > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {book.availability}/{book.total}
                      </span>
                    </div>
                  </div>
                  <button className="flex items-center text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                    Détails
                    <ChevronRight className="w-4 h-4 ml-1" />
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
