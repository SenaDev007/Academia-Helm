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

interface PaymentsData {
  payments: Array<{
    id: string; school: string; amount: number; method: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING'; date: string; reference: string | null;
  }>;
}

export default function PlatformPaymentsWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<PaymentsData>('/payments');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paiements & Transactions</h1>
        <p className="text-slate-500">Historique des paiements de la plateforme</p>
      </div>

      {loading ? <PlatformLoading label="Chargement des paiements…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.payments.length === 0 ? <PlatformEmpty title="Aucun paiement" /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Méthode</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{p.school}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4 text-xs text-slate-700 uppercase">{p.method}</td>
                    <td className="px-6 py-4">
                      {p.status === 'SUCCESS' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Succès</span>
                      ) : p.status === 'FAILED' ? (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Échec</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
