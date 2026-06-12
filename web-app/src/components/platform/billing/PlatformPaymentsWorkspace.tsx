'use client';

import { CreditCard, DollarSign, Search, Filter, ArrowUpRight, CheckCircle2, MoreVertical } from 'lucide-react';

const MOCK_PAYMENTS = [
  { id: 'TRX-123', school: 'Lycée Excellence', amount: '250,000 FCFA', method: 'Fedapay / Card', status: 'SUCCESS', date: '2025-05-12 14:30' },
  { id: 'TRX-124', school: 'Collège Jean-Paul II', amount: '150,000 FCFA', method: 'Mobile Money', status: 'PENDING', date: '2025-05-14 09:15' },
];

export default function PlatformPaymentsWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paiements & Transactions</h1>
          <p className="text-slate-500">Historique global des encaissements plateforme</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
            <DollarSign className="w-4 h-4" />
            Enregistrer un paiement manuel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Référence ou école..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-lg text-sm" />
            </div>
            <button className="p-2 bg-slate-50 rounded-lg text-slate-500">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Transaction ID</th>
              <th className="px-6 py-4">École</th>
              <th className="px-6 py-4">Montant</th>
              <th className="px-6 py-4">Méthode</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Date & Heure</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_PAYMENTS.map((trx) => (
              <tr key={trx.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900">{trx.id}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{trx.school}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{trx.amount}</td>
                <td className="px-6 py-4 text-xs text-slate-600">{trx.method}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    trx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {trx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{trx.date}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
