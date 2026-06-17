#!/usr/bin/env python3
"""
Refactor 8 platform workspace components to replace mock data with real DB queries.

Each workspace currently has a `MOCK_*` constant and renders it directly.
We rewrite each to use `usePlatformData<T>('/<endpoint>')` hook + loading/error states.

Strategy: read each file, replace with a brand-new self-contained component that
preserves the original UI shell (header, summary cards, table structure) but
sources data from the API.
"""

import os
from pathlib import Path

COMPONENTS_DIR = Path('/home/z/my-project/apps/web-app/src/components/platform')

# ── Reusable imports header ──────────────────────────────────────────────
SHARED_IMPORTS = """'use client';

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
"""

# ── 1. PlatformDashboard.tsx ────────────────────────────────────────────
DASHBOARD_CONTENT = SHARED_IMPORTS + """
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
"""

# ── 2. TenantsWorkspace.tsx ─────────────────────────────────────────────
TENANTS_CONTENT = SHARED_IMPORTS + """
interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  country: string;
  city: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  students: number;
  lastActivity: string;
  expiration: string | null;
  createdAt: string;
}

interface TenantsData {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}

export default function TenantsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { data, loading, error, refetch } = usePlatformData<TenantsData>(
    `/tenants?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Écoles / Tenants</h1>
          <p className="text-slate-500">Gestion des établissements inscrits sur la plateforme</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une école..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="TRIAL">Essai</option>
            <option value="SUSPENDED">Suspendus</option>
          </select>
        </div>
      </div>

      {loading ? <PlatformLoading label="Chargement des écoles…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.tenants.length === 0 ? <PlatformEmpty title="Aucune école" description="Aucun établissement ne correspond à votre recherche." /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
            {data.total} établissement(s) au total
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Pays / Ville</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Élèves</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Expiration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">{t.country}</div>
                      <div className="text-xs text-slate-400">{t.city}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-indigo-600 uppercase">{t.plan}</span>
                    </td>
                    <td className="px-6 py-4">
                      {t.status === 'ACTIVE' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Actif</span>
                      ) : t.status === 'TRIAL' ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Essai</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Suspendu</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{t.students}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {t.expiration ? new Date(t.expiration).toLocaleDateString('fr-FR') : '—'}
                    </td>
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
"""

# ── 3. InitialSubscriptionsWorkspace.tsx ─────────────────────────────────
INITIAL_SUBS_CONTENT = SHARED_IMPORTS + """
interface InitialSubData {
  summary: { paidThisMonth: number; pending: number; invoicedTotal: number; currency: string };
  items: Array<{
    id: string; schoolName: string; amount: number; currency: string;
    status: 'PAID' | 'PENDING' | 'PARTIAL' | 'FAILED';
    issuedAt: string; paidAt: string | null; reference: string;
  }>;
}

export default function InitialSubscriptionsWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<InitialSubData>('/initial-subscriptions');

  const items = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const q = searchTerm.toLowerCase();
    return data.items.filter((i) => i.schoolName.toLowerCase().includes(q) || i.reference.toLowerCase().includes(q));
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Souscriptions Initiales</h1>
          <p className="text-slate-500">Frais d'activation et d'entrée des écoles</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une école..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? <PlatformLoading label="Chargement des souscriptions…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Payées ce mois</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.paidThisMonth)}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Total encaissé</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">En attente</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.pending)}</div>
              <p className="text-xs text-amber-600 font-medium mt-1">{data.items.filter((i) => i.status === 'PENDING').length} dossier(s) à valider</p>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-slate-500">Factures émises</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.summary.invoicedTotal)}</div>
              <p className="text-xs text-blue-600 font-medium mt-1">Total période</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {items.length === 0 ? <PlatformEmpty title="Aucune souscription" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dates</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{sub.schoolName}</div>
                          <div className="text-xs text-slate-500 font-mono">Ref: {sub.reference}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(sub.amount)}</div>
                          <div className="text-[10px] text-slate-400">TTC</div>
                        </td>
                        <td className="px-6 py-4">
                          {sub.status === 'PAID' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Payée</span>
                          ) : sub.status === 'PARTIAL' ? (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">Partiel</span>
                          ) : sub.status === 'FAILED' ? (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">Échec</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">En attente</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600">Émise: {new Date(sub.issuedAt).toLocaleDateString('fr-FR')}</div>
                          {sub.paidAt && <div className="text-[10px] text-emerald-600 mt-0.5">Payée: {new Date(sub.paidAt).toLocaleDateString('fr-FR')}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-emerald-600" title="Enregistrer paiement">
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600" title="Télécharger facture">
                              <Download className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-600" title="Plus d'actions">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
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
"""

