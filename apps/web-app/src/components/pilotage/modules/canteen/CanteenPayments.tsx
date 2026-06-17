/**
 * ============================================================================
 * CANTEEN PAYMENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/payments?academicYearId=...
 * Endpoint : POST /modules-complementaires/canteen/payments
 * ============================================================================
 */

import React from 'react';
import {
  Search, Filter, Download,
  CreditCard, Wallet, Smartphone,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, Plus,
  DollarSign, TrendingUp, Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface PaymentItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  period?: string;
  periodLabel?: string;
  plan?: string;
  subscriptionPlan?: string;
  amount?: number;
  amountPaid?: number;
  paid?: number;
  mode?: string;
  paymentMethod?: string;
  status?: string;
  [key: string]: any;
}

export default function CanteenPayments() {
  const { academicYear } = useModuleContext();
  const { data: payments, loading, error } = useModulesList<PaymentItem>(
    'canteen',
    'payments',
    academicYear?.id,
  );

  const totalRevenue = payments
    .filter((p) => {
      const s = (p.status ?? '').toLowerCase();
      return s.includes('payé') || s.includes('paid');
    })
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const pendingCount = payments.filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending');
  }).length;
  const pendingAmount = payments
    .filter((p) => {
      const s = (p.status ?? '').toLowerCase();
      return s.includes('attente') || s.includes('pending') || s.includes('retard') || s.includes('late');
    })
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const paidCount = payments.filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s.includes('payé') || s.includes('paid');
  }).length;
  const recoveryRate = payments.length > 0 ? Math.round((paidCount / payments.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paiements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceCard
          title="Recettes (Payées)"
          value={`${totalRevenue.toLocaleString('fr-FR')} F`}
          change={`${paidCount} paiement${paidCount > 1 ? 's' : ''}`}
          trend="up"
          icon={TrendingUp}
          color="emerald"
        />
        <FinanceCard
          title="Paiements en attente"
          value={`${pendingAmount.toLocaleString('fr-FR')} F`}
          change={`${pendingCount} élève${pendingCount > 1 ? 's' : ''}`}
          trend="neutral"
          icon={Clock}
          color="amber"
        />
        <FinanceCard
          title="Taux de recouvrement"
          value={`${recoveryRate}%`}
          change={`sur ${payments.length} paiement${payments.length > 1 ? 's' : ''}`}
          trend="up"
          icon={CheckCircle2}
          color="blue"
        />
        <FinanceCard
          title="Total Paiements"
          value={String(payments.length)}
          change="Toutes statuts confondus"
          trend="down"
          icon={AlertCircle}
          color="red"
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Suivi des Paiements</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gestion financière de la restauration scolaire</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input
                type="text"
                placeholder="Élève, parent, reçu..."
                className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-navy-600 rounded-2xl transition-all shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
              <Plus className="w-4 h-4" />
              <span>Nouveau Paiement</span>
            </button>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun paiement enregistré pour cette année scolaire.
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève & Période</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mode</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((payment) => {
                const amount = payment.amount ?? 0;
                const paid = payment.paid ?? payment.amountPaid;
                return (
                <PaymentRow
                  key={payment.id}
                  student={payment.student ?? payment.studentName ?? '—'}
                  class={payment.class ?? payment.className ?? '—'}
                  period={payment.period ?? payment.periodLabel ?? '—'}
                  plan={payment.plan ?? payment.subscriptionPlan ?? '—'}
                  amount={amount > 0 ? `${amount.toLocaleString('fr-FR')} F` : '—'}
                  mode={payment.mode ?? payment.paymentMethod ?? 'Espèces'}
                  status={payment.status ?? 'En attente'}
                  paid={paid != null && paid > 0 ? `${paid.toLocaleString('fr-FR')} F` : undefined}
                />
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function FinanceCard({ title, value, change, trend, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center space-x-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
          trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
          trend === 'down' ? 'bg-red-50 text-red-600' :
          'bg-gray-50 text-gray-400'
        }`}>
          <span>{change}</span>
        </div>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
    </div>
  );
}

function PaymentRow({ student, class: className, period, plan, amount, mode, status, paid }: any) {
  const statusStyles: any = {
    'Payé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Partiel': 'bg-blue-50 text-blue-600 border-blue-100',
    'Retard': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En attente'];

  const modeIcon = (m: string) => {
    const lower = (m ?? '').toLowerCase();
    if (lower.includes('mobile')) return <Smartphone className="w-3.5 h-3.5" />;
    if (lower.includes('espèce') || lower.includes('cash')) return <Wallet className="w-3.5 h-3.5" />;
    if (lower.includes('carte') || lower.includes('virement') || lower.includes('card')) return <CreditCard className="w-3.5 h-3.5" />;
    return <DollarSign className="w-3.5 h-3.5" />;
  };

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-xs group-hover:bg-white transition-colors">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[10px] font-bold text-navy-500 uppercase tracking-tighter">{className}</span>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{period}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-xs font-black text-navy-900 uppercase tracking-wider bg-navy-50 px-3 py-1 rounded-lg w-fit border border-navy-100">{plan}</p>
      </td>
      <td className="px-8 py-6">
        <p className="text-sm font-black text-navy-900">{amount}</p>
        {paid && <p className="text-[10px] text-blue-600 font-bold mt-0.5 italic">Payé: {paid}</p>}
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2 text-gray-500">
          {modeIcon(mode)}
          <p className="text-xs font-medium">{mode}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${statusStyle}`}>
          {status}
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><ArrowUpRight className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><Download className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}
