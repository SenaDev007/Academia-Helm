'use client';

import { useState } from 'react';
import { Bus, Plus, Search, Filter, MoreVertical, Fuel, Gauge, Users, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface VehicleItem {
  id: string;
  name?: string;
  plate?: string;
  registrationPlate?: string;
  type?: string;
  capacity?: number;
  status?: string;
  driver?: string;
  driverName?: string;
  [key: string]: any;
}

const EMPTY_FORM = { name: '', plate: '', model: '', capacity: '', type: 'Bus Scolaire' };

export default function TransportVehicles() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<VehicleItem>('transport', 'vehicles', academicYear?.id);

  const vehicles = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; plate: string; model: string; capacity: string; type: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (v: VehicleItem) => {
    setFormData({
      name: v.name || '',
      plate: v.plate || v.registrationPlate || '',
      model: v.model || v.type || '',
      capacity: String(v.capacity ?? ''),
      type: v.type || 'Bus Scolaire',
    });
    setEditId(v.id);
    setModalOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        plate: formData.plate,
        registrationPlate: formData.plate,
        model: formData.model,
        type: formData.type,
        capacity: Number(formData.capacity) || 0,
      };
      if (editId) {
        await modulesApi.put(`transport/vehicles/${editId}`, payload, buildModulesApiOptions(academicYear?.id));
      } else {
        await modulesApi.post('transport/vehicles', payload, buildModulesApiOptions(academicYear?.id));
      }
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    alert('Suppression non disponible : aucun endpoint DELETE n\'est exposé pour transport/vehicles.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un véhicule..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau Véhicule
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => {
            const name = vehicle.name || vehicle.id;
            const plate = vehicle.plate || vehicle.registrationPlate || '—';
            const capacity = vehicle.capacity ?? 0;
            const status = vehicle.status || 'AVAILABLE';
            const driver = vehicle.driver || vehicle.driverName || 'Non assigné';
            return (
              <div key={vehicle.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${
                      status === 'ACTIVE' ? 'bg-emerald-50' : 
                      status === 'MAINTENANCE' ? 'bg-rose-50' : 'bg-slate-50'
                    }`}>
                      <Bus className={`w-6 h-6 ${
                        status === 'ACTIVE' ? 'text-emerald-600' : 
                        status === 'MAINTENANCE' ? 'text-rose-600' : 'text-slate-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tighter uppercase">{name}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{plate}</p>
                    </div>
                  </div>
                  <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-slate-400">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Capacité</span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{capacity} places</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-slate-400">
                      <Gauge className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Status</span>
                    </div>
                    <p className={`text-sm font-black uppercase tracking-tighter ${
                      status === 'ACTIVE' ? 'text-emerald-600' : 
                      status === 'MAINTENANCE' ? 'text-rose-600' : 'text-slate-900'
                    }`}>{status}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-900 font-black text-[10px]">
                      {driver.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Chauffeur</p>
                      <p className="text-xs font-bold text-slate-900">{driver}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(vehicle)}
                      disabled={actionLoading === vehicle.id}
                      className="px-3 py-2 bg-slate-50 rounded-xl text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      disabled={actionLoading === vehicle.id}
                      className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-all disabled:opacity-50"
                    >
                      <Fuel className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editId ? 'Modifier le véhicule' : 'Nouveau véhicule'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Bus scolaire A"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Plaque d'immatriculation</label>
                <input
                  type="text"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="AB-123-CD"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Modèle</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Mercedes Sprinter"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Capacité</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option>Bus Scolaire</option>
                    <option>Mini-bus</option>
                    <option>Van</option>
                    <option>4x4</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : editId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
