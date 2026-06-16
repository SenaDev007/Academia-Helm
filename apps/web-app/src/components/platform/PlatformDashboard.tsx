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

interface DashboardData {
  stats: {
    totalTenants: number;
    activeTenants: number;
    totalStudents: number;
    totalUsers: number;
    mrr: number;
    criticalIncidents: number;
  };
  revenueTrend: Array<{ name: string; revenue: number }>;
  tenantGrowthTrend: Array<{ name: string; schools: number }>;
  alerts: Array<{ title: string; text: string; level: string }>;
  recentTenants: Array<{ id: string; name: string; slug: string; country: string; createdAt: string }>;
}

export default function PlatformDashboard() {
  const { data, loading, error, refetch } = usePlatformData<DashboardData>('/dashboard');

  if (loading) return <PlatformLoading label="Chargement du tableau de bord global…" />;
  if (error) return <PlatformError message={error} onRetry={refetch} />;
  if (!data) return <PlatformEmpty title="Aucune donnée" description="Le tableau de bord est vide pour le moment." />;

  const stats = [
    { label: 'Écoles inscrites', value: data.stats.totalTenants, icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Écoles actives', value: data.stats.activeTenants, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Élèves', value: data.stats.totalStudents.toLocaleString('fr-FR'), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Utilisateurs total', value: data.stats.totalUsers, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'MRR (F CFA)', value: formatCurrency(data.stats.mrr), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Incidents critiques', value: data.stats.criticalIncidents, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const maxRevenue = Math.max(...data.revenueTrend.map((r) => r.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord Global</h1>
        <p className="text-slate-500">Vue agrégée de toute la plateforme Academia Helm</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className={`p-2 ${s.bg} ${s.color} rounded-lg w-fit mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Tendance Revenus (6 mois)</h3>
          {data.revenueTrend.length === 0 ? (
            <PlatformEmpty title="Aucune donnée" description="Pas encore de revenus enregistrés." />
          ) : (
            <div className="space-y-2">
              {data.revenueTrend.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 w-12">{r.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-24 text-right">{formatCurrency(r.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Croissance Écoles (6 mois)</h3>
          {data.tenantGrowthTrend.length === 0 ? (
            <PlatformEmpty title="Aucune donnée" description="Pas encore d'écoles enregistrées." />
          ) : (
            <div className="space-y-2">
              {data.tenantGrowthTrend.map((g, i) => {
                const max = Math.max(...data.tenantGrowthTrend.map((x) => x.schools), 1);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 w-12">{g.name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full" style={{ width: `${(g.schools / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-24 text-right">{g.schools} école(s)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Alertes ORION</h3>
          <div className="space-y-2">
            {data.alerts.map((a, i) => (
              <div key={i} className={`p-3 rounded-xl border flex items-start gap-3 ${
                a.level === 'CRITIQUE' ? 'bg-rose-50 border-rose-200' :
                a.level === 'ATTENTION' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <ShieldAlert className={`w-4 h-4 mt-0.5 ${
                  a.level === 'CRITIQUE' ? 'text-rose-500' :
                  a.level === 'ATTENTION' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div>
                  <p className="text-xs font-bold text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-600">{a.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Écoles récemment inscrites</h3>
        </div>
        {data.recentTenants.length === 0 ? (
          <PlatformEmpty title="Aucune école" description="Aucune école inscrite pour le moment." />
        ) : (
          <div className="divide-y divide-slate-50">
            {data.recentTenants.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.slug} · {t.country}</p>
                </div>
                <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
