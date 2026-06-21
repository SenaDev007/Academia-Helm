'use client';

import { ShieldAlert, RefreshCw, CheckCircle2, XCircle, Activity, Database, Users, GraduationCap, UserCheck } from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface MonitoringData {
  services: Array<{ name: string; status: string; latency: number }>;
  stats: {
    totalTenants: number;
    totalUsers: number;
    totalStudents: number;
    totalStaff: number;
    uptime: string;
  };
  incidents: any[];
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
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 rounded-xl text-sm font-semibold text-white hover:bg-blue-800 transition-all shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {loading ? <PlatformLoading label="Chargement des métriques…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          {/* Stats globales */}
          {data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="w-4 h-4 text-blue-900" />
                  <span className="text-xs text-slate-500 font-medium">Écoles</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{data.stats.totalTenants}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-900" />
                  <span className="text-xs text-slate-500 font-medium">Utilisateurs</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{data.stats.totalUsers}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-blue-900" />
                  <span className="text-xs text-slate-500 font-medium">Personnel</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{data.stats.totalStaff}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-slate-500 font-medium">Uptime</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{data.stats.uptime}</p>
              </div>
            </div>
          )}

          {/* Services */}
          <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-blue-900" />
              <h3 className="font-bold text-slate-900">État des services</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.services.map((service, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{service.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Latence: {service.latency}ms</p>
                  </div>
                  {service.status === 'OPERATIONAL' ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">
                      <XCircle className="w-3 h-3" />
                      DOWN
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Incidents */}
          {data.incidents && data.incidents.length > 0 && (
            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">Incidents Récents</h3>
              </div>
              <div className="space-y-3">
                {data.incidents.map((inc: any, idx: number) => (
                  <div key={inc.id || idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div>
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

          {(!data.incidents || data.incidents.length === 0) && (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-700">Aucun incident en cours</p>
              <p className="text-xs text-emerald-600 mt-1">Tous les services sont opérationnels.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
