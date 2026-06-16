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
import { PlatformLoading, PlatformError, PlatformEmpty } from './PlatformStates';

interface SupportData {
  summary: { open: number; inProgress: number; urgent: number; resolved24h: number };
  tickets: Array<{
    id: string; school: string; subject: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    date: string;
  }>;
  note?: string;
}

export default function PlatformSupportWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<SupportData>('/support/tickets');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support & Tickets</h1>
        <p className="text-slate-500">Tickets de support des écoles</p>
      </div>

      {loading ? <PlatformLoading label="Chargement des tickets…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><HelpCircle className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Ouverts</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.open}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">En cours</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.inProgress}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Urgents</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.urgent}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Résolus 24h</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.resolved24h}</div>
            </div>
          </div>

          {data.note && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
              {data.note}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {data.tickets.length === 0 ? <PlatformEmpty title="Aucun ticket" description="Aucun ticket de support n'a encore été créé." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Sujet</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Priorité</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{t.id}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{t.school}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{t.subject}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            t.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                            t.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            t.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>{t.priority}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                            t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>{t.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
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
