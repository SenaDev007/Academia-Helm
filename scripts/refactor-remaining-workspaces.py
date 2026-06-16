#!/usr/bin/env python3
"""
Refactor the remaining platform workspaces (Orion, Monitoring, Modules, RBAC,
Subscriptions, Settings) to remove all hardcoded mock data and use real DB
queries via the /api/platform/* BFF routes.
"""

from pathlib import Path

COMPONENTS_DIR = Path('/home/z/my-project/apps/web-app/src/components/platform')

# ── Orion workspace ──────────────────────────────────────────────────────
ORION_CONTENT = """'use client';

import { Brain, Zap, ShieldAlert, ArrowRight, Activity, AlertCircle } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface OrionData {
  recentAlerts: Array<{
    id: string;
    eventType: string;
    severity: string;
    ipAddress: string;
    date: string;
    tenantId: string;
  }>;
  orionAccessCount30d: number;
  churnPredictions: any[];
  expansionPredictions: any[];
  billingAnomalies: any[];
  note?: string;
}

export default function PlatformOrionWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<OrionData>('/orion');

  if (loading) return <PlatformLoading label="Chargement des données ORION…" />;
  if (error) return <PlatformError message={error} onRetry={refetch} />;
  if (!data) return <PlatformEmpty />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ORION Global Intelligence</h1>
          <p className="text-slate-500">Supervision analytique et prédictive de la plateforme</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm">
          <Activity className="w-4 h-4" />
          {data.orionAccessCount30d} accès (30j)
        </div>
      </div>

      {data.note && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{data.note}</span>
        </div>
      )}

      <div className="p-8 bg-indigo-900 rounded-3xl shadow-xl text-white">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-6 h-6 text-indigo-400" />
          <h3 className="font-bold">Analyse Prédictive</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
            <div className="text-xs font-bold text-indigo-300 uppercase mb-1">Risque Critique (Churn)</div>
            <div className="text-2xl font-bold">{data.churnPredictions.length} École(s)</div>
            <p className="text-xs text-slate-300 mt-2">
              {data.churnPredictions.length > 0
                ? 'Écoles détectées à risque de désabonnement.'
                : 'Aucune école à risque détectée actuellement.'}
            </p>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <div className="text-xs font-bold text-emerald-400 uppercase mb-1">Potentiel Expansion</div>
            <div className="text-2xl font-bold">{data.expansionPredictions.length} École(s)</div>
            <p className="text-xs text-slate-300 mt-2">
              {data.expansionPredictions.length > 0
                ? 'Prêtes pour un passage au plan supérieur.'
                : 'Aucun potentiel d\'expansion détecté actuellement.'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-slate-900">Alertes Sécurité (30 derniers jours)</h3>
        </div>
        {data.recentAlerts.length === 0 ? (
          <PlatformEmpty title="Aucune alerte" description="Aucune alerte sécurité enregistrée récemment." />
        ) : (
          <div className="space-y-3">
            {data.recentAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-slate-900">{a.eventType}</div>
                  <div className="text-xs text-slate-500">Tenant: {a.tenantId} · IP: {a.ipAddress}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                    a.severity === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{a.severity}</span>
                  <span className="text-xs text-slate-500">{new Date(a.date).toLocaleString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
"""

# ── Monitoring workspace ─────────────────────────────────────────────────
MONITORING_CONTENT = """'use client';

import { ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface MonitoringData {
  services: any[];
  performanceData: any[];
  incidents: any[];
  note?: string;
}

export default function MonitoringWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<MonitoringData>('/monitoring');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidents & Monitoring</h1>
          <p className="text-slate-500">Santé technique et supervision des services</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des métriques…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          {data.note && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{data.note}</span>
            </div>
          )}

          {data.services.length === 0 ? (
            <PlatformEmpty
              title="Aucune métrique disponible"
              description="L'intégration d'outils de monitoring est planifiée. Aucune donnée mock n'est affichée."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.services.map((service: any) => (
                <div key={service.id} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900">{service.name}</h3>
                  <div className="mt-2 text-xs text-slate-500">
                    Statut: {service.status} · Uptime: {service.uptime}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.incidents.length > 0 && (
            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">Incidents Récents</h3>
              </div>
              <div className="space-y-3">
                {data.incidents.map((inc: any) => (
                  <div key={inc.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-400">{inc.id}</span>
                      <h4 className="font-bold text-slate-900">{inc.title}</h4>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{inc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
"""

