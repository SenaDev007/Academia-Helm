'use client';

import { PieChart, CreditCard, DollarSign, Download, ExternalLink, MoreVertical, Search, Filter } from 'lucide-react';

const MOCK_INVOICES = [
  { id: 'FACT-2024-001', school: 'Lycée Excellence', amount: '250 000 F CFA', status: 'PAID', date: '2025-05-12' },
  { id: 'FACT-2024-002', school: 'Collège Jean-Paul II', amount: '150 000 F CFA', status: 'PENDING', date: '2025-05-14' },
];

export default function PlatformBillingWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturation SaaS</h1>
          <p className="text-slate-500">Gestion des factures et paiements des écoles</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-4 h-4" />
            Exporter
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
            <DollarSign className="w-4 h-4" />
            Nouvelle Facture
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <PieChart className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Chiffre d'Affaires Mensuel</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">12,4M F CFA</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Paiements en attente</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">1,8M F CFA</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Encaissements aujourd'hui</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">450K F CFA</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Dernières Factures</h3>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..." className="text-sm bg-transparent border-none focus:ring-0" />
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">N° Facture</th>
              <th className="px-6 py-4">École</th>
              <th className="px-6 py-4">Montant</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_INVOICES.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900">{inv.id}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{inv.school}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{inv.amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{inv.date}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
