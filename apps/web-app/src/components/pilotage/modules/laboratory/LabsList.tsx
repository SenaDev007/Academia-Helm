/**
 * ============================================================================
 * LABORATORIES LIST
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2, Beaker, MapPin, Users, User, ShieldCheck, ChevronRight, MoreVertical, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface LabItem {
  id?: string;
  name?: string;
  type?: string;
  labType?: string;
  building?: string;
  floor?: string;
  location?: string;
  capacity?: number;
  manager?: string;
  responsible?: string;
  status?: string;
}

export default function LabsList() {
  const { academicYear } = useModuleContext();
  const { data: labs, loading, error } = useModulesList<LabItem>(
    'labs',
    '',
    academicYear?.id,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des laboratoires...</span>
      </div>
    );
  }

  const safeLabs = labs ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les laboratoires. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Nos Espaces Laboratoires</h3>
        <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-sm">
          <Plus className="w-4 h-4" />
          <span>Nouveau Laboratoire</span>
        </button>
      </div>

      {safeLabs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun laboratoire enregistré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {safeLabs.map((lab: any, i: number) => {
            const id = lab?.id ?? `LAB-${i}`;
            const name = lab?.name ?? `Laboratoire #${i + 1}`;
            const type = lab?.type ?? lab?.labType ?? 'Général';
            const building = lab?.building ?? '—';
            const floor = lab?.floor ?? lab?.location ?? '';
            const capacity = lab?.capacity ?? 0;
            const manager = lab?.manager ?? lab?.responsible ?? '—';
            const status = (lab?.status ?? 'ACTIVE').toString().toUpperCase();
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex items-start gap-6">
                  <div className="p-5 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Beaker className="w-10 h-10" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-xl font-black text-slate-900">{name}</h4>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                          status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{id} • {type}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center text-slate-500 text-sm">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                        <span>{building}{floor ? `, ${floor}` : ''}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <Users className="w-4 h-4 mr-2 text-slate-400" />
                        <span>Capacité: {capacity}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <User className="w-4 h-4 mr-2 text-slate-400" />
                        <span>Resp: {manager}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                        <span>QHSE Certifié</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((_, j) => (
                          <div key={j} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                        ))}
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">+12</div>
                      </div>
                      <button className="flex items-center text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-2 transition-transform">
                        Détails & Équipements
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
