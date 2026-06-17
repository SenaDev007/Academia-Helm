/**
 * ============================================================================
 * CONSUMABLES STOCK
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2, Droplets, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Calendar, MoreHorizontal } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

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
  const { data: consumables, loading, error } = useModulesList<ConsumableItem>(
    'labs',
    'consumables',
    academicYear?.id,
  );

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
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
            <ArrowDownCircle className="w-4 h-4" />
            <span>Réapprovisionner</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
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
    </div>
  );
}
