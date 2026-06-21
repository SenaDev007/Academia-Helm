'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Zap,
  Users,
  Search,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface ModulesData {
  totalTenants: number;
  modules: Array<{
    code: string;
    enabledCount: number;
    adoptionRate: number;
  }>;
}

interface TenantLite {
  id: string;
  name: string;
  slug: string;
}

interface TenantsList {
  tenants: TenantLite[];
  total: number;
}

export default function ModulesWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<ModulesData>('/modules');
  const {
    data: tenantsData,
    loading: tenantsLoading,
    error: tenantsError,
  } = usePlatformData<TenantsList>('/tenants?limit=100');

  // Tenant selector + per-tenant module toggle state
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantModules, setTenantModules] = useState<Record<string, Record<string, boolean>>>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const tenants = tenantsData?.tenants || [];

  // Auto-select first tenant when the list loads
  useEffect(() => {
    if (!selectedTenantId && tenants.length > 0) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [tenants, selectedTenantId]);

  const filteredModules = useMemo(() => {
    if (!data?.modules) return [];
    if (!searchTerm.trim()) return data.modules;
    const q = searchTerm.toLowerCase();
    return data.modules.filter((m) => m.code.toLowerCase().includes(q));
  }, [data, searchTerm]);

  const isEnabled = useCallback(
    (code: string) => !!tenantModules[selectedTenantId]?.[code],
    [tenantModules, selectedTenantId],
  );

  const handleToggle = useCallback(async (moduleCode: string, enabled: boolean) => {
    if (!selectedTenantId) {
      setToggleError('Veuillez sélectionner un établissement.');
      return;
    }
    setToggling(moduleCode);
    setToggleError(null);
    // Optimistic update
    setTenantModules((prev) => ({
      ...prev,
      [selectedTenantId]: {
        ...(prev[selectedTenantId] || {}),
        [moduleCode]: enabled,
      },
    }));
    try {
      const res = await fetch(`/api/platform/modules/${moduleCode}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenantId, enabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || `Erreur ${res.status}`);
      }
      // Refresh aggregate adoption stats
      refetch();
    } catch (err: unknown) {
      // Revert optimistic update
      setTenantModules((prev) => ({
        ...prev,
        [selectedTenantId]: {
          ...(prev[selectedTenantId] || {}),
          [moduleCode]: !enabled,
        },
      }));
      const msg = err instanceof Error ? err.message : 'Erreur lors du basculement';
      setToggleError(msg);
    } finally {
      setToggling(null);
    }
  }, [selectedTenantId, refetch]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Modules & Fonctionnalités</h1>
          <p className="text-slate-500">Adoption des modules par les établissements</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un module..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 transition-all w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tenant selector */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Établissement sélectionné</p>
            {selectedTenant ? (
              <p className="text-sm font-bold text-slate-900">
                {selectedTenant.name}{' '}
                <span className="font-mono text-xs text-slate-400">({selectedTenant.slug})</span>
              </p>
            ) : tenantsLoading ? (
              <p className="text-sm text-slate-400 inline-flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
              </p>
            ) : (
              <p className="text-sm text-slate-400">Aucun établissement</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Activer pour :</label>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            disabled={tenantsLoading || tenants.length === 0}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 min-w-[240px] disabled:opacity-50"
          >
            {tenantsLoading && <option value="">Chargement…</option>}
            {!tenantsLoading && tenants.length === 0 && <option value="">Aucun établissement</option>}
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {toggleError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{toggleError}</span>
        </div>
      )}

      {tenantsError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Impossible de charger la liste des établissements : {tenantsError}</span>
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des modules…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || filteredModules.length === 0 ? (
         <PlatformEmpty
           title="Aucun module"
           description="Aucune activation de module n'a encore été enregistrée par les établissements."
         />
       ) : (
        <>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Users className="w-4 h-4 inline mr-2" />
            <strong>{data.totalTenants}</strong> établissement(s) actif(s) sur la plateforme.
            {selectedTenant && (
              <> Activez ou désactivez les modules ci-dessous pour <strong>{selectedTenant.name}</strong>.</>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModules.map((m) => {
              const enabled = isEnabled(m.code);
              const isToggling = toggling === m.code;
              return (
                <div key={m.code} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{m.code}</h3>
                        <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {enabled ? <><Check className="w-3 h-3" /> Activé</> : <><X className="w-3 h-3" /> Désactivé</>}
                        </span>
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleToggle(m.code, !enabled)}
                      disabled={isToggling || !selectedTenantId}
                      title={enabled ? 'Désactiver pour cet établissement' : 'Activer pour cet établissement'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        enabled ? 'bg-amber-500' : 'bg-slate-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 absolute left-1 text-white/80 animate-spin" />
                      ) : (
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      )}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Établissements</span>
                      <span className="font-bold text-slate-900">{m.enabledCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Taux d'adoption</span>
                      <span className="font-bold text-amber-700">{m.adoptionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                        style={{ width: `${m.adoptionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
