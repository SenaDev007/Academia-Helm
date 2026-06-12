/**
 * ============================================================================
 * EDUCAST MONETIZATION & EARNINGS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Users, ShoppingCart, ArrowUpRight, ArrowDownRight, Wallet, Download, Clock } from 'lucide-react';

export default function EduCastMonetization() {
  const kpis = [
    { label: 'Revenus Bruts', value: '245 800', unit: 'F CFA', trend: '+12%', positive: true, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Commission École', value: '49 160', unit: 'F CFA', trend: '20%', positive: null, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Revenus Nets', value: '196 640', unit: 'F CFA', trend: '+15%', positive: true, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ventes Totales', value: '84', unit: 'unités', trend: '+8', positive: true, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const transactions = [
    { id: 1, content: 'Pack Révision Math 3ème', buyer: 'M. Saliou (Parent)', date: '15/05/2026', amount: '15.000', net: '12.000', status: 'PAID' },
    { id: 2, content: 'Capsule : Les Dérivées', buyer: 'Y. Aminata (Élève)', date: '14/05/2026', amount: '1.500', net: '1.200', status: 'PAID' },
    { id: 3, content: 'Abonnement Mensuel', buyer: 'K. Jean (Parent)', date: '14/05/2026', amount: '5.000', net: '4.000', status: 'PAID' },
    { id: 4, content: 'Cours : Optique Géo', buyer: 'L. Moussa (Parent)', date: '12/05/2026', amount: '2.500', net: '2.000', status: 'PAID' },
  ];

  return (
    <div className="space-y-10">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              {kpi.positive !== null && (
                <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${kpi.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpi.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {kpi.trend}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</h4>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">
                {kpi.value} <span className="text-xs font-bold text-slate-400 ml-1">{kpi.unit}</span>
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Dernières Ventes</h3>
            <button className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exporter (CSV)
            </button>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-5">Contenu / Client</th>
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Montant Brut</th>
                  <th className="px-8 py-5">Part Enseignant</th>
                  <th className="px-8 py-5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((t, i) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <td className="px-8 py-5">
                      <div>
                        <p className="font-black text-slate-900 leading-tight">{t.content}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.buyer}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500">{t.date}</td>
                    <td className="px-8 py-5 text-sm font-black text-slate-900">{t.amount}</td>
                    <td className="px-8 py-5 text-sm font-black text-emerald-600">{t.net}</td>
                    <td className="px-8 py-5 text-right">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded-lg">Paiement Reçu</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Payout History */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique de Paiement</h3>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
            {[
              { id: 1, date: '01 Mai 2026', amount: '85.000', status: 'COMPLETED' },
              { id: 2, date: '01 Avril 2026', amount: '120.000', status: 'COMPLETED' },
              { id: 3, date: '01 Mars 2026', amount: '45.500', status: 'COMPLETED' },
            ].map((p, i) => (
              <div key={p.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{p.amount} <span className="text-[10px] font-bold">F CFA</span></p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.date}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <Download className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            ))}
            <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Voir tout l'historique</button>
          </div>
        </div>
      </div>
    </div>
  );
}
