/**
 * ============================================================================
 * SHOP KITS (SCHOOL PACKS) - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Package, Layers, Plus, Edit, Trash2, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface KitItem {
  id?: string;
  name?: string;
  level?: string;
  grade?: string;
  className?: string;
  itemsCount?: number;
  items?: number;
  itemCount?: number;
  price?: number;
  total?: number;
  popularity?: string;
  promoted?: boolean;
  isPromoted?: boolean;
}

const COLOR_BY_INDEX = ['emerald', 'navy', 'blue', 'amber', 'emerald', 'navy'];

export default function ShopKits() {
  const { academicYear } = useModuleContext();
  const { data: kits, loading, error, refetch } = useModulesList<KitItem>(
    'shop',
    'kits',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kitForm, setKitForm] = useState({ name: '', description: '', price: 0, productIds: '' });

  const handleCreateKit = async () => {
    try {
      setSubmitting(true);
      const productIds = kitForm.productIds.split(',').map((s) => s.trim()).filter(Boolean);
      await modulesApi.post('shop/kits', { ...kitForm, productIds }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setKitForm({ name: '', description: '', price: 0, productIds: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du kit');
    } finally {
      setSubmitting(false);
    }
  };

  const safeKits = kits ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des kits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les kits. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Kits Scolaires Par Niveau</h3>
          <p className="text-sm text-gray-400 font-medium">Composez des packs d'articles obligatoires par classe</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Kit</span>
        </button>
      </div>

      {/* Kits Grid */}
      {safeKits.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun kit scolaire configuré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {safeKits.map((kit: any, i: number) => (
            <KitCard
              key={kit?.id ?? `kit-${i}`}
              level={kit?.level ?? kit?.grade ?? kit?.className ?? 'Niveau'}
              name={kit?.name ?? `Kit #${i + 1}`}
              items={kit?.itemsCount ?? kit?.items ?? kit?.itemCount ?? 0}
              price={kit?.price ?? kit?.total ?? 0}
              popularity={kit?.popularity ?? 'Stable'}
              color={COLOR_BY_INDEX[i % COLOR_BY_INDEX.length]}
              isPromoted={kit?.isPromoted ?? kit?.promoted ?? false}
            />
          ))}
        </div>
      )}

      {/* Composition Preview (Bottom Section) */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Détails de Composition</h3>
              <p className="text-sm text-gray-400 font-medium">Sélectionnez un kit pour voir et éditer ses articles</p>
           </div>
           <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button className="px-4 py-2 bg-white text-navy-900 rounded-lg text-[10px] font-black uppercase shadow-sm">Articles</button>
              <button className="px-4 py-2 text-gray-400 rounded-lg text-[10px] font-black uppercase hover:text-navy-900 transition-all">Stocks Liés</button>
           </div>
        </div>

        <div className="space-y-4">
          {safeKits.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Aucun article à afficher. Créez un kit pour commencer.
            </p>
          ) : (
            <KitItemRow name={`Articles du kit : ${safeKits[0]?.name ?? 'Kit sélectionné'}`} qty={safeKits[0]?.itemsCount ?? safeKits[0]?.items ?? 0} price={safeKits[0]?.price ?? safeKits[0]?.total ?? 0} />
          )}
        </div>
      </div>

      {/* Kit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Nouveau Kit</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nom</label>
                <input type="text" value={kitForm.name} onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description</label>
                <textarea value={kitForm.description} onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 h-20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prix</label>
                <input type="number" value={kitForm.price} onChange={(e) => setKitForm({ ...kitForm, price: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">IDs Produits (séparés par virgule)</label>
                <input type="text" value={kitForm.productIds} onChange={(e) => setKitForm({ ...kitForm, productIds: e.target.value })} placeholder="ex: prod-1, prod-2" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateKit} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitCard({ level, name, items, price, popularity, color, isPromoted }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    navy: 'bg-navy-50 text-navy-600 border-navy-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className={`bg-white rounded-[2.5rem] border p-8 shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden ${isPromoted ? 'border-navy-500' : 'border-gray-100'}`}>
      {isPromoted && (
        <div className="absolute top-0 right-0 px-6 py-2 bg-navy-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-3xl shadow-lg">
          Best-Seller
        </div>
      )}

      <div className={`p-4 rounded-2xl w-fit mb-6 border ${colors[color]} group-hover:scale-110 transition-transform`}>
        <Package className="w-8 h-8" />
      </div>

      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{level}</p>
      <h4 className="text-xl font-black text-navy-900 mb-6 group-hover:text-navy-600 transition-colors">{name}</h4>

      <div className="space-y-4 mb-8">
         <div className="flex items-center justify-between text-xs font-bold text-gray-600">
            <span className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-gray-300" />
              <span>{items} Articles inclus</span>
            </span>
            <span className="text-[10px] bg-gray-50 px-2 py-1 rounded-lg uppercase">{popularity}</span>
         </div>
         <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
            <div className={`h-full ${isPromoted ? 'bg-navy-500' : 'bg-gray-200'} transition-all duration-1000`} style={{ width: '75%' }}></div>
         </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-50">
         <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Prix Pack</p>
            <p className="text-2xl font-black text-navy-900">{formatCurrency(price)}</p>
         </div>
         <button className="p-4 bg-navy-50 text-navy-900 rounded-2xl hover:bg-navy-900 hover:text-white transition-all shadow-sm">
            <Plus className="w-6 h-6" />
         </button>
      </div>
    </div>
  );
}

function KitItemRow({ name, qty, price, isOptional }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:border-navy-200 transition-all">
       <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-50 shadow-sm group-hover:scale-110 transition-transform">
             <Package className="w-5 h-5 text-navy-200 group-hover:text-navy-600" />
          </div>
          <div>
             <div className="flex items-center space-x-2">
                <p className="text-sm font-black text-navy-900">{name}</p>
                {isOptional && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black uppercase rounded-md border border-amber-100">Optionnel</span>
                )}
             </div>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Quantité: {qty}</p>
          </div>
       </div>
       <div className="flex items-center space-x-8">
          <div className="text-right">
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Prix Unitaire</p>
             <p className="text-sm font-black text-navy-900">{formatCurrency(price)}</p>
          </div>
          <div className="flex items-center space-x-2">
             <button className="p-2 text-gray-400 hover:text-navy-600 transition-colors">
                <Edit className="w-4 h-4" />
             </button>
             <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
       </div>
    </div>
  );
}
