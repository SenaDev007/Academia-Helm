'use client';

import { CreditCard, Plus, Search, Filter, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function TransportPayments() {
  const payments = [
    { id: '1', student: 'Fatou Sow', amount: '25 000 F CFA', date: '2026-05-10', method: 'Orange Money', status: 'PAID' },
    { id: '2', student: 'Abdoulaye Diallo', amount: '25 000 F CFA', date: '—', method: '—', status: 'UNPAID' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recettes du mois</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black text-slate-900 tracking-tighter">1 250 000 F CFA</p>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Impayés</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black text-rose-600 tracking-tighter">175 000 F CFA</p>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Taux de recouvrement</p>
          <p className="text-2xl font-black text-navy-900 tracking-tighter">87.5%</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Suivi des paiements</h4>
          <button className="text-xs font-black text-navy-900 uppercase tracking-widest hover:underline flex items-center gap-2">
            <Download className="w-4 h-4" /> Exporter PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{p.student}</p>
                  </td>
                  <td className="px-8 py-5 font-black text-slate-900 text-sm tracking-tighter">{p.amount}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-600">{p.date}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-600 uppercase italic">{p.method}</td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      p.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {p.status}
                    </span>
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
