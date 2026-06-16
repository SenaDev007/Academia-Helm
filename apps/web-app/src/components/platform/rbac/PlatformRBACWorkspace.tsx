'use client';

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
