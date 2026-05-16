/**
 * BankTreasury Component
 * 
 * Gestion de la trésorerie, des comptes bancaires et des réconciliations.
 */

'use client';

import { Wallet, Landmark, ArrowRightLeft, Plus, History } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function BankTreasury() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { bank: 'NSIA Banque', account: '4588 9965 221', balance: 12500000, type: 'Principal' },
          { bank: 'Ecobank', account: '1120 4452 001', balance: 5400000, type: 'Scolarité' },
          { bank: 'Caisse École', account: 'CASH-01', balance: 850000, type: 'Espèces' },
        ].map((acc, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-900 rounded-xl text-white">
                <Landmark className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-md uppercase">{acc.type}</span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{acc.bank}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(acc.balance)}</p>
            <p className="text-[10px] font-mono text-slate-400 mt-2">{acc.account}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <h3 className="font-bold text-slate-900 flex items-center gap-2">
             <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Flux de Trésorerie
           </h3>
           <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
             <Plus className="w-3 h-3" /> Nouveau Transfert
           </button>
        </div>
        <div className="p-12 text-center text-slate-400">
           <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
           <p className="text-sm">Aucun mouvement de trésorerie récent.</p>
        </div>
      </div>
    </div>
  );
}
