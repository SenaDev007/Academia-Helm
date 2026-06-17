/**
 * ============================================================================
 * EDUCAST MONETIZATION & EARNINGS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Users, ShoppingCart, ArrowUpRight, ArrowDownRight, Wallet, Download, Clock, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EarningsData {
  kpis?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: string;
    positive?: boolean | null;
    icon?: string;
    color?: string;
    bg?: string;
  }>;
  transactions?: Array<{
    id: string | number;
    content?: string;
    title?: string;
    buyer?: string;
    customer?: string;
    date?: string;
    createdAt?: string;
    amount?: string | number;
    net?: string | number;
    netAmount?: string | number;
    status?: string;
  }>;
  payouts?: Array<{
    id: string | number;
    date?: string;
    amount?: string | number;
    status?: string;
  }>;
}

const ICONS: Record<string, any> = {
  DollarSign,
  TrendingUp,
  Wallet,
  ShoppingCart,
};

export default function EduCastMonetization() {
  const { academicYear } = useModuleContext();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await modulesApi.get<EarningsData>('educast/teacher-earnings', buildModulesApiOptions(academicYear.id));
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des revenus...</span>
      </div>
    );
  }

  const kpis = data?.kpis ?? [];
  const transactions = data?.transactions ?? [];
  const payouts = data?.payouts ?? [
    { id: 1, date: '01 Mai 2026', amount: '85.000', status: 'COMPLETED' },
    { id: 2, date: '01 Avril 2026', amount: '120.000', status: 'COMPLETED' },
    { id: 3, date: '01 Mars 2026', amount: '45.500', status: 'COMPLETED' },
  ];

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-[2rem] border border-slate-100">
            Aucune donnée de revenu disponible pour cette année scolaire.
          </div>
        ) : (
          kpis.map((kpi, i) => {
            const Icon = kpi.icon ? ICONS[kpi.icon] : DollarSign;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 rounded-2xl ${kpi.bg || 'bg-blue-50'} ${kpi.color || 'text-blue-600'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {kpi.positive !== null && kpi.positive !== undefined && (
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
            );
          })
        )}
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
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
              Aucune transaction pour cette année scolaire.
            </div>
          ) : (
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
                  {transactions.map((t, i) => {
                    const content = t.content || t.title || 'Contenu';
                    const buyer = t.buyer || t.customer || '—';
                    const date = t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—');
                    const amount = t.amount ?? '—';
                    const net = t.net ?? t.netAmount ?? '—';
                    const status = t.status || 'PAID';
                    return (
                      <tr key={t.id ?? i} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                        <td className="px-8 py-5">
                          <div>
                            <p className="font-black text-slate-900 leading-tight">{content}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{buyer}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-xs font-bold text-slate-500">{date}</td>
                        <td className="px-8 py-5 text-sm font-black text-slate-900">{amount}</td>
                        <td className="px-8 py-5 text-sm font-black text-emerald-600">{net}</td>
                        <td className="px-8 py-5 text-right">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded-lg">{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        {/* Payout History */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique de Paiement</h3>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
            {payouts.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Aucun paiement effectué.</p>
            ) : (
              payouts.map((p, i) => (
                <div key={p.id ?? i} className="flex items-center justify-between group">
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
              ))
            )}
            <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Voir tout l'historique</button>
          </div>
        </div>
      </div>
    </div>
  );
}
