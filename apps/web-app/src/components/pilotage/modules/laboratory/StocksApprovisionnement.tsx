/**
 * ============================================================================
 * STOCKS & APPROVISIONNEMENT
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2, Package, ShoppingCart, TrendingDown, Truck, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ConsumableItem {
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unit?: string;
  status?: string;
  cost?: number;
  unitPrice?: number;
  price?: number;
  estimatedCost?: string;
  requestStatus?: string;
  date?: string;
  requestedAt?: string;
  createdAt?: string;
}

export default function StocksApprovisionnement() {
  const { academicYear } = useModuleContext();
  // Approvisionnement = mouvements de stock. On réutilise l'endpoint consumables.
  const { data: consumables, loading, error } = useModulesList<ConsumableItem>(
    'labs',
    'consumables',
    academicYear?.id,
  );

  const safeItems = consumables ?? [];

  const inStockCount = safeItems.length;
  const alertCount = safeItems.filter((c: any) => {
    const s = (c?.status ?? '').toString().toUpperCase();
    return s.includes('LOW') || s.includes('CRITICAL') || s.includes('FAIBLE');
  }).length;
  const pendingOrdersCount = safeItems.filter((c: any) => {
    const s = (c?.requestStatus ?? c?.status ?? '').toString().toUpperCase();
    return s.includes('PENDING') || s.includes('ORDERED') || s.includes('ATTENTE');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des approvisionnements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données d'approvisionnement. {error}
        </div>
      )}

      {/* Stock Health & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-all">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{inStockCount}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Articles en Stock</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-rose-200 transition-all">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
            <TrendingDown className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{alertCount}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Articles en Alerte</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-all">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{pendingOrdersCount}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commandes en Cours</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Demandes d'Approvisionnement</h3>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-navy-900/20">
          <ShoppingCart className="w-4 h-4" />
          <span>Créer une Demande</span>
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-4">Article & Quantité</th>
              <th className="px-8 py-4">Coût Estimé</th>
              <th className="px-8 py-4">Statut</th>
              <th className="px-8 py-4">Date Demande</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {safeItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-16 text-center text-gray-500">
                  Aucune demande d'approvisionnement pour cette année scolaire.
                </td>
              </tr>
            ) : (
              safeItems.map((req: any, i: number) => {
                const name = req?.name ?? `Article #${i + 1}`;
                const qty = req?.quantity ?? req?.qty ?? 0;
                const id = req?.id ?? `REQ-${i}`;
                const costValue = req?.cost ?? req?.unitPrice ?? req?.price ?? 0;
                const cost = req?.estimatedCost ?? (costValue > 0 ? `${costValue.toLocaleString('fr-FR')} F CFA` : '—');
                const status = (req?.requestStatus ?? req?.status ?? 'PENDING').toString().toUpperCase();
                const date = req?.date ?? (req?.requestedAt ?? req?.createdAt ? new Date(req.requestedAt ?? req.createdAt).toLocaleDateString('fr-FR') : '—');
                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div>
                        <p className="font-black text-slate-900">{name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">QTÉ: {qty} • {id}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-slate-900">{cost}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                        status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                        status === 'REJECTED' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                        {status === 'PENDING' && <Clock className="w-3.5 h-3.5 mr-2" />}
                        {status === 'ORDERED' && <Truck className="w-3.5 h-3.5 mr-2" />}
                        {status}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-500">{date}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="flex items-center ml-auto text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                        Détails
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </motion.tr>
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
