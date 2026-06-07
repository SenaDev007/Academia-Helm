/**
 * ShopCanteenManagement Component
 * 
 * Gestion de la boutique (économat) et de la cantine scolaire.
 */

'use client';

import { useState } from 'react';
import { 
  ShoppingCart, 
  Utensils, 
  Package, 
  TrendingUp, 
  CreditCard,
  Plus,
  Box,
  Layers,
  History
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function ShopCanteenManagement() {
  const [activeTab, setActiveTab] = useState<'SHOP' | 'CANTEEN'>('SHOP');

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('SHOP')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'SHOP' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ShoppingCart className="w-4 h-4" /> Boutique & Économat
        </button>
        <button 
          onClick={() => setActiveTab('CANTEEN')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'CANTEEN' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Utensils className="w-4 h-4" /> Cantine & Restauration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Column */}
        <div className="space-y-4">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl w-fit">
                {activeTab === 'SHOP' ? <Package className="w-6 h-6 text-blue-600" /> : <Utensils className="w-6 h-6 text-emerald-600" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'SHOP' ? 'Ventes Boutique' : 'Repas Cantine'}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{activeTab === 'SHOP' ? formatCurrency(1250000) : '450 repas/jour'}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" /> +15% ce mois
              </div>
           </div>

           <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" /> État des Stocks
              </h4>
              <div className="space-y-3">
                 {[
                   { label: 'Cahiers TP', value: 85, color: 'bg-emerald-500' },
                   { label: 'Uniformes L', value: 12, color: 'bg-rose-500' },
                   { label: 'Riz (Sacs)', value: 45, color: 'bg-amber-500' },
                 ].map((item, i) => (
                   <div key={i} className="space-y-1">
                     <div className="flex justify-between text-[10px] uppercase font-bold">
                       <span className="text-slate-400">{item.label}</span>
                       <span>{item.value} unités</span>
                     </div>
                     <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                       <div className={cn("h-full", item.color)} style={{ width: `${item.value}%` }} />
                     </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Content Column */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" /> Dernières Transactions
                </h3>
                <button className="text-xs font-bold text-blue-600 hover:underline">Voir tout</button>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { ref: 'TRX-99', item: 'Pack Inscription 6ème', type: 'SHOP', amount: 25000, date: 'Aujourd\'hui 10:45' },
                  { ref: 'TRX-98', item: 'Forfait Cantine Trimestre', type: 'CANTEEN', amount: 45000, date: 'Aujourd\'hui 09:12' },
                  { ref: 'TRX-97', item: 'Uniforme EPS (M)', type: 'SHOP', amount: 8500, date: 'Hier 16:30' },
                ].map((trx, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-lg",
                        trx.type === 'SHOP' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {trx.type === 'SHOP' ? <ShoppingCart className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{trx.item}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{trx.ref} • {trx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(trx.amount)}</p>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Validé</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
