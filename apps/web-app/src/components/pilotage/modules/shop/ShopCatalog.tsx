/**
 * ============================================================================
 * SHOP CATALOG - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn (au lieu de buttons custom bg-navy-900 uppercase)
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Modals : <Dialog> shadcn (au lieu de fixed inset-0 fait main)
 *  - Notifications : useToast() (au lieu de alert())
 *  - Cards : rounded-xl border-gray-200 (au lieu de rounded-3xl)
 *  - Typo : font-semibold text-lg (au lieu de font-black uppercase tracking-tight)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Loader2, Search, Plus, Package, Grid, List, Tag, ChevronRight, Bookmark, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface ProductItem {
  id?: string;
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  stock?: number;
  quantity?: number;
  category?: string;
  categoryName?: string;
  description?: string;
  imageUrl?: string;
  status?: string;
}

interface CategoryItem {
  id?: string;
  name?: string;
  label?: string;
  count?: number;
  productCount?: number;
  icon?: string;
}

export default function ShopCatalog() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  const { data: categories, loading: catLoading, refetch: refetchCategories } = useModulesList<CategoryItem>(
    'shop',
    'categories',
    academicYear?.id,
  );
  const { data: products, loading, error, refetch } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productForm, setProductForm] = useState({ code: '', name: '', unitPrice: 0, categoryId: '', initialStock: 0, description: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });

  const handleCreateProduct = async () => {
    try {
      setSubmitting(true);
      const payload = {
        code: productForm.code || 'PROD-' + Date.now(),
        name: productForm.name,
        unitPrice: Number(productForm.unitPrice),
        categoryId: productForm.categoryId || undefined,
        initialStock: Number(productForm.initialStock) || 0,
        description: productForm.description || undefined,
      };
      await modulesApi.post('shop/products', payload, buildModulesApiOptions(academicYear?.id));
      setProductModalOpen(false);
      setProductForm({ code: '', name: '', unitPrice: 0, categoryId: '', initialStock: 0, description: '' });
      await refetch();
      toast({ title: 'Produit créé', description: 'Le nouvel article a été ajouté au catalogue.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du produit',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('shop/categories', categoryForm, buildModulesApiOptions(academicYear?.id));
      setCategoryModalOpen(false);
      setCategoryForm({ name: '' });
      await refetchCategories();
      toast({ title: 'Catégorie créée', description: 'La nouvelle catégorie a été ajoutée.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la catégorie',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || catLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement du catalogue...</span>
      </div>
    );
  }

  const safeCategories = (categories ?? []).map((c: any, i: number) => ({
    name: c?.name ?? c?.label ?? 'Catégorie',
    count: c?._count?.products ?? 0,
    icon: c?.icon ?? '🏷️',
    key: c?.id ?? `cat-${i}`,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les produits. {error}
        </div>
      )}

      {/* Category Sidebar & Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 space-y-6">
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>Catégories</span>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCategoryModalOpen(true)}
                title="Ajouter une catégorie"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {safeCategories.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucune catégorie</p>
              ) : (
                safeCategories.map((cat) => (
                  <div
                    key={cat.key}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 group transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-xs font-medium text-gray-600 group-hover:text-navy-900 transition-colors">{cat.name}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 group-hover:text-indigo-500">{cat.count}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md border-0">
            <Bookmark className="w-7 h-7 text-indigo-300 mb-3" />
            <h4 className="text-sm font-semibold mb-2">Kits Scolaires</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Gérez les packs d'articles obligatoires par niveau pour faciliter les achats parents.
            </p>
            <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
              Configurer les kits
            </Button>
          </Card>
        </div>

        <div className="flex-1 space-y-6">
          {/* Toolbar */}
          <Card className="p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher un article (Nom, SKU, Code-barres)..."
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${viewMode === 'grid' ? 'bg-white shadow-sm text-navy-900' : 'text-gray-400'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${viewMode === 'list' ? 'bg-white shadow-sm text-navy-900' : 'text-gray-400'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                <Button onClick={() => setProductModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un Article
                </Button>
              </div>
            </div>
          </Card>

          {/* Catalog Grid */}
          {(products ?? []).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun produit disponible pour cette année scolaire.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {(products ?? []).map((product, i) => (
                <ProductCard key={product?.id ?? `prod-${i}`} product={product} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nouvel Article */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel Article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Code</Label>
                <Input
                  type="text"
                  value={productForm.code}
                  onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                  placeholder="Ex: UNIF-CP1 (auto si vide)"
                />
              </div>
              <div>
                <Label className="text-xs">Nom</Label>
                <Input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Ex: Uniforme CP1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prix unitaire (FCFA)</Label>
                <Input
                  type="number"
                  value={productForm.unitPrice}
                  onChange={(e) => setProductForm({ ...productForm, unitPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Stock initial</Label>
                <Input
                  type="number"
                  value={productForm.initialStock}
                  onChange={(e) => setProductForm({ ...productForm, initialStock: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">ID Catégorie</Label>
              <Input
                type="text"
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                placeholder="Optionnel"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                placeholder="Description optionnelle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateProduct} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer l\'article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nouvelle Catégorie */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nom de la catégorie</Label>
              <Input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                placeholder="Ex: Uniformes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateCategory} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer la catégorie'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ product, index }: any) {
  const name = product?.name ?? `Article #${index}`;
  const sku = product?.sku ?? `SKU-${index}`;
  const price = product?.price ?? product?.unitPrice ?? 0;
  const stock = product?.stock ?? product?.quantity ?? 0;
  const category = product?.category ?? product?.categoryName ?? 'Général';
  const description = product?.description ?? '';
  const isOutOfStock = product?.status === 'Rupture' || stock <= 0;

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="h-40 bg-slate-50 relative overflow-hidden flex items-center justify-center">
        <Package className="w-14 h-14 text-slate-200" />
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className="bg-white/90 text-xs">
            {category}
          </Badge>
        </div>
        <div className="absolute bottom-3 right-3">
          {isOutOfStock ? (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
              Rupture
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              En Stock: {stock}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-sm font-semibold text-navy-900 line-clamp-1">{name}</h4>
          <span className="text-xs text-gray-400 ml-2 flex-shrink-0 font-mono">{sku}</span>
        </div>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
          {description || 'Aucune description disponible.'}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Prix Unitaire</p>
            <p className="text-lg font-semibold text-navy-900">{formatCurrency(price)}</p>
          </div>
          <Button size="icon" variant="outline" className="h-9 w-9">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
