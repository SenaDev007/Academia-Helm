/**
 * ============================================================================
 * LABORATORIES LIST
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Beaker, MapPin, Users, User, ShieldCheck, ChevronRight, MoreVertical, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

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
  const { data: labs, loading, error, refetch } = useModulesList<LabItem>(
    'labs',
    '',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [labForm, setLabForm] = useState({ name: '', location: '', capacity: 0, type: '' });

  const handleCreateLab = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('labs', labForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setLabForm({ name: '', location: '', capacity: 0, type: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du laboratoire');
    } finally {
      setSubmitting(false);
    }
  };

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
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-all font-bold text-sm"
        >
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

      {/* Lab Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouveau Laboratoire</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nom</label>
                <input type="text" value={labForm.name} onChange={(e) => setLabForm({ ...labForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Emplacement</label>
                <input type="text" value={labForm.location} onChange={(e) => setLabForm({ ...labForm, location: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Capacité</label>
                  <input type="number" value={labForm.capacity} onChange={(e) => setLabForm({ ...labForm, capacity: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
                  <input type="text" value={labForm.type} onChange={(e) => setLabForm({ ...labForm, type: e.target.value })} placeholder="ex: Physique" className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateLab} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
