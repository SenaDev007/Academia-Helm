'use client';

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
