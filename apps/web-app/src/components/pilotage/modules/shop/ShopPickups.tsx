/**
 * ============================================================================
 * SHOP PICKUPS & DELIVERIES - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Truck, CheckCircle2, Package, MapPin, User, Search, Filter, MoreVertical, Eye, Smartphone, Bell } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface DeliveryItem {
  id?: string;
  refNo?: string;
  reference?: string;
  code?: string;
  customerName?: string;
  parentName?: string;
  clientName?: string;
  type?: string;
  deliveryType?: string;
  status?: string;
  date?: string;
  scheduledAt?: string;
  appointment?: string;
  rendezVous?: string;
}

export default function ShopPickups() {
  const { academicYear } = useModuleContext();
  const { data: deliveries, loading, error, refetch } = useModulesList<DeliveryItem>(
    'shop',
    'deliveries',
    academicYear?.id,
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`shop/deliveries/${id}/status`, { status: newStatus }, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors du changement de statut');
    } finally {
      setActionLoading(null);
    }
  };

  const safeDeliveries = deliveries ?? [];

  const toPickupCount = safeDeliveries.filter((d: any) => {
    const t = (d?.type ?? d?.deliveryType ?? '').toString().toLowerCase();
    const s = (d?.status ?? '').toString().toLowerCase();
    return (t.includes('sur place') || t.includes('pickup')) && (s.includes('prêt') || s.includes('ready') || s.includes('attente') || s.includes('pending'));
  }).length;
  const inProgressCount = safeDeliveries.filter((d: any) => {
    const s = (d?.status ?? '').toString().toLowerCase();
    return s.includes('route') || s.includes('transit') || s.includes('progress');
  }).length;
  const deliveredCount = safeDeliveries.filter((d: any) => {
    const s = (d?.status ?? '').toString().toLowerCase();
    return s.includes('livré') || s.includes('delivered') || s.includes('done');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des livraisons...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les livraisons. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Livraisons & Retraits</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez la remise des commandes aux parents et les livraisons à domicile</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            <Truck className="w-4 h-4" />
            <span>Planifier Tournée</span>
          </button>
          <button
            onClick={() => alert('Sélectionnez une livraison dans le tableau pour confirmer le retrait.')}
            className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmer Retrait</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatusCard label="À Retirer (Sur place)" count={toPickupCount} icon={Package} color="amber" />
        <StatusCard label="Livraisons en cours" count={inProgressCount} icon={Truck} color="blue" />
        <StatusCard label="Livrés Aujourd'hui" count={deliveredCount} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
             <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par N° commande, Parent ou Code de retrait..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
                />
             </div>
             <button className="p-3 bg-gray-100 text-gray-400 rounded-xl hover:text-navy-900">
                <Filter className="w-4 h-4" />
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50/50">
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Code</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Parent</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rendez-vous</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {safeDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-8 py-16 text-center text-gray-500">
                            Aucune livraison ou retrait enregistré pour cette année scolaire.
                          </td>
                        </tr>
                      ) : (
                        safeDeliveries.map((d: any, i: number) => (
                          <PickupRow
                            key={d?.id ?? `dlv-${i}`}
                            id={d?.refNo ?? d?.reference ?? d?.code ?? d?.id ?? `PKP-${i}`}
                            deliveryId={d?.id ?? ''}
                            name={d?.customerName ?? d?.parentName ?? d?.clientName ?? 'Client'}
                            type={d?.type ?? d?.deliveryType ?? 'Sur place'}
                            status={d?.status ?? 'pending'}
                            date={d?.date ?? d?.appointment ?? d?.rendezVous ?? (d?.scheduledAt ? new Date(d.scheduledAt).toLocaleDateString('fr-FR') : '—')}
                            actionLoading={actionLoading}
                            onStatusChange={handleStatusChange}
                          />
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-8">
                    <div className="p-3 bg-white/10 rounded-2xl">
                       <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Vérification SMS</h3>
                 </div>
                 <p className="text-xs text-navy-200 font-medium leading-relaxed mb-8">
                    Saisissez le code de vérification reçu par le parent pour valider le retrait sécurisé de la commande.
                 </p>
                 <div className="flex gap-2 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                      <input key={i} type="text" maxLength={1} className="w-full h-14 bg-white/10 border border-white/20 rounded-xl text-center text-xl font-black focus:bg-white/20 focus:border-white outline-none transition-all" />
                    ))}
                 </div>
                 <button className="w-full py-4 bg-white text-navy-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-50 transition-all active:scale-95">
                    Valider le Code
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">Notifications</h3>
                 <Bell className="w-5 h-5 text-gray-300" />
              </div>
              <div className="space-y-4">
                 {safeDeliveries.length === 0 ? (
                   <p className="text-xs text-gray-400 text-center py-4">Aucune notification récente.</p>
                 ) : (
                   safeDeliveries.slice(0, 3).map((d: any, i: number) => (
                     <NotificationItem
                       key={`notif-${i}`}
                       text={`Mise à jour : ${d?.refNo ?? d?.reference ?? d?.code ?? 'Commande'} — ${d?.status ?? 'En attente'}`}
                       time="récemment"
                     />
                   ))
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, count, icon: Icon, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
       <div className={`p-4 rounded-2xl w-fit border ${colors[color]} mb-6 group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
       </div>
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-3xl font-black text-navy-900">{count}</h4>
    </div>
  );
}

function PickupRow({ id, deliveryId, name, type, status, date, actionLoading, onStatusChange }: any) {
  const statusStyles: any = {
    'Prêt': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En Route': 'bg-blue-50 text-blue-600 border-blue-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Planifié': 'bg-gray-50 text-gray-400 border-gray-100',
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    ready: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    picked_up: 'bg-blue-50 text-blue-600 border-blue-100',
    delivered: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  const statusLabel: any = {
    pending: 'En attente',
    ready: 'Prêt',
    picked_up: 'Récupéré',
    delivered: 'Livré',
  };
  const displayStatus = statusLabel[status] ?? status;
  const statusValue = ['pending', 'ready', 'picked_up', 'delivered'].includes(status) ? status : 'pending';

  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-6 text-xs font-black text-navy-900 group-hover:text-navy-600">{id}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
             </div>
             <span className="text-xs font-bold text-gray-600">{name}</span>
          </div>
       </td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-2 text-gray-400">
             {type === 'Sur place' ? <MapPin className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
             <span className="text-[10px] font-black uppercase tracking-tight">{type}</span>
          </div>
       </td>
       <td className="px-8 py-6">
          {deliveryId ? (
            <select
              value={statusValue}
              onChange={(e) => onStatusChange(deliveryId, e.target.value)}
              disabled={actionLoading === deliveryId}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[statusValue] ?? 'bg-gray-50 text-gray-400 border-gray-100'} outline-none disabled:opacity-50`}
            >
              <option value="pending">En attente</option>
              <option value="ready">Prêt</option>
              <option value="picked_up">Récupéré</option>
              <option value="delivered">Livré</option>
            </select>
          ) : (
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status] ?? 'bg-gray-50 text-gray-400 border-gray-100'}`}>
              {displayStatus}
            </span>
          )}
       </td>
       <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-2">
             <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-navy-50 hover:text-navy-600 transition-all">
                <Eye className="w-4 h-4" />
             </button>
             <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all">
                <MoreVertical className="w-4 h-4" />
             </button>
          </div>
       </td>
    </tr>
  );
}

function NotificationItem({ text, time }: any) {
   return (
      <div className="flex items-start space-x-3 p-3 rounded-2xl hover:bg-gray-50 transition-all group">
         <div className="w-1.5 h-1.5 rounded-full bg-navy-500 mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform"></div>
         <div className="flex-1">
            <p className="text-[11px] font-medium text-gray-600 leading-tight">{text}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{time}</p>
         </div>
      </div>
   );
}
