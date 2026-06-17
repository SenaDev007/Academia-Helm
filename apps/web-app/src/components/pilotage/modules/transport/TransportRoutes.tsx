'use client';

import { useState } from 'react';
import { Route, Plus, Search, MapPin, Clock, Users, ArrowRight, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface RouteItem {
  id: string;
  name?: string;
  code?: string;
  zoneId?: string;
  zone?: string;
  stops?: number;
  stopCount?: number;
  students?: number;
  studentCount?: number;
  morning?: string;
  morningTime?: string;
  evening?: string;
  eveningTime?: string;
  vehicle?: string;
  vehicleName?: string;
  [key: string]: any;
}

const EMPTY_FORM = { name: '', zoneId: '', stops: '' };

export default function TransportRoutes() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<RouteItem>('transport', 'routes', academicYear?.id);

  const routes = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ name: string; zoneId: string; stops: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Stop add modal
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopRouteId, setStopRouteId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({ name: '', time: '', lat: '', lng: '' });
  const [stopSubmitting, setStopSubmitting] = useState(false);

  const handleCreateRoute = async () => {
    try {
      setSubmitting(true);
      const payload: any = {
        name: formData.name,
        zoneId: formData.zoneId || undefined,
      };
      // Optionnel : si l'utilisateur a saisi des arrêts (séparés par virgule), on les envoie comme stops initiaux
      if (formData.stops.trim()) {
        payload.stops = formData.stops.split(',').map((s) => s.trim()).filter(Boolean).map((name, idx) => ({
          name,
          order: idx + 1,
        }));
      }
      await modulesApi.post('transport/routes', payload, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création de la route');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStop = async () => {
    if (!stopRouteId) return;
    try {
      setStopSubmitting(true);
      const payload: any = {
        name: stopForm.name,
        time: stopForm.time || undefined,
      };
      if (stopForm.lat) payload.lat = Number(stopForm.lat);
      if (stopForm.lng) payload.lng = Number(stopForm.lng);
      await modulesApi.post(`transport/routes/${stopRouteId}/stops`, payload, buildModulesApiOptions(academicYear?.id));
      setStopModalOpen(false);
      setStopForm({ name: '', time: '', lat: '', lng: '' });
      setStopRouteId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'ajout de l\'arrêt');
    } finally {
      setStopSubmitting(false);
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un itinéraire..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouvel Itinéraire
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {routes.map((route) => {
            const name = route.name || `Itinéraire ${route.id}`;
            const code = route.code || '—';
            const stops = route.stops ?? route.stopCount ?? 0;
            const students = route.students ?? route.studentCount ?? 0;
            const morning = route.morning || route.morningTime || '—';
            const evening = route.evening || route.eveningTime || '—';
            const vehicle = route.vehicle || route.vehicleName || '—';
            return (
              <div key={route.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-navy-50 rounded-2xl text-navy-900 group-hover:bg-navy-900 group-hover:text-white transition-all">
                      <Route className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{name}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{code}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Véhicule</p>
                    <p className="text-xs font-black text-slate-900">{vehicle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                      <MapPin className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Arrêts</span>
                    </div>
                    <p className="text-lg font-black text-slate-900 tracking-tighter">{stops}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Élèves</span>
                    </div>
                    <p className="text-lg font-black text-slate-900 tracking-tighter">{students}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Horaires</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{morning}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="text-xs font-bold text-slate-900">{evening}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStopRouteId(route.id);
                    setStopForm({ name: '', time: '', lat: '', lng: '' });
                    setStopModalOpen(true);
                  }}
                  className="w-full py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-navy-900 hover:text-white hover:border-navy-900 transition-all"
                >
                  Gérer les arrêts et l'itinéraire
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouvel itinéraire</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nom de l'itinéraire</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Circuit Nord"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Zone (ID)</label>
                <input
                  type="text"
                  value={formData.zoneId}
                  onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="zone-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Arrêts (séparés par une virgule)</label>
                <input
                  type="text"
                  value={formData.stops}
                  onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Rond-point Central, Marché, École"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreateRoute}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Ajouter un arrêt</h3>
              <button onClick={() => setStopModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nom de l'arrêt</label>
                <input
                  type="text"
                  value={stopForm.name}
                  onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Rond-point Central"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Heure (optionnel)</label>
                <input
                  type="text"
                  value={stopForm.time}
                  onChange={(e) => setStopForm({ ...stopForm, time: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="07:15"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Latitude (optionnel)</label>
                  <input
                    type="text"
                    value={stopForm.lat}
                    onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="6.365"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Longitude (optionnel)</label>
                  <input
                    type="text"
                    value={stopForm.lng}
                    onChange={(e) => setStopForm({ ...stopForm, lng: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="2.418"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setStopModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleAddStop}
                disabled={stopSubmitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {stopSubmitting ? 'Envoi...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
