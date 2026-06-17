/**
 * ============================================================================
 * LABORATORY MAINTENANCE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2, Wrench, Calendar, Shield, ChevronRight, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MaintenanceItem {
  id?: string;
  item?: string;
  equipmentName?: string;
  equipment?: string;
  type?: string;
  maintenanceType?: string;
  date?: string;
  scheduledAt?: string;
  maintenanceDate?: string;
  provider?: string;
  serviceProvider?: string;
  technician?: string;
  status?: string;
}

export default function LabMaintenance() {
  const { academicYear } = useModuleContext();
  const { data: maintenances, loading, error } = useModulesList<MaintenanceItem>(
    'labs',
    'maintenance',
    academicYear?.id,
  );

  const safeMaintenances = maintenances ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des maintenances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les maintenances. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Wrench className="w-6 h-6 mr-3 text-amber-500" />
            Maintenance & Étalonnage
          </h3>
          <p className="text-slate-500 text-sm font-medium">Assurez la précision et la longévité de vos outils.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
          <Plus className="w-4 h-4" />
          <span>Planifier Intervention</span>
        </button>
      </div>

      {safeMaintenances.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune intervention de maintenance planifiée pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {safeMaintenances.map((mnt: any, i: number) => {
            const id = mnt?.id ?? `MNT-${i}`;
            const item = mnt?.item ?? mnt?.equipmentName ?? mnt?.equipment ?? 'Équipement';
            const type = mnt?.type ?? mnt?.maintenanceType ?? 'PRÉVENTIVE';
            const date = mnt?.date ?? mnt?.maintenanceDate ?? (mnt?.scheduledAt ? new Date(mnt.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const provider = mnt?.provider ?? mnt?.serviceProvider ?? mnt?.technician ?? '—';
            const status = (mnt?.status ?? 'PLANNED').toString().toUpperCase();
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all group border-l-4"
                style={{ borderLeftColor: status === 'PLANNED' ? '#3B82F6' : status === 'IN_PROGRESS' ? '#F59E0B' : '#10B981' }}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{type}</p>
                    <h4 className="text-xl font-black text-slate-900">{item}</h4>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{id}</p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    status === 'PLANNED' ? 'bg-blue-50 text-blue-600' :
                    status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center text-sm font-bold text-slate-600">
                    <Calendar className="w-4 h-4 mr-3 text-slate-300" />
                    {date}
                  </div>
                  <div className="flex items-center text-sm font-bold text-slate-600">
                    <Shield className="w-4 h-4 mr-3 text-slate-300" />
                    {provider}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <button className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 transition-colors">Modifier</button>
                  <button className="flex items-center text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-2 transition-transform">
                    Rapport Technique
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
