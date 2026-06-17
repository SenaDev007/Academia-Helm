/**
 * ============================================================================
 * CANTEEN SUPPLIERS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/suppliers?academicYearId=...
 * Endpoint : POST /modules-complementaires/canteen/suppliers
 *
 * Note : la liste des bons de commande (sidebar) reste en mock car aucun
 * endpoint GET dédié n'est exposé pour les commandes.
 * ============================================================================
 */

import React from 'react';
import {
  Search, Plus,
  Phone, Mail, Star,
  ShoppingBag,
  MoreHorizontal, Loader2, Truck
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface SupplierItem {
  id: string;
  name?: string;
  companyName?: string;
  contact?: string;
  contactName?: string;
  phone?: string;
  phoneNumber?: string;
  category?: string;
  specialty?: string;
  rating?: number;
  score?: number;
  orders?: number;
  orderCount?: number;
  status?: string;
  email?: string,
  [key: string]: any;
}

// TODO: endpoint liste des commandes non disponible — garder mock
const ORDERS_MOCK = [
  { id: 'BC-2026-105', supplier: 'Grossiste CI', date: '14 Mai', amount: '450 000 F', status: 'Reçu' },
  { id: 'BC-2026-106', supplier: 'Boucherie Moderne', date: '15 Mai', amount: '120 000 F', status: 'En cours' },
  { id: 'BC-2026-107', supplier: 'Agro-Légumes', date: '15 Mai', amount: '85 000 F', status: 'Brouillon' },
];

export default function CanteenSuppliers() {
  const { academicYear } = useModuleContext();
  const { data: suppliers, loading, error } = useModulesList<SupplierItem>(
    'canteen',
    'suppliers',
    academicYear?.id,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des fournisseurs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Supplier Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="font-black text-navy-900 text-xl tracking-tight">Partenaires & Fournisseurs</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gérez votre chaîne d'approvisionnement</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Nom du fournisseur..."
                  className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-56 transition-all"
                />
              </div>
              <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
                <Plus className="w-4 h-4" />
                <span>Nouveau</span>
              </button>
            </div>
          </div>

          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun fournisseur enregistré pour cette année scolaire.
            </div>
          ) : (
          <div className="divide-y divide-gray-50">
            {suppliers.map((sup) => (
              <SupplierRow
                key={sup.id}
                name={sup.name ?? sup.companyName ?? '—'}
                contact={sup.contact ?? sup.contactName ?? '—'}
                phone={sup.phone ?? sup.phoneNumber ?? '—'}
                email={sup.email}
                category={sup.category ?? sup.specialty ?? '—'}
                rating={sup.rating ?? sup.score ?? 0}
                orders={sup.orders ?? sup.orderCount ?? 0}
                status={sup.status ?? 'Actif'}
              />
            ))}
          </div>
          )}
        </div>

        {/* Purchase Orders Sidebar */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-black text-navy-900 flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-navy-400" />
              <span>Dernières Commandes</span>
            </h4>
            <button className="text-[10px] font-black text-navy-600 uppercase hover:underline">Tout voir</button>
          </div>
          <div className="space-y-6">
            {ORDERS_MOCK.map((order) => (
              <OrderItem
                key={order.id}
                id={order.id}
                supplier={order.supplier}
                date={order.date}
                amount={order.amount}
                status={order.status}
              />
            ))}
          </div>
          <button className="w-full mt-10 py-4 bg-gray-50 text-navy-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            Nouveau Bon de Commande
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierRow({ name, contact, phone, email, category, rating, orders, status }: any) {
  const ratingNum = typeof rating === 'number' ? Math.min(Math.max(rating, 0), 5) : 0;
  return (
    <div className="p-8 group hover:bg-navy-50/30 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy-50 to-white border border-navy-100 flex items-center justify-center text-navy-600 font-black text-lg shadow-sm group-hover:scale-110 transition-all">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-navy-900 text-lg tracking-tight">{name}</h4>
            <div className="flex items-center space-x-3 mt-1">
              <p className="text-[10px] font-black text-navy-400 uppercase tracking-widest bg-navy-50 px-2 py-0.5 rounded border border-navy-100">{category}</p>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < ratingNum ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Commandes</p>
            <p className="text-sm font-black text-navy-900">{orders}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-navy-700">
              <Phone className="w-3 h-3" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-400">
              <Mail className="w-3 h-3" />
              <span>{email ?? `${String(contact).toLowerCase()}@partner.com`}</span>
            </div>
          </div>
          <button className="p-2.5 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderItem({ id, supplier, date, amount, status }: any) {
  const statusStyles: any = {
    'Reçu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En cours': 'bg-blue-50 text-blue-600 border-blue-100',
    'Brouillon': 'bg-gray-50 text-gray-400 border-gray-100',
  };
  return (
    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-50 hover:bg-white hover:border-gray-100 transition-all group/order">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] font-black text-navy-900 uppercase tracking-widest">{id}</p>
        <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${statusStyles[status] ?? statusStyles['Brouillon']}`}>
          {status}
        </div>
      </div>
      <p className="text-xs font-black text-navy-900 group-hover/order:text-navy-600 transition-colors">{supplier}</p>
      <div className="flex justify-between items-center mt-3">
        <p className="text-[10px] font-bold text-gray-400 italic">{date}</p>
        <p className="text-xs font-black text-navy-900">{amount}</p>
      </div>
    </div>
  );
}
