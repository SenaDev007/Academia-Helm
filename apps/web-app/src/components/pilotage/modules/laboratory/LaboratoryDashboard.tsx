/**
 * ============================================================================
 * LABORATORY DASHBOARD
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Beaker, 
  Microscope, 
  Calendar, 
  AlertTriangle, 
  Wrench, 
  TrendingUp,
  Activity,
  Package,
  Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

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
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`p-3 rounded-2xl w-fit mb-4 ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center">
              <Activity className="w-6 h-6 mr-3 text-blue-600" />
              Taux d'Occupation
            </h3>
            <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20">
              <option>Cette Semaine</option>
              <option>Ce Mois</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[65, 45, 80, 55, 90, 40, 20].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${val}%` }}
                  className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden group-hover:bg-blue-100 transition-colors"
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-600 opacity-20 h-full transform origin-bottom scale-y-50" />
                </motion.div>
                <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center">
            <TrendingUp className="w-6 h-6 mr-3 text-emerald-600" />
            Répartition par Lab
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Lab Physique', value: 85, color: 'bg-blue-500' },
              { label: 'Lab Chimie', value: 70, color: 'bg-emerald-500' },
              { label: 'Lab SVT', value: 45, color: 'bg-amber-500' },
              { label: 'Lab Informatique', value: 95, color: 'bg-blue-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-900">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    className={`h-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
