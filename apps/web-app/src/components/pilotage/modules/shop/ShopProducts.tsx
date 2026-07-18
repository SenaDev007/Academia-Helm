/**
 * ============================================================================
 * SHOP PRODUCTS & VARIANTS - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn (au lieu de buttons custom bg-navy-900 uppercase)
 *  - Table : <Table>/<TableHeader>/... shadcn (au lieu de <table> HTML brute)
 *  - Modals : FormModal du blueprint (au lieu de fixed inset-0 fait main)
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs : <Input>/<Label> shadcn (au lieu de <input>/<label> HTML)
 *  - Cards : rounded-xl border-gray-200 (au lieu de rounded-3xl border-gray-100)
 *  - Typo : font-semibold text-lg (au lieu de font-black uppercase tracking-tight)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Loader2, Package, Layers, Search, Filter, Plus, ArrowUpDown,
  Edit, Trash2, MoreVertical, X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface ProductItem {
  id?: string;
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  cost?: number;
  purchaseCost?: number;
  variants?: number;
  variantCount?: number;
  status?: string;
  active?: boolean;
}

export default function ShopProducts() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: products, loading, error, refetch } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productForm, setProductForm] = useState({ code: '', name: '', unitPrice: 0, categoryId: '', initialStock: 0, description: '' });

  const handleCreateProduct = async () => {
    if (!productForm.name.trim()) {
      toast({ title: 'Nom requis', description: 'Veuillez saisir le nom du produit.', variant: 'destructive' });
      return;
    }
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

  // Note : la création de catégories n'est pas gérée ici. Utilisez l'onglet Catalogue.

  // Filtrage local par recherche
  const filteredProducts = React.useMemo(() => {
    if (!searchTerm.trim()) return products ?? [];
    const q = searchTerm.toLowerCase().trim();
    return (products ?? []).filter((p) =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des articles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les articles. {error}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Articles & Variantes</h3>
          <p className="text-sm text-gray-500">Configurez les SKU, tailles, couleurs et coûts d'achat</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">
            Utilisez l'onglet Catalogue pour créer des catégories
          </span>
          <Button
            onClick={() => setProductModalOpen(true)}
            disabled={submitting}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvel article
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher par nom, SKU ou code-barres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-1.5" />
              Filtres
            </Button>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="w-4 h-4 mr-1.5" />
              Trier
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Table — pattern Finance */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Article / SKU</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead className="text-right">Prix vente</TableHead>
                <TableHead className="text-right">Coût achat</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">
                    Aucun article disponible pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product, i) => {
                  const name = product?.name ?? `Article #${i + 1}`;
                  const sku = product?.code ?? product?.sku ?? `SKU-${i + 1}`;
                  const price = product?.unitPrice ?? product?.price ?? 0;
                  const cost = product?.costPrice ?? product?.cost ?? product?.purchaseCost ?? 0;
                  const stockQty = product?.stock?.quantity ?? 0;
                  const variants = product?.variants ?? product?.variantCount ?? 0;
                  const status = product?.isActive === false ? 'Inactif' : (stockQty <= 0 ? 'Rupture' : 'Actif');
                  return (
                    <ProductRow
                      key={product?.id ?? `prod-${i}`}
                      name={name}
                      sku={sku}
                      variants={variants}
                      price={price}
                      cost={cost}
                      status={status}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Nouvel Article — pattern standard (overlay simple, pas de fixed inset-0 fait main) */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-navy-900">Nouvel article</h3>
              <Button variant="ghost" size="icon" onClick={() => setProductModalOpen(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
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
                <Label className="text-xs">Catégorie (ID)</Label>
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
            <div className="flex gap-2 justify-end p-6 border-t border-gray-100">
              <Button variant="outline" onClick={() => setProductModalOpen(false)}>Annuler</Button>
              <Button onClick={handleCreateProduct} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {submitting ? 'Création...' : 'Créer l\'article'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant ligne produit (pattern Finance : TableRow + TableCell) ───
function ProductRow({
  name,
  sku,
  variants,
  price,
  cost,
  status,
}: {
  name: string;
  sku: string;
  variants: number;
  price: number;
  cost: number;
  status: string;
}) {
  const margin = (price ?? 0) - (cost ?? 0);
  const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-900">{name}</p>
            <p className="text-xs text-gray-500 font-mono">{sku}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600">{variants} variante{variants > 1 ? 's' : ''}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold text-navy-900">
        {formatCurrency(price)}
      </TableCell>
      <TableCell className="text-right text-gray-500">
        {formatCurrency(cost)}
      </TableCell>
      <TableCell className="text-right">
        <div>
          <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(margin)}</span>
          <p className="text-xs text-gray-400">{marginPercent}% de marge</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            status === 'Actif'
              ? 'text-xs bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'text-xs bg-red-50 text-red-700 border-red-200'
          }
        >
          {status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier">
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" title="Supprimer">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Plus d'actions">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
