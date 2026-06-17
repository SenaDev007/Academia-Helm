/**
 * ============================================================================
 * LIBRARY CATALOG — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)        : GET  /modules-complementaires/library/books
 * Endpoint (création)       : POST /modules-complementaires/library/books
 * Endpoint (favoris toggle) : POST /modules-complementaires/library/favorites/:bookId
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, BookOpen, MoreVertical, Bookmark, Star, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface BookItem {
  id: string;
  title?: string;
  name?: string;
  author?: string;
  category?: string;
  level?: string;
  availability?: number;
  available?: number;
  total?: number;
  rating?: number;
  [key: string]: any;
}

interface NewBookFormData {
  title: string;
  author: string;
  category: string;
  total: number;
}

const emptyBookForm: NewBookFormData = { title: '', author: '', category: '', total: 1 };

export default function LibraryCatalog() {
  const { academicYear } = useModuleContext();
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewBookFormData>(emptyBookForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: books, loading, error, refetch } = useModulesList<BookItem>(
    'library',
    'books',
    academicYear?.id,
    search ? { search } : undefined,
  );

  const handleToggleFavorite = async (bookId: string) => {
    try {
      setActionLoading(bookId);
      await modulesApi.post(
        `library/favorites/${bookId}`,
        {},
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
    } catch (e: any) {
      console.error('Erreur favori :', e?.message || e);
      alert(e?.message || 'Erreur lors de la mise à jour du favori');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBook = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/books',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyBookForm);
      await refetch();
    } catch (e: any) {
      console.error('Erreur création livre :', e?.message || e);
      alert(e?.message || 'Erreur lors de la création du livre');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement du catalogue...</span>
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, auteur, ISBN..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" />
            <span>Filtres Avancés</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-3.5 bg-navy-900 text-white rounded-2xl font-bold text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10"
          >
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Ajouter un livre</span>
          </button>
        </div>
      </div>

      {/* Catalog Grid */}
      {books.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-slate-200">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book, i) => {
          const availability = book.availability ?? book.available ?? 0;
          const total = book.total ?? 0;
          const title = book.title ?? book.name ?? '—';
          return (
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
                    <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{book.author ?? '—'}</p>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(book.id)}
                    disabled={actionLoading === book.id}
                    title="Ajouter aux favoris"
                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-amber-500 transition-colors disabled:opacity-50"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg">{book.category ?? '—'}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-lg">{book.level ?? '—'}</span>
                </div>

                <div className="pt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Disponibilité</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <div key={dot} className={`w-1.5 h-1.5 rounded-full ${availability >= (total / 5) * dot ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <span className={`text-[10px] font-black ${availability > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {availability}/{total}
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
          );
        })}
      </div>
      )}

      {/* Modal Ajouter un livre */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-slate-900">Ajouter un livre</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Titre</label>
                <input
                  type="text"
                  placeholder="Titre du livre"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auteur</label>
                <input
                  type="text"
                  placeholder="Auteur"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Catégorie</label>
                <input
                  type="text"
                  placeholder="ex : Sciences, Littérature..."
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre d'exemplaires</label>
                <input
                  type="number"
                  min={1}
                  value={formData.total}
                  onChange={(e) => setFormData({ ...formData, total: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateBook}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
