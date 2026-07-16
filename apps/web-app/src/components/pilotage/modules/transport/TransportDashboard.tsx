'use client';

import { Bus, Users, Clock, AlertTriangle, PenTool, MapPin, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TransportStats {
  activeVehicles?: number;
  transportedStudents?: number;
  punctualityRate?: number;
  recentIncidents?: number;
  activeTrips?: Array<{ id: string; busLabel: string; routeName: string; currentStop: string; status: string; eta: string }>;
  maintenanceAlerts?: Array<{ id: string; severity: 'critical' | 'warning'; title: string; vehicleLabel: string; detail: string }>;
}

const DEFAULT_STATS: TransportStats = {
  activeVehicles: 0,
  transportedStudents: 0,
  punctualityRate: 0,
  recentIncidents: 0,
  activeTrips: [],
  maintenanceAlerts: [],
};

export default function TransportDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<TransportStats>('transport', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  const kpis = [
    { label: 'Véhicules actifs', value: String(stats.activeVehicles ?? 0), icon: Bus, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Élèves transportés', value: String(stats.transportedStudents ?? 0), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ponctualité', value: `${stats.punctualityRate ?? 0}%`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Incidents récents', value: String(stats.recentIncidents ?? 0), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
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
        {kpis.map((kpi, i) => (
          <Card key={i} className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <span className="text-xs font-medium text-gray-500">Aujourd'hui</span>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{kpi.value}</p>
            <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Trips */}
        <Card className="lg:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Trajets en cours</h3>
            <Button variant="link" size="sm">Voir tout</Button>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {(stats.activeTrips?.length ? stats.activeTrips : []).map((trip) => (
              <div key={trip.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Bus className="w-5 h-5 text-gray-900" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{trip.busLabel} - {trip.routeName}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <MapPin className="w-3 h-3" /> Arrêt: {trip.currentStop}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-emerald-600 font-medium">{trip.status}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 text-sm">{trip.eta}</p>
                  <p className="text-xs font-medium text-gray-500">Arrivée estimée</p>
                </div>
              </div>
            ))}
            {(!stats.activeTrips || stats.activeTrips.length === 0) && (
              <div className="text-center py-8 text-sm text-gray-400">
                Aucun trajet en cours pour le moment.
              </div>
            )}
          </div>
        </Card>

        {/* Maintenance Alerts */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-rose-600" /> Maintenance
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {(stats.maintenanceAlerts?.length ? stats.maintenanceAlerts : []).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${alert.severity === 'critical' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}
              >
                <p className={`font-semibold text-sm mb-1 ${alert.severity === 'critical' ? 'text-rose-900' : 'text-amber-900'}`}>{alert.title}</p>
                <p className={`text-sm font-medium ${alert.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}>{alert.vehicleLabel}</p>
                <Badge variant="outline" className={`mt-2 ${alert.severity === 'critical' ? 'border-rose-200 text-rose-700' : 'border-amber-200 text-amber-700'}`}>
                  {alert.detail}
                </Badge>
              </div>
            ))}
            {(!stats.maintenanceAlerts || stats.maintenanceAlerts.length === 0) && (
              <div className="text-center py-8 text-sm text-gray-400">
                Aucune alerte de maintenance.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
