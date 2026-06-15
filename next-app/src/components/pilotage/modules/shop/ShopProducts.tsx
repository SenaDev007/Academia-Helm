/**
 * ============================================================================
 * SHOP PRODUCTS & VARIANTS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Package, Tag, Layers, Search, Filter, Plus, 
  ArrowUpDown, MoreVertical, Edit, Trash2,
  CheckCircle2, AlertTriangle, Info, Copy
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ShopProducts() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Gestion des Articles & Variantes</h3>
          <p className="text-sm text-gray-400 font-medium">Configurez les SKU, tailles, couleurs et coûts d'achat</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            <Copy className="w-4 h-4" />
            <span>Dupliquer</span>
          </button>
          <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
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
              <ProductRow 
                name="Uniforme Sport (Complet)" 
                sku="SKU-SPT-2026-01" 
                variants={4} 
                price={15000} 
                cost={9500} 
                status="Actif"
              />
              <ProductRow 
                name="Kit Papeterie Primaire" 
                sku="SKU-PAP-2026-05" 
                variants={1} 
                price={7500} 
                cost={4200} 
                status="Actif"
              />
              <ProductRow 
                name="Gourde Isotherme Academia" 
                sku="SKU-ACC-2026-12" 
                variants={3} 
                price={5500} 
                cost={3100} 
                status="Rupture"
              />
              <ProductRow 
                name="Cahier TP Academia 200p" 
                sku="SKU-PAP-2026-08" 
                variants={2} 
                price={1200} 
                cost={650} 
                status="Actif"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ name, sku, variants, price, cost, status }: any) {
  const margin = price - cost;
  const marginPercent = Math.round((margin / price) * 100);

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
