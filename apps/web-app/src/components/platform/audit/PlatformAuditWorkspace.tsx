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

interface AuditData {
  logs: Array<{
    id: string; user: string; action: string; target: string;
    date: string; ip: string; tenantId: string;
  }>;
  total: number; page: number; limit: number;
}

export default function PlatformAuditWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<AuditData>('/audit-logs?limit=100');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit & Logs</h1>
        <p className="text-slate-500">Journal d'audit cross-tenant de la plateforme</p>
      </div>

      {loading ? <PlatformLoading label="Chargement des logs…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.logs.length === 0 ? <PlatformEmpty title="Aucun log" description="Aucune entrée d'audit n'a été enregistrée." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
            {data.total} entrée(s) au total — affichage des {data.logs.length} plus récentes
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Utilisateur</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Action</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cible</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{l.user}</td>
                    <td className="px-6 py-4 text-xs font-mono text-indigo-600">{l.action}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{l.target}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{new Date(l.date).toLocaleString('fr-FR')}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{l.ip}</td>
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
