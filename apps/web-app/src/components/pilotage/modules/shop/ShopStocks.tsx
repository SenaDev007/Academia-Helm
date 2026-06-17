/**
 * ============================================================================
 * SHOP STOCKS & INVENTORY - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Package, Search, Filter, AlertTriangle, History, TrendingDown, TrendingUp, BarChart3, MapPin, MoreVertical, Edit, RefreshCw, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface StockItem {
  id?: string;
  name?: string;
  productName?: string;
  location?: string;
  zone?: string;
  qty?: number;
  quantity?: number;
  stock?: number;
  threshold?: number;
  minThreshold?: number;
  lastMvt?: string;
  lastMovementAt?: string;
  lastMovement?: string;
  updatedAt?: string;
  status?: string;
  unitPrice?: number;
  price?: number;
}

export default function ShopStocks() {
  const { academicYear } = useModuleContext();
  const { data: stocks, loading, error, refetch } = useModulesList<StockItem>(
    'shop',
    'stocks',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({ productId: '', quantity: 0 });

  const handleUpdateStock = async () => {
    try {
      setSubmitting(true);
      await modulesApi.put('shop/stocks', stockForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setStockForm({ productId: '', quantity: 0 });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la mise à jour du stock');
    } finally {
      setSubmitting(false);
    }
  };

  const openStockModal = (productId?: string) => {
    setStockForm({ productId: productId ?? '', quantity: 0 });
    setModalOpen(true);
  };

  const safeStocks = stocks ?? [];

  const totalArticles = safeStocks.length;
  const alertCount = safeStocks.filter((s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    const threshold = s?.threshold ?? s?.minThreshold ?? 0;
    return qty > 0 && qty <= threshold;
  }).length;
  const ruptureCount = safeStocks.filter((s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    return qty <= 0;
  }).length;
  const totalValue = safeStocks.reduce((acc: number, s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    const price = s?.unitPrice ?? s?.price ?? 0;
    return acc + (qty * price);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des stocks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les stocks. {error}
        </div>
      )}

      {/* Stock KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StockStatCard label="Valeur Stock" value={formatCurrency(totalValue)} icon={BarChart3} color="navy" />
        <StockStatCard label="Articles Totaux" value={String(totalArticles)} icon={Package} color="blue" />
        <StockStatCard label="Alertes Seuil" value={String(alertCount)} icon={AlertTriangle} color="amber" />
        <StockStatCard label="Ruptures" value={String(ruptureCount)} icon={TrendingDown} color="rose" />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un produit dans l'inventaire..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
              />
            </div>
            <div className="flex items-center space-x-3 w-full md:w-auto">
               <button className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
                <Filter className="w-4 h-4" />
                <span>Localisation</span>
              </button>
              <button
                onClick={() => openStockModal()}
                className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Mettre à jour le Stock</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50/50">
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Zone / Emplacement</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">En Stock</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Seuil</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Dernier Mvt</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {safeStocks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-8 py-16 text-center text-gray-500">
                            Aucun stock disponible pour cette année scolaire.
                          </td>
                        </tr>
                      ) : (
                        safeStocks.map((s: any, i: number) => {
                          const name = s?.name ?? s?.productName ?? `Article #${i + 1}`;
                          const location = s?.location ?? s?.zone ?? '—';
                          const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
                          const threshold = s?.threshold ?? s?.minThreshold ?? 0;
                          const lastMvt = s?.lastMvt
                            ?? s?.lastMovement
                            ?? (s?.lastMovementAt ? new Date(s.lastMovementAt).toLocaleDateString('fr-FR') : null)
                            ?? (s?.updatedAt ? new Date(s.updatedAt).toLocaleDateString('fr-FR') : '—');
                          const status = qty <= 0 ? 'Rupture' : qty <= threshold ? 'Alerte' : 'Normal';
                          return (
                            <StockRow
                              key={s?.id ?? `stock-${i}`}
                              name={name}
                              location={location}
                              qty={qty}
                              threshold={threshold}
                              lastMvt={lastMvt}
                              status={status}
                              onEdit={() => openStockModal(s?.id)}
                            />
                          );
                        })
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
              <div className="flex items-center space-x-3 mb-8">
                 <History className="w-6 h-6 text-navy-400" />
                 <h3 className="text-lg font-black uppercase tracking-tight">Mouvements Récents</h3>
              </div>
              <div className="space-y-6">
                 {safeStocks.slice(0, 4).map((s: any, i: number) => (
                   <MovementItem
                     key={`mv-${i}`}
                     type={i % 2 === 0 ? 'IN' : 'OUT'}
                     label={`Mouvement - ${s?.name ?? s?.productName ?? 'Article'}`}
                     qty={s?.qty ?? s?.quantity ?? s?.stock ?? 0}
                     date={s?.lastMvt ?? s?.lastMovement ?? '—'}
                   />
                 ))}
                 {safeStocks.length === 0 && (
                   <p className="text-xs text-navy-300 text-center py-4">Aucun mouvement récent</p>
                 )}
              </div>
              <button className="w-full mt-10 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                Voir tout l'historique
              </button>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight mb-6">Zones de Stockage</h3>
              <div className="space-y-4">
                 <StorageZone label="Rayon Principal" count={safeStocks.length} color="emerald" />
                 <StorageZone label="Réserve Centrale" count={0} color="navy" />
                 <StorageZone label="Point de Vente" count={0} color="amber" />
              </div>
           </div>
        </div>
      </div>

      {/* Stock Update Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Mettre à jour le Stock</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID Produit</label>
                <input type="text" value={stockForm.productId} onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantité</label>
                <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleUpdateStock} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockStatCard({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    navy: 'bg-navy-50 text-navy-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className={`p-4 rounded-2xl ${colorMap[color]} mb-6 w-fit group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-black text-navy-900">{value}</h4>
    </div>
  );
}

function StockRow({ name, location, qty, threshold, lastMvt, status, onEdit }: any) {
  return (
    <tr className="hover:bg-gray-50/50 transition-all group">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
           <Package className="w-5 h-5 text-gray-300 group-hover:text-navy-600" />
           <span className="text-sm font-black text-navy-900">{name}</span>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
           <MapPin className="w-3.5 h-3.5 text-gray-400" />
           <span className="text-xs font-bold text-gray-600">{location}</span>
        </div>
      </td>
      <td className="px-8 py-6">
        <span className={`text-sm font-black ${status === 'Rupture' ? 'text-red-600' : status === 'Alerte' ? 'text-amber-600' : 'text-navy-900'}`}>
          {qty} unités
        </span>
      </td>
      <td className="px-8 py-6 text-xs text-gray-400 font-bold">{threshold}</td>
      <td className="px-8 py-6 text-[10px] text-gray-400 font-black uppercase tracking-tight">{lastMvt}</td>
      <td className="px-8 py-6">
         <div className="flex items-center space-x-2">
           <button onClick={onEdit} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-navy-50 hover:text-navy-600 transition-all">
             <Edit className="w-4 h-4" />
           </button>
           <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all">
             <MoreVertical className="w-4 h-4" />
           </button>
         </div>
      </td>
    </tr>
  );
}

function MovementItem({ type, label, qty, date }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
       <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-lg ${type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : type === 'OUT' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {type === 'IN' ? <TrendingUp className="w-3.5 h-3.5" /> : type === 'OUT' ? <TrendingDown className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </div>
          <div>
            <p className="text-xs font-black text-white group-hover:text-navy-300 transition-colors line-clamp-1">{label}</p>
            <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest">{date}</p>
          </div>
       </div>
       <span className={`text-xs font-black ${type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
         {type === 'IN' ? '+' : ''}{qty}
       </span>
    </div>
  );
}

function StorageZone({ label, count, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500',
    navy: 'bg-navy-600',
    amber: 'bg-amber-500',
  };
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-navy-200 transition-all">
       <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${colors[color]}`}></div>
          <span className="text-xs font-black text-navy-900">{label}</span>
       </div>
       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{count} Articles</span>
    </div>
  );
}