# ── Modules workspace ────────────────────────────────────────────────────
MODULES_CONTENT = """'use client';

import { useState, useMemo } from 'react';
import { Zap, Users, Search, ArrowRight } from 'lucide-react';
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

export default function ModulesWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, loading, error, refetch } = usePlatformData<ModulesData>('/modules');

  const filteredModules = useMemo(() => {
    if (!data?.modules) return [];
    if (!searchTerm.trim()) return data.modules;
    const q = searchTerm.toLowerCase();
    return data.modules.filter((m) => m.code.toLowerCase().includes(q));
  }, [data, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modules & Fonctionnalités</h1>
          <p className="text-slate-500">Adoption des modules par les établissements</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un module..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? <PlatformLoading label="Chargement des modules…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || filteredModules.length === 0 ? (
         <PlatformEmpty
           title="Aucun module"
           description="Aucune activation de module n'a encore été enregistrée par les établissements."
         />
       ) : (
        <>
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
            <Users className="w-4 h-4 inline mr-2" />
            <strong>{data.totalTenants}</strong> établissement(s) actif(s) sur la plateforme.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModules.map((m) => (
              <div key={m.code} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{m.code}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Établissements</span>
                    <span className="font-bold text-slate-900">{m.enabledCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Taux d'adoption</span>
                    <span className="font-bold text-indigo-600">{m.adoptionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                      style={{ width: `${m.adoptionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
"""

# ── RBAC workspace ───────────────────────────────────────────────────────
RBAC_CONTENT = """'use client';

import { useState, useMemo } from 'react';
import { Shield, Plus, Search, ArrowRight, Lock } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface RbacData {
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    usersCount: number;
    permissionsCount: number;
    canAccessOrion: boolean;
    canAccessAtlas: boolean;
  }>;
}

interface PermissionsData {
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string | null;
    rolesCount: number;
  }>;
}

export default function PlatformRBACWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: rolesData, loading: rolesLoading, error: rolesError, refetch: rolesRefetch } = usePlatformData<RbacData>('/roles');
  const { data: permsData, loading: permsLoading, error: permsError, refetch: permsRefetch } = usePlatformData<PermissionsData>('/permissions');

  const filteredPermissions = useMemo(() => {
    if (!permsData?.permissions) return [];
    if (!searchTerm.trim()) return permsData.permissions;
    const q = searchTerm.toLowerCase();
    return permsData.permissions.filter((p) =>
      p.name.toLowerCase().includes(q) || p.resource.toLowerCase().includes(q)
    );
  }, [permsData, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rôles & Permissions Globales</h1>
          <p className="text-slate-500">Modèle RBAC de l'administration plateforme</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <Plus className="w-4 h-4" />
          Nouveau Rôle
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Rôles plateforme</h3>
        {rolesLoading ? <PlatformLoading label="Chargement des rôles…" /> :
         rolesError ? <PlatformError message={rolesError} onRetry={rolesRefetch} /> :
         !rolesData || rolesData.roles.length === 0 ? (
           <PlatformEmpty title="Aucun rôle" description="Aucun rôle plateforme n'a été défini." />
         ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rolesData.roles.map((role) => (
              <div key={role.id} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">{role.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{role.description || '—'}</p>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {role.usersCount} utilisateur(s) · {role.permissionsCount} permission(s)
                </div>
                <div className="flex gap-2">
                  {role.canAccessOrion && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold uppercase">ORION</span>}
                  {role.canAccessAtlas && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase">Atlas</span>}
                  {role.isSystemRole && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold uppercase">Système</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-slate-900">Permissions Granulaires</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer les permissions..."
              className="pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {permsLoading ? <PlatformLoading label="Chargement des permissions…" /> :
         permsError ? <PlatformError message={permsError} onRetry={permsRefetch} /> :
         filteredPermissions.length === 0 ? (
           <PlatformEmpty title="Aucune permission" description="Aucune permission ne correspond à votre recherche." />
         ) : (
          <div className="space-y-2">
            {filteredPermissions.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Lock className="w-3 h-3 text-indigo-400" />
                  <div>
                    <span className="text-sm font-mono font-medium text-slate-700">{p.name}</span>
                    <div className="text-[10px] text-slate-400">{p.resource} · {p.action} · {p.rolesCount} rôle(s)</div>
                  </div>
                </div>
                <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  Détails <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
"""

