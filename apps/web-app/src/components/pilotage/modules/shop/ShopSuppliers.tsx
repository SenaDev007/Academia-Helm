/**
 * ============================================================================
 * SHOP SUPPLIERS & PROCUREMENT - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { Loader2, Truck, FileText, Plus, Phone, Mail, MoreVertical, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface SupplierItem {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  phone?: string;
  email?: string;
  ordersCount?: number;
  totalAmount?: number;
  total?: number;
}

interface PurchaseOrderItem {
  id?: string;
  refNo?: string;
  reference?: string;
  number?: string;
  supplierName?: string;
  supplier?: string;
  amount?: number;
  total?: number;
  status?: string;
  deliveryDate?: string;
  expectedDate?: string;
  date?: string;
}

export default function ShopSuppliers() {
  const { academicYear } = useModuleContext();
  const { data: suppliers, loading: supLoading, error: supError } = useModulesList<SupplierItem>(
    'shop',
    'suppliers',
    academicYear?.id,
  );
  const { data: purchaseOrders, loading: poLoading, error: poError } = useModulesList<PurchaseOrderItem>(
    'shop',
    'purchase-orders',
    academicYear?.id,
  );

  if (supLoading || poLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des fournisseurs...</span>
      </div>
    );
  }

  const errorMsg = supError || poError;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {errorMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données d'approvisionnement. {errorMsg}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Fournisseurs & Approvisionnement</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez votre réseau de partenaires et vos bons de commande (PO)</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            <FileText className="w-4 h-4" />
            <span>Nouvel Achat</span>
          </button>
          <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
            <Plus className="w-4 h-4" />
            <span>Nouveau Fournisseur</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Suppliers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(suppliers ?? []).length === 0 ? (
              <div className="md:col-span-2 text-center py-12 text-gray-500">
                Aucun fournisseur enregistré pour cette année scolaire.
              </div>
            ) : (
              (suppliers ?? []).map((supplier: any, i: number) => (
                <SupplierCard
                  key={supplier?.id ?? `sup-${i}`}
                  name={supplier?.name ?? `Fournisseur #${i + 1}`}
                  category={supplier?.category ?? supplier?.type ?? 'Général'}
                  phone={supplier?.phone ?? '—'}
                  email={supplier?.email ?? '—'}
                  stats={{
                    orders: supplier?.ordersCount ?? 0,
                    total: supplier?.totalAmount ?? supplier?.total ?? 0,
                  }}
                />
              ))
            )}
          </div>

          {/* Active Purchase Orders */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Bons de Commande Récents</h3>
              <button className="text-[10px] font-black text-navy-600 uppercase tracking-widest hover:underline">Voir tout le registre</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° PO</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fournisseur</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Livraison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(purchaseOrders ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                        Aucun bon de commande enregistré.
                      </td>
                    </tr>
                  ) : (
                    (purchaseOrders ?? []).map((po: any, i: number) => (
                      <PORow
                        key={po?.id ?? `po-${i}`}
                        id={po?.refNo ?? po?.reference ?? po?.number ?? po?.id ?? `ACH-${i}`}
                        supplier={po?.supplierName ?? po?.supplier ?? '—'}
                        amount={po?.amount ?? po?.total ?? 0}
                        status={po?.status ?? 'En Attente'}
                        date={po?.deliveryDate ?? po?.expectedDate ?? po?.date ?? '—'}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Procurement Analytics */}
        <div className="space-y-6">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight mb-8">Répartition des Achats</h3>
              <div className="space-y-6">
                 <ProcurementCategory label="Textile / Uniformes" amount={0} percent={45} color="navy" />
                 <ProcurementCategory label="Papeterie" amount={0} percent={30} color="emerald" />
                 <ProcurementCategory label="Livres" amount={0} percent={15} color="blue" />
                 <ProcurementCategory label="Autres" amount={0} percent={10} color="amber" />
              </div>
              {(suppliers ?? []).length === 0 && (
                <p className="mt-6 text-[10px] text-gray-400 text-center">Données d'analyse non disponibles.</p>
              )}
           </div>

           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-navy-800 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700"></div>
              <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                    <Truck className="w-6 h-6 text-navy-400" />
                    <h3 className="font-black uppercase tracking-tight">Optimisation ORION</h3>
                 </div>
                 <p className="text-xs text-navy-200 font-medium leading-relaxed mb-6">
                   "L'analyse des performances fournisseurs sera disponible une fois vos données d'achat renseignées."
                 </p>
                 <button className="flex items-center justify-between w-full p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all group">
                    <span className="text-[10px] font-black uppercase tracking-widest">Analyser les performances</span>
                    <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function SupplierCard({ name, category, phone, email, stats }: any) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm hover:shadow-xl transition-all duration-300 group">
      <div className="flex justify-between items-start mb-6">
         <div className="p-4 bg-navy-50 rounded-2xl text-navy-600 group-hover:scale-110 transition-transform">
           <Truck className="w-6 h-6" />
         </div>
         <button className="p-2 text-gray-300 hover:text-navy-900 transition-colors">
            <MoreVertical className="w-5 h-5" />
         </button>
      </div>

      <h4 className="text-lg font-black text-navy-900 mb-1">{name}</h4>
      <p className="text-[10px] font-black text-navy-600 uppercase tracking-widest mb-6">{category}</p>

      <div className="space-y-3 mb-8">
         <div className="flex items-center space-x-3 text-gray-500">
            <Phone className="w-4 h-4" />
            <span className="text-xs font-medium">{phone}</span>
         </div>
         <div className="flex items-center space-x-3 text-gray-500">
            <Mail className="w-4 h-4" />
            <span className="text-xs font-medium truncate">{email}</span>
         </div>
      </div>

      <div className="pt-6 border-t border-gray-50 grid grid-cols-2 gap-4">
         <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Commandes</p>
            <p className="text-sm font-black text-navy-900">{stats.orders}</p>
         </div>
         <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Volume</p>
            <p className="text-sm font-black text-emerald-600">{formatCurrency(stats.total)}</p>
         </div>
      </div>
    </div>
  );
}

function PORow({ id, supplier, amount, status, date }: any) {
  const statusStyles: any = {
    'Reçu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En Transit': 'bg-blue-50 text-blue-600 border-blue-100',
    'En Attente': 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-5 text-xs font-black text-navy-900">{id}</td>
       <td className="px-8 py-5 text-xs font-bold text-gray-600">{supplier}</td>
       <td className="px-8 py-5 text-sm font-black text-navy-900">{formatCurrency(amount)}</td>
       <td className="px-8 py-5">
         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
            {status}
         </span>
       </td>
       <td className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
    </tr>
  );
}

function ProcurementCategory({ label, amount, percent, color }: any) {
  const colors: any = {
    navy: 'bg-navy-900',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
          <span className="text-navy-900">{label}</span>
          <span className="text-gray-400">{formatCurrency(amount)}</span>
       </div>
       <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
          <div className={`h-full ${colors[color]} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
       </div>
    </div>
  );
}
