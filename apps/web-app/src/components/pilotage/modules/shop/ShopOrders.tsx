/**
 * ============================================================================
 * SHOP ORDERS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { Loader2, Archive, Search, Filter, Plus, Clock, CheckCircle2, Truck, MoreVertical, Eye, Download, Calendar, ShoppingBag, User } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface OrderItem {
  id?: string;
  refNo?: string;
  reference?: string;
  number?: string;
  customerName?: string;
  parentName?: string;
  clientName?: string;
  studentName?: string;
  student?: string;
  date?: string;
  createdAt?: string;
  itemCount?: number;
  itemsCount?: number;
  total?: number;
  amount?: number;
  status?: string;
}

export default function ShopOrders() {
  const { academicYear } = useModuleContext();
  const { data: orders, loading, error } = useModulesList<OrderItem>(
    'shop',
    'orders',
    academicYear?.id,
  );

  const safeOrders = orders ?? [];

  // Calcul des compteurs par statut
  const pendingCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending') || s.includes('à prép');
  }).length;
  const confirmedCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('confirm') || s.includes('payé') || s.includes('paid');
  }).length;
  const toPrepareCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('prépar') || s.includes('prepare') || s.includes('ready');
  }).length;
  const deliveredCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('livr') || s.includes('deliver') || s.includes('prêt');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des commandes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les commandes. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Gestion des Commandes</h3>
          <p className="text-sm text-gray-400 font-medium">Suivez les pré-commandes parents et le processus de préparation</p>
        </div>
        <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
          <Plus className="w-4 h-4" />
          <span>Créer une Commande</span>
        </button>
      </div>

      {/* Stats Mini Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <OrderStatCard label="En attente" count={pendingCount} color="amber" icon={Clock} />
        <OrderStatCard label="Confirmées" count={confirmedCount} color="blue" icon={CheckCircle2} />
        <OrderStatCard label="À préparer" count={toPrepareCount} color="rose" icon={Archive} />
        <OrderStatCard label="Prêtes / Livrées" count={deliveredCount} color="emerald" icon={Truck} />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par N° commande, Parent ou Élève..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
          />
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            <Filter className="w-4 h-4" />
            <span>Filtres</span>
          </button>
          <button className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            <Calendar className="w-4 h-4" />
            <span>Période</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Commande</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Articles</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {safeOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-gray-500">
                    Aucune commande disponible pour cette année scolaire.
                  </td>
                </tr>
              ) : (
                safeOrders.map((order: any, i: number) => (
                  <OrderRow
                    key={order?.id ?? `order-${i}`}
                    id={order?.refNo ?? order?.reference ?? order?.number ?? order?.id ?? `CMD-${i}`}
                    name={order?.customerName ?? order?.parentName ?? order?.clientName ?? 'Client'}
                    student={order?.studentName ?? order?.student ?? ''}
                    date={order?.date ?? (order?.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : '—')}
                    itemCount={order?.itemCount ?? order?.itemsCount ?? 0}
                    total={order?.total ?? order?.amount ?? 0}
                    status={order?.status ?? 'En attente'}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderStatCard({ label, count, color, icon: Icon }: any) {
  const colorMap: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-xl ${colorMap[color]} border`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-xl font-black text-navy-900">{count}</p>
      </div>
    </div>
  );
}

function OrderRow({ id, name, student, date, itemCount, total, status }: any) {
  const statusColors: any = {
    'À préparer': 'bg-rose-50 text-rose-600 border-rose-100',
    'Payé': 'bg-blue-50 text-blue-600 border-blue-100',
    'Confirmé': 'bg-amber-50 text-amber-600 border-amber-100',
    'Prêt': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <tr className="hover:bg-gray-50/50 transition-all group">
      <td className="px-8 py-5">
        <span className="text-xs font-black text-navy-900 group-hover:text-navy-600 transition-colors">{id}</span>
      </td>
      <td className="px-8 py-5">
        <div>
          <p className="text-xs font-bold text-navy-900">{name}</p>
          {student && (
            <div className="flex items-center space-x-1 mt-0.5 text-gray-400">
              <User className="w-3 h-3" />
              <span className="text-[10px] font-medium">{student}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-5 text-xs text-gray-400 font-bold">{date}</td>
      <td className="px-8 py-5">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-4 h-4 text-gray-300" />
          <span className="text-xs font-bold text-gray-600">{itemCount} article{itemCount > 1 ? 's' : ''}</span>
        </div>
      </td>
      <td className="px-8 py-5 font-black text-navy-900 text-sm">{formatCurrency(total)}</td>
      <td className="px-8 py-5">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${statusColors[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
          {status}
        </span>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-2.5 bg-white text-navy-600 rounded-xl hover:bg-navy-50 shadow-sm transition-all">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-white text-navy-600 rounded-xl hover:bg-navy-50 shadow-sm transition-all">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2.5 bg-white text-navy-600 rounded-xl hover:bg-navy-50 shadow-sm transition-all">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
