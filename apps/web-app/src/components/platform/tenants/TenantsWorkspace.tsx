'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, refetch } = usePlatformData<TenantsData>(
    `/tenants?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`,
  );

  const handleToggleStatus = useCallback(async (tenantId: string, currentStatus: string) => {
    setActionLoading(tenantId);
    setActionError(null);
    try {
      const newStatus = currentStatus === 'SUSPENDED' ? 'active' : 'suspended';
      const res = await fetch(`/api/platform/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de la modification du statut');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

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

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
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
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(t.id, t.status)}
                        disabled={actionLoading === t.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          t.status === 'SUSPENDED'
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        } disabled:opacity-50`}
                        title={t.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                      >
                        {actionLoading === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : t.status === 'SUSPENDED' ? (
                          <><Play className="w-3.5 h-3.5" /> Réactiver</>
                        ) : (
                          <><Pause className="w-3.5 h-3.5" /> Suspendre</>
                        )}
                      </button>
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
