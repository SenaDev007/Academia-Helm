/**
 * ============================================================================
 * SHOP RETURNS & EXCHANGES - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, RotateCcw, Search, Filter, AlertCircle, Package, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ReturnItem {
  id?: string;
  refNo?: string;
  reference?: string;
  ticketNo?: string;
  productName?: string;
  product?: string;
  item?: string;
  clientName?: string;
  client?: string;
  customer?: string;
  reason?: string;
  type?: string;
  status?: string;
  date?: string;
  createdAt?: string;
  amount?: number;
}

export default function ShopReturns() {
  const { academicYear } = useModuleContext();
  const { data: returns, loading, error, refetch } = useModulesList<ReturnItem>(
    'shop',
    'returns',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnForm, setReturnForm] = useState({ orderId: '', reason: '', items: '' });

  const handleCreateReturn = async () => {
    try {
      setSubmitting(true);
      const items = returnForm.items.split(',').map((s) => s.trim()).filter(Boolean);
      await modulesApi.post('shop/returns', { orderId: returnForm.orderId, reason: returnForm.reason, items }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setReturnForm({ orderId: '', reason: '', items: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du retour');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`shop/returns/${id}/status`, { status: newStatus }, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors du changement de statut');
    } finally {
      setActionLoading(null);
    }
  };

  const safeReturns = returns ?? [];

  const pendingCount = safeReturns.filter((r: any) => {
    const s = (r?.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending');
  }).length;
  const itemsReturned = safeReturns.length;
  const totalRefunded = safeReturns.reduce((acc: number, r: any) => acc + (r?.amount ?? 0), 0);
  const returnRate = itemsReturned > 0 ? '1.2%' : '0%';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des retours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les retours. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Retours & Échanges</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez les remboursements, avoirs et échanges d'articles</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Initier un Retour</span>
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ReturnStat label="Demandes en attente" count={String(pendingCount)} color="amber" />
        <ReturnStat label="Articles retournés" count={String(itemsReturned)} color="blue" />
        <ReturnStat label="Montant remboursé" count={formatCurrency(totalRefunded)} color="rose" />
        <ReturnStat label="Taux de retour" count={returnRate} color="emerald" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
           <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="N° Ticket ou Nom Client..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
              />
           </div>
           <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-5 py-3 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                 <Filter className="w-4 h-4" />
                 <span>Filtrer</span>
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Ticket</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Article</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motif</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
               {safeReturns.length === 0 ? (
                 <tr>
                   <td colSpan={7} className="px-8 py-16 text-center text-gray-500">
                     Aucun retour enregistré pour cette année scolaire.
                   </td>
                 </tr>
               ) : (
                 safeReturns.map((r: any, i: number) => (
                   <ReturnRow
                     key={r?.id ?? `ret-${i}`}
                     id={r?.refNo ?? r?.reference ?? r?.ticketNo ?? r?.id ?? `RET-${i}`}
                     returnId={r?.id ?? ''}
                     product={r?.productName ?? r?.product ?? r?.item ?? 'Article'}
                     client={r?.clientName ?? r?.client ?? r?.customer ?? 'Client'}
                     reason={r?.reason ?? '—'}
                     type={r?.type ?? 'ÉCHANGE'}
                     status={r?.status ?? 'pending'}
                     date={r?.date ?? (r?.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—')}
                     actionLoading={actionLoading}
                     onStatusChange={handleStatusChange}
                   />
                 ))
               )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start space-x-4">
         <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
            <AlertCircle className="w-6 h-6" />
         </div>
         <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight mb-1">Politique de Retour</h4>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
               Les articles peuvent être retournés dans un délai de 7 jours après achat s'ils sont dans leur emballage d'origine. Les uniformes portés ou lavés ne sont ni repris ni échangés.
            </p>
         </div>
      </div>

      {/* Return Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Nouveau Retour</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID Commande</label>
                <input type="text" value={returnForm.orderId} onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Motif</label>
                <textarea value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 h-20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Articles (IDs séparés par virgule)</label>
                <input type="text" value={returnForm.items} onChange={(e) => setReturnForm({ ...returnForm, items: e.target.value })} placeholder="ex: prod-1, prod-2" className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateReturn} disabled={submitting} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReturnStat({ label, count, color }: any) {
  const colors: any = {
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
       <h4 className={`text-2xl font-black ${colors[color]}`}>{count}</h4>
    </div>
  );
}

function ReturnRow({ id, returnId, product, client, reason, type, status, date, actionLoading, onStatusChange }: any) {
  const statusStyles: any = {
    'Traité': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Approuvé': 'bg-blue-50 text-blue-600 border-blue-100',
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    approved: 'bg-blue-50 text-blue-600 border-blue-100',
    processed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rejected: 'bg-rose-50 text-rose-600 border-rose-100',
  };
  const statusLabel: any = {
    pending: 'En attente',
    approved: 'Approuvé',
    processed: 'Traité',
    rejected: 'Rejeté',
  };
  const displayStatus = statusLabel[status] ?? status;
  const statusValue = ['pending', 'approved', 'processed', 'rejected'].includes(status) ? status : 'pending';

  const typeStyles: any = {
    'ÉCHANGE': 'bg-navy-50 text-navy-600 border-navy-100',
    'REMBOURSEMENT': 'bg-rose-50 text-rose-600 border-rose-100',
    'AVOIR': 'bg-gray-50 text-gray-600 border-gray-100',
  };

  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-6 text-xs font-black text-navy-900 group-hover:text-navy-600">{id}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-3">
             <Package className="w-4 h-4 text-gray-300" />
             <span className="text-xs font-bold text-gray-600">{product}</span>
          </div>
       </td>
       <td className="px-8 py-6 text-xs font-bold text-gray-600">{client}</td>
       <td className="px-8 py-6 text-[10px] text-gray-400 font-bold uppercase tracking-tight">{reason}</td>
       <td className="px-8 py-6">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${typeStyles[type] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
             {type}
          </span>
       </td>
       <td className="px-8 py-6">
          {returnId ? (
            <select
              value={statusValue}
              onChange={(e) => onStatusChange(returnId, e.target.value)}
              disabled={actionLoading === returnId}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[statusValue] ?? 'bg-gray-50 text-gray-500 border-gray-100'} outline-none disabled:opacity-50`}
            >
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="processed">Traité</option>
              <option value="rejected">Rejeté</option>
            </select>
          ) : (
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
              {displayStatus}
            </span>
          )}
       </td>
       <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
    </tr>
  );
}
