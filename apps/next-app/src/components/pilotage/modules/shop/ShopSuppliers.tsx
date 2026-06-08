/**
 * ============================================================================
 * SHOP SUPPLIERS & PROCUREMENT - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Users, Truck, FileText, Plus, Search, Filter, 
  ExternalLink, Phone, Mail, MapPin, MoreVertical,
  CheckCircle2, Clock, XCircle, ChevronRight, DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ShopSuppliers() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
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
            <SupplierCard 
              name="Bureau Vallée" 
              category="Papeterie" 
              phone="+221 33 800 00 00" 
              email="contact@bureauvallee.sn" 
              stats={{ orders: 12, total: 4500000 }}
            />
            <SupplierCard 
              name="Uniformes Express" 
              category="Textile" 
              phone="+221 77 123 45 67" 
              email="sales@uexpress.com" 
              stats={{ orders: 8, total: 8200000 }}
            />
            <SupplierCard 
              name="Librairie Clairafrique" 
              category="Livres & Manuels" 
              phone="+221 33 822 11 00" 
              email="manuels@clairafrique.sn" 
              stats={{ orders: 24, total: 12500000 }}
            />
            <SupplierCard 
              name="Sport Direct" 
              category="Équipements Sportifs" 
              phone="+221 70 999 88 77" 
              email="info@sportdirect.sn" 
              stats={{ orders: 5, total: 1800000 }}
            />
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
                  <PORow id="ACH-2026-045" supplier="Bureau Vallée" amount={850000} status="Reçu" date="Aujourd'hui" />
                  <PORow id="ACH-2026-044" supplier="Uniformes Express" amount={2400000} status="En Transit" date="Lundi 18 Mai" />
                  <PORow id="ACH-2026-043" supplier="Librairie Clairafrique" amount={1200000} status="En Attente" date="Prévu 20 Mai" />
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
                 <ProcurementCategory label="Textile / Uniformes" amount={12500000} percent={45} color="navy" />
                 <ProcurementCategory label="Papeterie" amount={8200000} percent={30} color="emerald" />
                 <ProcurementCategory label="Livres" amount={4500000} percent={15} color="blue" />
                 <ProcurementCategory label="Autres" amount={2800000} percent={10} color="amber" />
              </div>
           </div>

           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-navy-800 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700"></div>
              <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                    <Truck className="w-6 h-6 text-navy-400" />
                    <h3 className="font-black uppercase tracking-tight">Optimisation ORION</h3>
                 </div>
                 <p className="text-xs text-navy-200 font-medium leading-relaxed mb-6">
                   "Le fournisseur <span className="text-white font-bold">Bureau Vallée</span> a réduit ses délais de livraison de 15% ce trimestre. Considérez de grouper vos prochaines commandes de papeterie chez eux pour économiser sur les frais logistiques."
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
         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status]}`}>
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
