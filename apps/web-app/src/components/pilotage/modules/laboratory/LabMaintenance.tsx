/**
 * ============================================================================
 * LABORATORY MAINTENANCE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Wrench, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Settings,
  Shield,
  ChevronRight,
  Plus
} from 'lucide-react';

export default function LabMaintenance() {
  const maintenances = [
    { id: 'MNT-101', item: 'Microscope Binoculaire X400', type: 'PRÉVENTIVE', date: '12/06/2026', provider: 'Sérigraphie Tech', status: 'PLANNED' },
    { id: 'MNT-102', item: 'Centrifugeuse SVT', type: 'CORRECTIVE', date: '18/05/2026', provider: 'Maint. Interne', status: 'IN_PROGRESS' },
    { id: 'MNT-103', item: 'Oscilloscope Physique', type: 'CALIBRATION', date: '10/05/2026', provider: 'Labo National', status: 'COMPLETED' },
    { id: 'MNT-104', item: 'Balances de Chimie (Série)', type: 'NETTOYAGE', date: '05/05/2026', provider: 'Responsable Lab', status: 'COMPLETED' },
  ];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {maintenances.map((mnt, i) => (
          <motion.div
            key={mnt.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all group border-l-4"
            style={{ borderLeftColor: mnt.status === 'PLANNED' ? '#3B82F6' : mnt.status === 'IN_PROGRESS' ? '#F59E0B' : '#10B981' }}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mnt.type}</p>
                <h4 className="text-xl font-black text-slate-900">{mnt.item}</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{mnt.id}</p>
              </div>
              <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                mnt.status === 'PLANNED' ? 'bg-blue-50 text-blue-600' : 
                mnt.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {mnt.status}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center text-sm font-bold text-slate-600">
                <Calendar className="w-4 h-4 mr-3 text-slate-300" />
                {mnt.date}
              </div>
              <div className="flex items-center text-sm font-bold text-slate-600">
                <Shield className="w-4 h-4 mr-3 text-slate-300" />
                {mnt.provider}
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
        ))}
      </div>
    </div>
  );
}
