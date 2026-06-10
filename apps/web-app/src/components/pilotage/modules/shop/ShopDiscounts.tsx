/**
 * ============================================================================
 * SHOP DISCOUNTS & PROMOTIONS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Tag, Percent, Plus, Search, Filter, Calendar, 
  Trash2, Edit, MoreVertical, CheckCircle2, 
  AlertCircle, Ticket, ShoppingCart, Zap
} from 'lucide-react';

export default function ShopDiscounts() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Remises & Promotions</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez les codes promos, soldes et remises automatiques</p>
        </div>
        <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
          <Plus className="w-4 h-4" />
          <span>Nouvelle Promotion</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">Promotions Actives</h3>
                <div className="flex items-center space-x-2">
                   <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-[10px] font-bold outline-none w-32" />
                   </div>
                </div>
             </div>
             <div className="p-0">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-left">
                   <thead className="bg-gray-50/50">
                      <tr>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nom / Code</th>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valeur</th>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usage</th>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Validité</th>
                         <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      <DiscountRow 
                        name="Rentrée Précoce" 
                        code="RENTREE26" 
                        value="-15%" 
                        type="CODE PROMO" 
                        usage="124/500" 
                        valid="Jusqu'au 31 Mai" 
                        status="Actif" 
                      />
                      <DiscountRow 
                        name="Remise Fratrie" 
                        code="SIBLING10" 
                        value="-10%" 
                        type="AUTO" 
                        usage="85/∞" 
                        valid="Permanent" 
                        status="Actif" 
                      />
                      <DiscountRow 
                        name="Liquidation Stock 2025" 
                        code="DESTOCK25" 
                        value="-50%" 
                        type="DIRECT" 
                        usage="45/∞" 
                        valid="Jusqu'au 15 Juin" 
                        status="Actif" 
                      />
                   </tbody>
                </table>
                </div>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl">
                       <Percent className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Analyse ORION</h3>
                 </div>
                 <p className="text-xs text-navy-200 font-medium leading-relaxed mb-8">
                   "La promotion <span className="text-white font-bold">RENTREE26</span> a généré 45% des ventes de kits ce mois-ci. Envisagez de la prolonger d'une semaine pour capturer les retardataires."
                 </p>
                 <div className="flex flex-col space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                       <span>Conversion</span>
                       <span className="text-emerald-400">+24%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[78%]"></div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight mb-6">Coupons à usage unique</h3>
              <div className="space-y-4">
                 <CouponItem code="WELCOME-2026-X8Y" used={false} />
                 <CouponItem code="FIDELITY-AC-P44" used={true} />
                 <CouponItem code="EXCUSE-ADMIN-01" used={false} />
              </div>
              <button className="w-full mt-8 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">
                 Générer des coupons
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function DiscountRow({ name, code, value, type, usage, valid, status }: any) {
  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-6">
          <p className="text-xs font-black text-navy-900 group-hover:text-navy-600 transition-colors">{name}</p>
          <div className="flex items-center space-x-1 mt-1">
             <Ticket className="w-3 h-3 text-gray-300" />
             <span className="text-[10px] font-bold text-gray-400">{code}</span>
          </div>
       </td>
       <td className="px-8 py-6 text-sm font-black text-emerald-600">{value}</td>
       <td className="px-8 py-6 text-[9px] font-black text-gray-400 uppercase tracking-widest">{type}</td>
       <td className="px-8 py-6 text-xs font-bold text-gray-600">{usage}</td>
       <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{valid}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-2">
             <button className="p-2.5 bg-white text-gray-400 rounded-xl hover:bg-navy-50 hover:text-navy-600 shadow-sm border border-gray-100 transition-all">
                <Edit className="w-4 h-4" />
             </button>
             <button className="p-2.5 bg-white text-gray-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 shadow-sm border border-gray-100 transition-all">
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
       </td>
    </tr>
  );
}

function CouponItem({ code, used }: any) {
   return (
      <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${used ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-navy-200'}`}>
         <span className={`text-[11px] font-black tracking-widest ${used ? 'line-through text-gray-400' : 'text-navy-900'}`}>{code}</span>
         {used ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
      </div>
   );
}
