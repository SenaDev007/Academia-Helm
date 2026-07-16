/**
 * ============================================================================
 * LABORATORY DASHBOARD
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - Cards rounded-3xl → rounded-xl border-gray-200 shadow-sm
 * - <button> custom → <Button> shadcn (variant outline/ghost)
 * - text-[10px] font-black uppercase tracking-widest → text-xs font-medium
 * - font-black → font-semibold
 * - Bandeau navy-900 → slate-900
 * - framer-motion conservé pour les animations subtiles
 * ============================================================================
 */

'use client';

import {
  Beaker,
  Microscope,
  Calendar,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Activity,
  Package,
  Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LaboratoryStats {
  totalLabs?: number;
  activeReservations?: number;
  pendingMaintenance?: number;
  incidentsCount?: number;
  recentReservations?: Array<{ id?: string; lab?: string; teacher?: string; date?: string; time?: string; status?: string }>;
  lowStockConsumables?: Array<{ id?: string; name?: string; quantity?: number; threshold?: number }>;
}

const DEFAULT_STATS: LaboratoryStats = {
  totalLabs: 0,
  activeReservations: 0,
  pendingMaintenance: 0,
  incidentsCount: 0,
  recentReservations: [],
  lowStockConsumables: [],
};

export default function LaboratoryDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<LaboratoryStats>('labs', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  const kpiCards = [
    { label: 'Laboratoires Actifs', value: String(stats.totalLabs ?? 0), icon: Beaker, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Réservations du Jour', value: String(stats.activeReservations ?? 0), icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Équipements Disponibles', value: '—', icon: Microscope, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'En Maintenance', value: String(stats.pendingMaintenance ?? 0), icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Stock Faible', value: String(stats.lowStockConsumables?.length ?? 0), icon: Package, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Incidents Récents', value: String(stats.incidentsCount ?? 0), icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className={`p-3 rounded-xl w-fit mb-4 ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-semibold text-slate-900 mb-1">{stat.value}</p>
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Placeholder */}
        <Card className="lg:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Taux d&apos;Occupation
            </h3>
            <select className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20">
              <option>Cette Semaine</option>
              <option>Ce Mois</option>
            </select>
          </div>
          <div className="h-56 flex items-end justify-between space-x-2">
            {[65, 45, 80, 55, 90, 40, 20].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <div
                  className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden group-hover:bg-blue-100 transition-colors"
                  style={{ height: `${val}%` }}
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-600 opacity-30 h-full" />
                </div>
                <p className="mt-3 text-xs font-medium text-slate-400">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Status Breakdown */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
            Répartition par Lab
          </h3>
          <div className="space-y-5">
            {[
              { label: 'Lab Physique', value: 85, color: 'bg-blue-500' },
              { label: 'Lab Chimie', value: 70, color: 'bg-emerald-500' },
              { label: 'Lab SVT', value: 45, color: 'bg-amber-500' },
              { label: 'Lab Informatique', value: 95, color: 'bg-blue-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-900">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent reservations / low stock quick view */}
      <Card className="p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Consommables en alerte</h3>
          <Button variant="outline" size="sm" onClick={() => { /* navigation gérée par ModuleContainer */ }}>
            Voir tout
          </Button>
        </div>
        {(stats.lowStockConsumables ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Aucune alerte de stock.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(stats.lowStockConsumables ?? []).map((c, i) => (
              <Badge key={c?.id ?? i} variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                {c?.name ?? 'Consommable'} — {c?.quantity ?? 0}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