# ── 4. PlatformBillingWorkspace.tsx ─────────────────────────────────────
BILLING_CONTENT = SHARED_IMPORTS + """
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
"""

# ── 5. PlatformPaymentsWorkspace.tsx ────────────────────────────────────
PAYMENTS_CONTENT = SHARED_IMPORTS + """
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
"""

# ── 6. PlatformUsersWorkspace.tsx ───────────────────────────────────────
USERS_CONTENT = SHARED_IMPORTS + """
interface UsersData {
  users: Array<{
    id: string; name: string; email: string; role: string;
    status: 'ACTIVE' | 'INACTIVE'; lastLogin: string | null; createdAt: string;
  }>;
}

export default function PlatformUsersWorkspace() {
  const [roleFilter, setRoleFilter] = useState('ALL');
  const { data, loading, error, refetch } = usePlatformData<UsersData>(`/users?role=${roleFilter}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilisateurs Plateforme</h1>
          <p className="text-slate-500">Comptes avec accès au back-office global</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="ALL">Tous rôles</option>
          <option value="PLATFORM_OWNER">Platform Owner</option>
          <option value="PLATFORM_SUPER_ADMIN">Super Admin</option>
          <option value="PLATFORM_ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin (système)</option>
        </select>
      </div>

      {loading ? <PlatformLoading label="Chargement des utilisateurs…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.users.length === 0 ? <PlatformEmpty title="Aucun utilisateur" /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nom</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rôle</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dernière connexion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase">{u.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      {u.status === 'ACTIVE' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Actif</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">Inactif</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
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
"""

# ── 7. PlatformSupportWorkspace.tsx ─────────────────────────────────────
SUPPORT_CONTENT = SHARED_IMPORTS + """
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
"""

# ── 8. PlatformAuditWorkspace.tsx ───────────────────────────────────────
AUDIT_CONTENT = SHARED_IMPORTS + """
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
"""

# ── Écriture des fichiers ───────────────────────────────────────────────
WORKSPACES = [
    (COMPONENTS_DIR / 'PlatformDashboard.tsx', DASHBOARD_CONTENT),
    (COMPONENTS_DIR / 'tenants' / 'TenantsWorkspace.tsx', TENANTS_CONTENT),
    (COMPONENTS_DIR / 'billing' / 'InitialSubscriptionsWorkspace.tsx', INITIAL_SUBS_CONTENT),
    (COMPONENTS_DIR / 'billing' / 'PlatformBillingWorkspace.tsx', BILLING_CONTENT),
    (COMPONENTS_DIR / 'billing' / 'PlatformPaymentsWorkspace.tsx', PAYMENTS_CONTENT),
    (COMPONENTS_DIR / 'users' / 'PlatformUsersWorkspace.tsx', USERS_CONTENT),
    (COMPONENTS_DIR / 'support' / 'PlatformSupportWorkspace.tsx', SUPPORT_CONTENT),
    (COMPONENTS_DIR / 'audit' / 'PlatformAuditWorkspace.tsx', AUDIT_CONTENT),
]

for path, content in WORKSPACES:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    print(f'OK wrote {len(content):>6} bytes → {path}')

print(f'\n{len(WORKSPACES)} workspaces refactorisés avec données réelles (plus de mock).')
