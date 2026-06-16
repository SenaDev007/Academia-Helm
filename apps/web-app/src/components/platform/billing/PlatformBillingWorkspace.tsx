'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  FileText,
  DollarSign,
  Download,
  Filter,
  ShieldAlert,
  History,
  Users,
  HelpCircle,
  CreditCard,
  PieChart,
  Building,
  LayoutDashboard,
  Briefcase,
  Zap,
  BarChart3,
  Lock,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface BillingData {
  summary: { monthlyRevenue: number; pendingPayments: number; todayCollections: number; currency: string };
  invoices: Array<{
    id: string; school: string; amount: number; currency: string;
    status: string; date: string; paidAt: string | null; period: string;
  }>;
}

export default function PlatformBillingWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<BillingData>('/invoices');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Facturation SaaS</h1>
        <p className="text-slate-500">Factures et encaissements de la plateforme</p>
      </div>

      {loading ? <PlatformLoading label="Chargement des factures…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">CA mensuel</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.monthlyRevenue)}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Paiements en attente</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.pendingPayments)}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Encaissements du jour</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.todayCollections)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {data.invoices.length === 0 ? <PlatformEmpty title="Aucune facture" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Période</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{inv.school}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.amount)}</td>
                        <td className="px-6 py-4 text-xs text-slate-600">{inv.period}</td>
                        <td className="px-6 py-4">
                          {inv.status === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
