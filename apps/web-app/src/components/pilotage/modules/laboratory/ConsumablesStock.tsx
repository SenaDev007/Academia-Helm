/**
 * ============================================================================
 * CONSUMABLES STOCK
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Droplets, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Calendar, MoreHorizontal, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ConsumableItem {
  id?: string;
  name?: string;
  category?: string;
  cat?: string;
  quantity?: number;
  qty?: number;
  unit?: string;
  status?: string;
  expiry?: string;
  expiryDate?: string;
  expiresAt?: string;
}

export default function ConsumablesStock() {
  const { academicYear } = useModuleContext();
  const { data: consumables, loading, error, refetch } = useModulesList<ConsumableItem>(
    'labs',
    'consumables',
    academicYear?.id,
  );

  const [consumableModalOpen, setConsumableModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moveConsumableId, setMoveConsumableId] = useState<string | null>(null);
  const [consumableForm, setConsumableForm] = useState({ labId: '', name: '', unit: 'unité(s)', quantity: 0 });
  const [moveForm, setMoveForm] = useState({ quantity: 0, type: 'IN' });

  const handleCreateConsumable = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(`labs/${consumableForm.labId}/consumables`, consumableForm, buildModulesApiOptions(academicYear?.id));
      setConsumableModalOpen(false);
      setConsumableForm({ labId: '', name: '', unit: 'unité(s)', quantity: 0 });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du consommable');
    } finally {
      setSubmitting(false);
    }
  };

  const openMoveModal = (consumableId: string, type: 'IN' | 'OUT') => {
    setMoveConsumableId(consumableId);
    setMoveForm({ quantity: 0, type });
    setMoveModalOpen(true);
  };

  const handleStockMove = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(`labs/consumables/${moveConsumableId}/move`, moveForm, buildModulesApiOptions(academicYear?.id));
      setMoveModalOpen(false);
      setMoveForm({ quantity: 0, type: 'IN' });
      setMoveConsumableId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors du mouvement de stock');
    } finally {
      setSubmitting(false);
    }
  };

  const safeConsumables = consumables ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des consommables...</span>
      </div>
    );
  }

  const normalizeStatus = (raw?: string) => {
    const s = (raw ?? '').toString().toUpperCase();
    if (s.includes('CRITICAL') || s.includes('RUPTURE')) return 'CRITICAL';
    if (s.includes('LOW') || s.includes('FAIBLE')) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les consommables. {error}
        </div>
      )}

      {/* Quick Actions & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setConsumableModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Consommable</span>
          </button>
          <button
            onClick={() => consumables?.[0]?.id && openMoveModal(consumables[0].id!, 'IN')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Réapprovisionner</span>
          </button>
          <button
            onClick={() => consumables?.[0]?.id && openMoveModal(consumables[0].id!, 'OUT')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Sortie Stock</span>
          </button>
        </div>
      </div>

      {safeConsumables.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun consommable enregistré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeConsumables.map((item: any, i: number) => {
            const name = item?.name ?? `Consommable #${i + 1}`;
            const cat = item?.category ?? item?.cat ?? 'Consommable';
            const qty = item?.quantity ?? item?.qty ?? 0;
            const unit = item?.unit ?? 'unité(s)';
            const status = normalizeStatus(item?.status);
            const expiry = item?.expiry ?? item?.expiryDate ?? (item?.expiresAt ? new Date(item.expiresAt).toLocaleDateString('fr-FR') : 'N/A');
            return (
              <motion.div
                key={item?.id ?? `cons-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${
                    status === 'CRITICAL' ? 'bg-rose-50 text-rose-600' :
                    status === 'LOW_STOCK' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <Droplets className="w-6 h-6" />
                  </div>
                  <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-slate-300" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</p>
                    <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{name}</h4>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black text-slate-900">{qty}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{unit}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-[10px] font-bold text-slate-400 mb-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        EXP: {expiry}
                      </div>
                      {status === 'CRITICAL' && (
                        <div className="flex items-center text-[10px] font-black text-rose-600 animate-pulse">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          RUPTURE PROCHE
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: status === 'IN_STOCK' ? '80%' : status === 'LOW_STOCK' ? '30%' : '10%' }}
                      className={`h-full ${
                        status === 'IN_STOCK' ? 'bg-emerald-500' :
                        status === 'LOW_STOCK' ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Consumable Modal */}
      {consumableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Ajouter un Consommable</h3>
              <button onClick={() => setConsumableModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Laboratoire</label>
                <input type="text" value={consumableForm.labId} onChange={(e) => setConsumableForm({ ...consumableForm, labId: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nom</label>
                <input type="text" value={consumableForm.name} onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unité</label>
                  <input type="text" value={consumableForm.unit} onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantité</label>
                  <input type="number" value={consumableForm.quantity} onChange={(e) => setConsumableForm({ ...consumableForm, quantity: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setConsumableModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateConsumable} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Move Modal */}
      {moveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Mouvement de Stock</h3>
              <button onClick={() => setMoveModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
                <select value={moveForm.type} onChange={(e) => setMoveForm({ ...moveForm, type: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="IN">Entrée</option>
                  <option value="OUT">Sortie</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantité</label>
                <input type="number" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setMoveModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleStockMove} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
