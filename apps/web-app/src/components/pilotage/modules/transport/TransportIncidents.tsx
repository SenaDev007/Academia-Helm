'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, Search, Filter, MoreVertical, MessageSquare, ShieldAlert, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface IncidentItem {
  id: string;
  type?: string;
  incidentType?: string;
  title?: string;
  vehicle?: string;
  vehicleName?: string;
  vehicleId?: string;
  date?: string;
  incidentDate?: string;
  severity?: string;
  status?: string;
  desc?: string;
  description?: string;
  [key: string]: any;
}

const EMPTY_FORM = { type: '', description: '', vehicleId: '', severity: 'MEDIUM' };

export default function TransportIncidents() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<IncidentItem>('transport', 'incidents', academicYear?.id);

  const incidents = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ type: string; description: string; vehicleId: string; severity: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/incidents', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création de l\'incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`transport/incidents/${id}/resolve`, { status: 'RESOLVED' }, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la résolution');
    } finally {
      setActionLoading(null);
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
          <ShieldAlert className="w-6 h-6 text-rose-600" /> Gestion des incidents
        </h3>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
        >
          <Plus className="w-4 h-4" /> Signaler un incident
        </button>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {incidents.map((incident) => {
            const type = incident.type || incident.incidentType || incident.title || `Incident ${incident.id}`;
            const vehicle = incident.vehicle || incident.vehicleName || '—';
            const date = incident.date || incident.incidentDate;
            const severity = incident.severity || 'MEDIUM';
            const status = incident.status || 'OPEN';
            const desc = incident.desc || incident.description || '';
            const isResolved = (status || '').toUpperCase() === 'RESOLVED';
            return (
              <div key={incident.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        severity === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {severity} SEVERITY
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        isResolved ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-2">{type}</h4>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">{desc}</p>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Véhicule:</p>
                        <p className="text-xs font-black text-slate-900">{vehicle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date:</p>
                        <p className="text-xs font-black text-slate-900">{date ? new Date(date).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col justify-end gap-3 shrink-0">
                    <button className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
                      <MessageSquare className="w-4 h-4" /> Contacter
                    </button>
                    <button
                      onClick={() => handleResolve(incident.id)}
                      disabled={actionLoading === incident.id || isResolved}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all disabled:opacity-50"
                    >
                      {actionLoading === incident.id ? 'Envoi...' : isResolved ? 'Résolu' : 'Détails & Résolution'}
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
              <h3 className="text-lg font-bold">Signaler un incident</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type d'incident</label>
                <input
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Panne moteur"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Gravité</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="LOW">Faible</option>
                  <option value="MEDIUM">Moyenne</option>
                  <option value="HIGH">Haute</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Véhicule (ID)</label>
                <input
                  type="text"
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="vehicle-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Détails de l'incident"
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
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
