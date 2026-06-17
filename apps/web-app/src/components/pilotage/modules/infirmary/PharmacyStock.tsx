/**
 * ============================================================================
 * PHARMACY & STOCKS TAB
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import {
  Pill,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  AlertTriangle,
  Package,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface StockItem {
  id: string;
  name?: string;
  itemName?: string;
  type?: string;
  itemType?: string;
  qty?: number;
  quantity?: number;
  unit?: string;
  status?: string;
  stockStatus?: string;
  expiry?: string;
  expirationDate?: string;
  [key: string]: any;
}

const STATUS_COLORS: Record<string, string> = {
  OK: 'bg-emerald-500',
  LOW: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

export default function PharmacyStock() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<StockItem>('infirmary', 'stock', academicYear?.id);

  const items = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ medicationId: '', quantity: '', type: 'IN' });
  const [submitting, setSubmitting] = useState(false);

  const handleMove = async () => {
    if (!formData.medicationId) {
      alert('Veuillez saisir l\'ID du médicament.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        quantity: Number(formData.quantity) || 0,
        type: formData.type,
      };
      await modulesApi.post(`infirmary/stock/${formData.medicationId}/move`, payload, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ medicationId: '', quantity: '', type: 'IN' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors du mouvement de stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Statistiques calculées depuis le stock réel
  const total = items.length;
  const lowStock = items.filter((i) => {
    const s = (i.status || i.stockStatus || '').toUpperCase();
    return s === 'LOW' || s === 'CRITICAL';
  }).length;
  const expiringSoon = items.filter((i) => {
    const exp = i.expiry || i.expirationDate;
    if (!exp) return false;
    const d = new Date(exp);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Articles</p>
            <p className="text-3xl font-black text-slate-900">{total}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
            <Package className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Stock Faible</p>
            <p className="text-3xl font-black text-amber-600">{lowStock}</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Péremption &lt; 30j</p>
            <p className="text-3xl font-black text-rose-600">{expiringSoon}</p>
          </div>
          <div className="p-4 bg-rose-50 rounded-2xl text-rose-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Inventory Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un médicament..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setFormData({ medicationId: '', quantity: '', type: 'IN' }); setModalOpen(true); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Mouvement de Stock
          </button>
          <button
            onClick={() => { setFormData({ medicationId: '', quantity: '', type: 'OUT' }); setModalOpen(true); }}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Sortie Stock
          </button>
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-black text-slate-900 flex items-center">
            <Pill className="w-5 h-5 mr-2 text-blue-600" />
            Inventaire Actif
          </h3>
          <div className="flex space-x-2">
            {['Tous', 'Médicaments', 'Consommables', 'Urgences'].map((cat, i) => (
              <button key={i} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                i === 0 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-slate-100 border-b border-slate-100">
          {items.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-4 p-12 text-center text-slate-500">
              Aucune donnée disponible pour cette année scolaire.
            </div>
          ) : items.map((item, i) => {
            const name = item.name || item.itemName || `Article ${item.id}`;
            const type = item.type || item.itemType || 'Médicament';
            const qty = item.qty ?? item.quantity ?? 0;
            const unit = item.unit || 'unités';
            const status = (item.status || item.stockStatus || 'OK').toUpperCase();
            const color = STATUS_COLORS[status] ?? STATUS_COLORS.OK;
            const expiry = item.expiry || item.expirationDate;
            const expiryLabel = expiry ? new Date(expiry).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'N/A';
            return (
              <motion.div
                key={item.id ?? i}
                whileHover={{ backgroundColor: '#F8FAFC' }}
                className="p-6 transition-colors group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded-md transition-all">
                    <MoreHorizontal className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{type}</p>
                <h4 className="font-black text-slate-900 mb-4">{name}</h4>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-slate-900">{qty}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Expire</p>
                    <p className="text-xs font-black text-slate-600">{expiryLabel}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Mouvement de stock</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Médicament (ID)</label>
                <input
                  type="text"
                  value={formData.medicationId}
                  onChange={(e) => setFormData({ ...formData, medicationId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="med-001"
                />
                {items.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    IDs disponibles : {items.slice(0, 5).map((i) => i.id).join(', ')}
                    {items.length > 5 ? '…' : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type de mouvement</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="IN">Entrée (approvisionnement)</option>
                  <option value="OUT">Sortie (distribution)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Quantité</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="10"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleMove}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
