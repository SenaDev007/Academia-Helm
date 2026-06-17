/**
 * ============================================================================
 * SHOP CATALOG - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { Loader2, Search, Filter, Plus, Package, Grid, List, Tag, ChevronRight, Bookmark } from 'lucide-react';

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

  const { data: categories, loading: catLoading } = useModulesList<CategoryItem>(
    'shop',
    'categories',
    academicYear?.id,
  );
  const { data: products, loading, error } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

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
    count: c?.count ?? c?.productCount ?? 0,
    icon: c?.icon ?? '🏷️',
    key: c?.id ?? `cat-${i}`,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les produits. {error}
        </div>
      )}

      {/* Category Sidebar & Header */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-black text-navy-900 uppercase tracking-tight mb-6 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-navy-600" />
              <span>Catégories</span>
            </h3>
            <div className="space-y-2">
              {safeCategories.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucune catégorie</p>
              ) : (
                safeCategories.map((cat) => (
                  <button
                    key={cat.key}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-navy-50 group transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-xs font-bold text-gray-500 group-hover:text-navy-900 transition-colors">{cat.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-300 group-hover:text-navy-400">{cat.count}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-3xl p-6 text-white shadow-xl">
            <Bookmark className="w-8 h-8 text-navy-400 mb-4" />
            <h4 className="font-black text-sm uppercase tracking-tight mb-2">Kits Scolaires</h4>
            <p className="text-[10px] text-navy-200 font-medium leading-relaxed mb-4">
              Gérez les packs d'articles obligatoires par niveau pour faciliter les achats parents.
            </p>
            <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              Configurer les kits
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {/* Toolbar */}
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un article (Nom, SKU, Code-barres)..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
              />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-navy-900' : 'text-gray-400 hover:text-navy-600'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-navy-900' : 'text-gray-400 hover:text-navy-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/20">
                <Plus className="w-4 h-4" />
                <span>Ajouter un Article</span>
              </button>
            </div>
          </div>

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
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
      <div className="h-48 bg-gray-50 relative overflow-hidden flex items-center justify-center">
        <Package className="w-16 h-16 text-gray-200 group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/40 transition-all duration-500 flex items-center justify-center space-x-3 opacity-0 group-hover:opacity-100">
          <button className="p-3 bg-white text-navy-900 rounded-xl hover:bg-navy-50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="p-3 bg-white text-navy-900 rounded-xl hover:bg-navy-50 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-black uppercase rounded-lg shadow-sm border border-gray-100">
            {category}
          </span>
        </div>
        <div className="absolute bottom-4 right-4">
          <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg shadow-sm border ${
            isOutOfStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
          }`}>
            {isOutOfStock ? 'Rupture' : `En Stock: ${stock}`}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-black text-navy-900 text-sm group-hover:text-navy-600 transition-colors line-clamp-1">{name}</h4>
          <span className="text-[10px] font-bold text-gray-400 ml-2 flex-shrink-0">{sku}</span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium mb-6 line-clamp-2 leading-relaxed">
          {description || 'Aucune description disponible.'}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Prix Unitaire</p>
            <p className="text-xl font-black text-navy-900">{formatCurrency(price)}</p>
          </div>
          <button className="p-3 bg-navy-50 text-navy-900 rounded-xl hover:bg-navy-900 hover:text-white transition-all shadow-sm">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
