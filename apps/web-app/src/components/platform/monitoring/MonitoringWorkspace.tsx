'use client';

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
