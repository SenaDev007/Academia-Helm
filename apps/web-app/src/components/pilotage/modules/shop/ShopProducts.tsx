/**
 * ============================================================================
 * SHOP PRODUCTS & VARIANTS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Package, Layers, Search, Filter, Plus, ArrowUpDown, MoreVertical, Edit, Trash2, Copy, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

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
  const { data: products, loading, error, refetch } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: '', price: 0, categoryId: '', stock: 0, description: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });

  const handleCreateProduct = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('shop/products', productForm, buildModulesApiOptions(academicYear?.id));
      setProductModalOpen(false);
      setProductForm({ name: '', price: 0, categoryId: '', stock: 0, description: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du produit');
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
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la catégorie');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des articles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les articles. {error}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Gestion des Articles & Variantes</h3>
          <p className="text-sm text-gray-400 font-medium">Configurez les SKU, tailles, couleurs et coûts d'achat</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setCategoryModalOpen(true)}
            disabled={actionLoading === 'category'}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100 disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            <span>Ajouter une Catégorie</span>
          </button>
          <button
            onClick={() => setProductModalOpen(true)}
            disabled={actionLoading === 'product'}
            className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel Article</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, SKU ou code-barres..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
          />
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            <Filter className="w-4 h-4" />
            <span>Filtres Avancés</span>
          </button>
          <button className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            <ArrowUpDown className="w-4 h-4" />
            <span>Trier</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Modals */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Nouvel Article</h3>
              <button onClick={() => setProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nom</label>
                <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prix</label>
                  <input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock</label>
                  <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID Catégorie</label>
                <input type="text" value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })} placeholder="Optionnel" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 h-20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setProductModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateProduct} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Nouvelle Catégorie</h3>
              <button onClick={() => setCategoryModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nom de la catégorie</label>
              <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setCategoryModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateCategory} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Article / SKU</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Variantes</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prix Vente</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Coût Achat</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Marge</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(products ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-gray-500">
                    Aucun article disponible pour cette année scolaire.
                  </td>
                </tr>
              ) : (
                (products ?? []).map((product, i) => {
                  const name = product?.name ?? `Article #${i + 1}`;
                  const sku = product?.sku ?? `SKU-${i + 1}`;
                  const price = product?.price ?? product?.unitPrice ?? 0;
                  const cost = product?.cost ?? product?.purchaseCost ?? 0;
                  const variants = product?.variants ?? product?.variantCount ?? 0;
                  const status = product?.active === false || product?.status === 'Rupture' ? 'Rupture' : 'Actif';
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ name, sku, variants, price, cost, status }: any) {
  const margin = (price ?? 0) - (cost ?? 0);
  const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;

  return (
    <tr className="hover:bg-gray-50/50 transition-all group">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-navy-50 rounded-2xl text-navy-600 group-hover:scale-110 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{name}</p>
            <p className="text-[10px] font-bold text-gray-400 tracking-wider">{sku}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-gray-300" />
          <span className="text-xs font-bold text-gray-600">{variants} Variante{variants > 1 ? 's' : ''}</span>
        </div>
      </td>
      <td className="px-8 py-6">
        <span className="text-sm font-black text-navy-900">{formatCurrency(price)}</span>
      </td>
      <td className="px-8 py-6">
        <span className="text-sm font-bold text-gray-500">{formatCurrency(cost)}</span>
      </td>
      <td className="px-8 py-6">
        <div>
          <span className="text-sm font-black text-emerald-600">+{formatCurrency(margin)}</span>
          <p className="text-[10px] font-bold text-gray-400">{marginPercent}% de marge</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${
          status === 'Actif' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
        }`}>
          {status}
        </span>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-navy-50 hover:text-navy-600 transition-all">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
