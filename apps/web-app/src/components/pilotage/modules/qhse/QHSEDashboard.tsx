/**
 * ============================================================================
 * QHSE DASHBOARD (Standardisé)
 * ============================================================================
 */

'use client';

import { ShieldCheck, AlertTriangle, Activity, CheckCircle2, TrendingUp, TrendingDown, Clock, MapPin, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface QHSEStats {
  openIncidents?: number;
  resolvedIncidents?: number;
  pendingAudits?: number;
  complianceRate?: number;
  recentIncidents?: Array<{ id: string | number; type: string; gravity: string; location: string; time: string; status: string }>;
  alerts?: Array<{ id?: string; type?: string; title?: string; desc?: string; time?: string }>;
}

const DEFAULT_STATS: QHSEStats = {
  openIncidents: 0,
  resolvedIncidents: 0,
  pendingAudits: 0,
  complianceRate: 0,
  recentIncidents: [],
  alerts: [],
};

export default function QHSEDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<QHSEStats>('qhse', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };
  const complianceRate = Math.min(Math.max(stats.complianceRate ?? 0, 0), 100);

  const kpiCards = [
    { label: 'Incidents Ouverts', value: String(stats.openIncidents ?? 0), trend: '+2', trendType: 'up', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Incidents Résolus', value: String(stats.resolvedIncidents ?? 0), trend: '-1', trendType: 'down', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Audits en Cours', value: String(stats.pendingAudits ?? 0), trend: 'Non-conformités: 5', trendType: 'neutral', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Taux de Conformité', value: `${complianceRate}%`, trend: '65% complété', trendType: 'positive', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                {stat.trendType === 'up' ? <TrendingUp className="w-4 h-4 text-rose-500" /> : stat.trendType === 'down' ? <TrendingDown className="w-4 h-4 text-emerald-500" /> : null}
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-slate-400">{stat.label}</h4>
              <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
              <p className={`text-xs font-medium ${stat.trendType === 'up' ? 'text-rose-500' : stat.trendType === 'down' ? 'text-emerald-500' : 'text-slate-400'}`}>
                {stat.trend}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Incidents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Incidents Récents</h3>
            <Button variant="link" className="text-emerald-600 h-auto p-0">Voir Registre</Button>
          </div>
          <Card className="shadow-sm overflow-hidden">
            {(stats.recentIncidents?.length ? stats.recentIncidents : []).map((incident) => (
              <div key={incident.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    incident.gravity === 'URGENCE' ? 'bg-rose-100 text-rose-600' :
                    incident.gravity === 'IMPORTANT' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 leading-tight">{incident.type}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {incident.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {incident.time}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={incident.status === 'RESOLU' ? 'outline' : 'secondary'} className={
                    incident.status === 'RESOLU' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                  }>
                    {incident.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(!stats.recentIncidents || stats.recentIncidents.length === 0) && (
              <div className="text-center py-12 text-sm text-slate-400">
                Aucun incident récent enregistré.
              </div>
            )}
          </Card>
        </div>

        {/* Safety Meter */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Santé Globale</h3>
          <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <p className="text-sm font-semibold">Niveau de Sécurité</p>
              </div>

              <div className="space-y-2">
                <p className="text-4xl font-semibold text-emerald-400">OPTIMAL</p>
                <p className="text-xs text-white/50">Dernier audit : 14/05/2026</p>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Conformité Sanitaire</span>
                  <span className="text-emerald-400">{complianceRate}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${complianceRate}%` }} />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 -right-8 opacity-10">
              <ShieldCheck className="w-48 h-48" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
