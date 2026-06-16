'use client';

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
                : "Aucun potentiel d'expansion détecté actuellement."}
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
