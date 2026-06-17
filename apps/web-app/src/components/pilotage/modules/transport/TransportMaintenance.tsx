'use client';

import { useState } from 'react';
import { PenTool, Plus, Search, Filter, Calendar, Wrench, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface VehicleItem {
  id: string;
  name?: string;
  vehicleName?: string;
  maintenance?: any;
  maintenances?: Array<{
    id?: string;
    type?: string;
    maintenanceType?: string;
    date?: string;
    maintenanceDate?: string;
    cost?: string;
    maintenanceCost?: string;
    status?: string;
    maintenanceStatus?: string;
  }>;
  [key: string]: any;
}

interface MaintenanceRow {
  id: string;
  vehicleId: string;
  vehicle: string;
  type: string;
  date: string;
  cost: string;
  status: string;
}

const EMPTY_FORM = { vehicleId: '', type: 'PREVENTIVE', cost: '', date: new Date().toISOString().slice(0, 10) };

export default function TransportMaintenance() {
  const { academicYear } = useModuleContext();
  // Récupère les véhicules avec un filtre "maintenance" pour cibler les entretiens
  const { data, loading, error, refetch } = useModulesList<VehicleItem>('transport', 'vehicles', academicYear?.id, { maintenance: true });

  const vehicles = data ?? [];

  // Aplatit les maintenances imbriquées dans chaque véhicule
  const maintenances: MaintenanceRow[] = vehicles.flatMap((v) => {
    const vehicleName = v.name || v.vehicleName || `Véhicule ${v.id}`;
    const list = Array.isArray(v.maintenance) ? v.maintenance : (v.maintenances ?? []);
    if (list.length === 0) {
      return [{
        id: v.id,
        vehicleId: v.id,
        vehicle: vehicleName,
        type: '—',
        date: '',
        cost: '—',
        status: 'NONE',
      }];
    }
    return list.map((m, idx) => ({
      id: m.id ?? `${v.id}-${idx}`,
      vehicleId: v.id,
      vehicle: vehicleName,
      type: m.type || m.maintenanceType || '—',
      date: m.date || m.maintenanceDate || '',
      cost: m.cost || m.maintenanceCost || '—',
      status: m.status || m.maintenanceStatus || 'PLANNED',
    }));
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ vehicleId: string; type: string; cost: string; date: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.vehicleId) {
      alert('Veuillez saisir l\'ID du véhicule.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        type: formData.type,
        cost: Number(formData.cost) || 0,
        date: formData.date,
      };
      await modulesApi.post(`transport/vehicles/${formData.vehicleId}/maintenance`, payload, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de la maintenance');
    } finally {
      setSubmitting(false);
    }
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
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <Wrench className="w-6 h-6 text-navy-900" /> Maintenance Préventive
        </h3>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4" /> Nouvelle Maintenance
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Véhicule</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type d'entretien</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Coût</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-10 text-center text-slate-500 text-sm">
                        Aucune donnée disponible pour cette année scolaire.
                      </td>
                    </tr>
                  ) : maintenances.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm uppercase">{m.vehicle}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{m.type}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{m.date ? new Date(m.date).toLocaleDateString() : '—'}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{m.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Alertes Maintenance</h4>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-rose-50 border border-rose-100">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-rose-900 uppercase mb-1">Visite technique</p>
                  <p className="text-xs font-medium text-rose-700">Bus #02 expiré le 12/05</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-900 uppercase mb-1">Pneumatiques</p>
                  <p className="text-xs font-medium text-amber-700">Bus #01 à vérifier (15,000km)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouvelle maintenance</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Vehicle ID</label>
                <input
                  type="text"
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="vehicle-001"
                />
                {vehicles.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    IDs disponibles : {vehicles.slice(0, 5).map((v) => v.id).join(', ')}
                    {vehicles.length > 5 ? '…' : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type d'entretien</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="PREVENTIVE">Préventive</option>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="TECHNICAL_INSPECTION">Visite technique</option>
                  <option value="TIRES">Pneumatiques</option>
                  <option value="OIL_CHANGE">Vidange</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Coût (FCFA)</label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