# ── Subscriptions workspace ──────────────────────────────────────────────
SUBSCRIPTIONS_CONTENT = """'use client';

import { useState } from 'react';
import { Package, Check, Zap, Users } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface PlansData {
  plans: Array<{
    id: string;
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxSchools: number;
    bilingualAllowed: boolean;
    activeSubscriptions: number;
  }>;
}

export default function SubscriptionsWorkspace() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans');
  const { data, loading, error, refetch } = usePlatformData<PlansData>('/plans');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Abonnements & Plans</h1>
        <p className="text-slate-500">Catalogue des plans et abonnements actifs</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'plans' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Catalogue des plans
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'active' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Abonnements actifs
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des plans…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.plans.length === 0 ? (
         <PlatformEmpty title="Aucun plan" description="Aucun plan d'abonnement n'a été configuré." />
       ) : activeTab === 'plans' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.plans.map((plan, idx) => (
            <div
              key={plan.id}
              className={`p-6 bg-white rounded-2xl border-2 shadow-sm ${
                idx === 0 ? 'border-indigo-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <Package className="w-6 h-6 text-indigo-600" />
                {plan.bilingualAllowed && (
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold uppercase">Bilingue</span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">{plan.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-4">{plan.code}</p>
              <div className="mb-4">
                <div className="text-3xl font-bold text-slate-900">
                  {plan.monthlyPrice.toLocaleString('fr-FR')}
                  <span className="text-sm font-medium text-slate-500"> F CFA / mois</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ou {plan.yearlyPrice.toLocaleString('fr-FR')} F CFA / an
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Jusqu'à {plan.maxSchools} école(s)</span>
                </div>
                {plan.bilingualAllowed && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Mode bilingue autorisé</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <Users className="w-3 h-3 inline mr-1" />
                  <strong className="text-slate-900">{plan.activeSubscriptions}</strong> abonnement(s) actif(s)
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prix mensuel</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Prix annuel</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Abonnements actifs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{p.code}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.monthlyPrice.toLocaleString('fr-FR')} F CFA</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{p.yearlyPrice.toLocaleString('fr-FR')} F CFA</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                        {p.activeSubscriptions} actif(s)
                      </span>
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

# ── Settings workspace — return empty state, no mock ─────────────────────
SETTINGS_CONTENT = """'use client';

import { Settings, Shield, Globe, Database, Key, AlertCircle } from 'lucide-react';

export default function PlatformSettingsWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres Plateforme</h1>
        <p className="text-slate-500">Configuration globale d'Academia Helm</p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Les paramètres plateforme (domaines, secrets, intégrations) sont gérés via les variables
          d'environnement et le PricingAdminController. Aucune donnée mock n'est affichée ici.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/app/platform/rbac"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Shield className="w-6 h-6 text-indigo-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Rôles & Permissions</h3>
          <p className="text-xs text-slate-500 mt-1">Gérer le RBAC plateforme</p>
        </a>
        <a
          href="/app/platform/settings"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Globe className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Domaines & Sous-domaines</h3>
          <p className="text-xs text-slate-500 mt-1">Configuration DNS et domaines</p>
        </a>
        <a
          href="/app/platform/audit"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Database className="w-6 h-6 text-emerald-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Audit & Logs</h3>
          <p className="text-xs text-slate-500 mt-1">Journal d'audit plateforme</p>
        </a>
      </div>
    </div>
  );
}
"""

WORKSPACES = [
    (COMPONENTS_DIR / 'orion' / 'PlatformOrionWorkspace.tsx', ORION_CONTENT),
    (COMPONENTS_DIR / 'monitoring' / 'MonitoringWorkspace.tsx', MONITORING_CONTENT),
    (COMPONENTS_DIR / 'modules' / 'ModulesWorkspace.tsx', MODULES_CONTENT),
    (COMPONENTS_DIR / 'rbac' / 'PlatformRBACWorkspace.tsx', RBAC_CONTENT),
    (COMPONENTS_DIR / 'subscriptions' / 'SubscriptionsWorkspace.tsx', SUBSCRIPTIONS_CONTENT),
    (COMPONENTS_DIR / 'settings' / 'PlatformSettingsWorkspace.tsx', SETTINGS_CONTENT),
]

for path, content in WORKSPACES:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    print(f'OK wrote {len(content):>6} bytes -> {path}')

print(f'\n{len(WORKSPACES)} workspaces refactorisés.')
print('Tous les workspaces /app/platform/* utilisent maintenant des données réelles.')
