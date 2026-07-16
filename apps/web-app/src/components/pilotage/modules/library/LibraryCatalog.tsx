/**
 * ============================================================================
 * LIBRARY CATALOG — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)        : GET  /modules-complementaires/library/books
 * Endpoint (création)       : POST /modules-complementaires/library/books
 * Endpoint (favoris toggle) : POST /modules-complementaires/library/favorites/:bookId
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Search, Filter, BookOpen, Bookmark, Star, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
  const { toast } = useToast();
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
      toast({ title: 'Favori mis à jour', description: 'Le statut favori du livre a été modifié.' });
    } catch (e: any) {
      console.error('Erreur favori :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la mise à jour du favori', variant: 'destructive' });
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
      toast({ title: 'Livre créé', description: 'Le nouveau livre a été ajouté au catalogue.' });
    } catch (e: any) {
      console.error('Erreur création livre :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création du livre', variant: 'destructive' });
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
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, auteur, ISBN..."
            className="w-full pl-12 pr-4 h-11"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" /> Filtres Avancés
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter un livre
          </Button>
        </div>
      </div>

      {/* Catalog Grid */}
      {books.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucune donnée disponible pour cette année scolaire.
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book, i) => {
          const availability = book.availability ?? book.available ?? 0;
          const total = book.total ?? 0;
          const title = book.title ?? book.name ?? '—';
          return (
          <Card key={book.id} className="p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
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
                    <h4 className="text-lg font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{title}</h4>
                    <p className="text-xs text-slate-400">{book.author ?? '—'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleFavorite(book.id)}
                    disabled={actionLoading === book.id}
                    title="Ajouter aux favoris"
                    className="h-8 w-8"
                  >
                    <Bookmark className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{book.category ?? '—'}</Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">{book.level ?? '—'}</Badge>
                </div>

                <div className="pt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Disponibilité</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <div key={dot} className={`w-1.5 h-1.5 rounded-full ${availability >= (total / 5) * dot ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <Badge variant={availability > 0 ? 'outline' : 'destructive'} className={availability > 0 ? 'text-emerald-600 border-emerald-100' : ''}>
                        {availability}/{total}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="link" className="text-blue-600 h-auto p-0">
                    Détails
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          );
        })}
      </div>
      )}

      {/* Modal Ajouter un livre */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un livre</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="book-title">Titre</Label>
              <Input
                id="book-title"
                type="text"
                placeholder="Titre du livre"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-author">Auteur</Label>
              <Input
                id="book-author"
                type="text"
                placeholder="Auteur"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-category">Catégorie</Label>
              <Input
                id="book-category"
                type="text"
                placeholder="ex : Sciences, Littérature..."
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-total">Nombre d'exemplaires</Label>
              <Input
                id="book-total"
                type="number"
                min={1}
                value={formData.total}
                onChange={(e) => setFormData({ ...formData, total: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreateBook} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
