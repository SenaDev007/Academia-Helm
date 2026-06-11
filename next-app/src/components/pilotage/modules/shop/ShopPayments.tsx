/**
 * ============================================================================
 * SHOP PAYMENTS & WALLET - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Wallet, CreditCard, Banknote, History, Search, 
  Filter, ArrowUpRight, ArrowDownLeft, MoreVertical,
  Plus, Smartphone, DollarSign, User
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ShopPayments() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Wallet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-gradient-to-br from-navy-900 to-blue-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Total Portefeuille</h3>
                  <p className="text-navy-200 text-[10px] font-bold uppercase tracking-widest">Fonds sécurisés Academia Pay</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black">{formatCurrency(18545000)}</p>
                <p className="text-[10px] font-bold text-navy-300 uppercase tracking-widest mt-1">Solde global consolidé</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
              <QuickAction label="Recharger" icon={Plus} />
              <QuickAction label="Historique" icon={History} />
              <QuickAction label="Réglages" icon={Smartphone} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">Méthodes Favoris</h3>
            <div className="space-y-4">
              <PaymentMethodItem icon={Banknote} label="Espèces" percent={65} color="emerald" />
              <PaymentMethodItem icon={Smartphone} label="Academia Pay (Wallet)" percent={25} color="navy" />
              <PaymentMethodItem icon={CreditCard} label="Carte Bancaire" percent={10} color="amber" />
            </div>
          </div>
          <button className="w-full mt-8 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">
            Voir Analyse de Paiement
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Historique des Transactions</h3>
          <div className="flex items-center space-x-3">
             <div className="relative">
               <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
               <input 
                type="text" 
                placeholder="N° Transac..." 
                className="pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium w-48"
               />
             </div>
             <button className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100">
               <Filter className="w-4 h-4" />
             </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Méthode</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <TxRow 
                type="CRÉDIT" 
                refNo="TXN-2026-0884" 
                name="Moussa Fofana" 
                method="Momo (Topup)" 
                amount={50000} 
                status="Succès" 
                date="Il y a 2 min"
              />
              <TxRow 
                type="DÉBIT" 
                refNo="TXN-2026-0883" 
                name="Saliou Diallo" 
                method="Wallet (Achat)" 
                amount={12500} 
                status="Succès" 
                date="Il y a 15 min"
              />
              <TxRow 
                type="DÉBIT" 
                refNo="TXN-2026-0882" 
                name="Awa Konaté" 
                method="Espèces (Achat)" 
                amount={4500} 
                status="Succès" 
                date="Hier, 17:30"
              />
              <TxRow 
                type="CRÉDIT" 
                refNo="TXN-2026-0881" 
                name="Jean Koffi" 
                method="Carte (Topup)" 
                amount={100000} 
                status="En attente" 
                date="Hier, 16:45"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, icon: Icon }: any) {
  return (
    <button className="flex flex-col items-center justify-center space-y-3 p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
      <div className="p-3 bg-white/10 rounded-xl group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function PaymentMethodItem({ icon: Icon, label, percent, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500',
    navy: 'bg-navy-600',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2 text-navy-900">
          <Icon className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
        </div>
        <span className="text-[10px] font-black text-gray-400">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

function TxRow({ type, refNo, name, method, amount, status, date }: any) {
  return (
    <tr className="hover:bg-gray-50/50 transition-all group">
      <td className="px-8 py-5">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${type === 'CRÉDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {type === 'CRÉDIT' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          </div>
          <span className="text-[10px] font-black tracking-widest uppercase">{type}</span>
        </div>
      </td>
      <td className="px-8 py-5 text-xs font-bold text-navy-900 group-hover:text-navy-600">{refNo}</td>
      <td className="px-8 py-5">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span className="text-xs font-bold text-gray-600">{name}</span>
        </div>
      </td>
      <td className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-tight">{method}</td>
      <td className="px-8 py-5">
        <span className={`text-sm font-black ${type === 'CRÉDIT' ? 'text-emerald-600' : 'text-navy-900'}`}>
          {type === 'CRÉDIT' ? '+' : '-'}{formatCurrency(amount)}
        </span>
      </td>
      <td className="px-8 py-5">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${
          status === 'Succès' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
        }`}>
          {status}
        </span>
      </td>
      <td className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
    </tr>
  );
}
