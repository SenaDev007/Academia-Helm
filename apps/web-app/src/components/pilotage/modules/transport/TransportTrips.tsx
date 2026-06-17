'use client';

import { useState } from 'react';
import { MapPin, Bus, Clock, Activity, Play, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface AssignmentItem {
  id: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  vehicle?: string;
  vehicleName?: string;
  vehicleId?: string;
  driver?: string;
  driverName?: string;
  driverId?: string;
  status?: string;
  start?: string;
  startTime?: string;
  expected?: string;
  expectedEnd?: string;
  end?: string;
  endTime?: string;
  expectedStart?: string;
  delay?: number;
  delayMinutes?: number;
  [key: string]: any;
}

const EMPTY_FORM = { vehicleId: '', routeId: '', driverId: '' };

export default function TransportTrips() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<AssignmentItem>('transport', 'assignments', academicYear?.id);

  const trips = data ?? [];

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ vehicleId: string; routeId: string; driverId: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTripId, setEventTripId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ type: 'BOARDING', description: '' });
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const handleStartTrip = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/trips/start', formData, buildModulesApiOptions(academicYear?.id));
      setStartModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors du démarrage du trajet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    if (!confirm('Terminer ce trajet ?')) return;
    try {
      setActionLoading(tripId);
      await modulesApi.post(`transport/trips/${tripId}/complete`, {}, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la finalisation du trajet');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddEvent = async () => {
    if (!eventTripId) return;
    try {
      setEventSubmitting(true);
      await modulesApi.post(`transport/trips/${eventTripId}/events`, eventForm, buildModulesApiOptions(academicYear?.id));
      setEventModalOpen(false);
      setEventForm({ type: 'BOARDING', description: '' });
      setEventTripId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de l\'événement');
    } finally {
      setEventSubmitting(false);
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

      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Suivi des trajets (Temps réel)</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Activity className="w-3 h-3" /> System Live
          </div>
          <button
            onClick={() => { setFormData(EMPTY_FORM); setStartModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
          >
            <Play className="w-4 h-4" />
            Démarrer un Trajet
          </button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => {
            const route = trip.route || trip.routeName || `Trajet ${trip.id}`;
            const vehicle = trip.vehicle || trip.vehicleName || '—';
            const driver = trip.driver || trip.driverName || '—';
            const status = (trip.status || 'PLANNED').toUpperCase();
            const start = trip.start || trip.startTime || '';
            const end = trip.end || trip.endTime || '';
            const expected = trip.expected || trip.expectedEnd || '';
            const expectedStart = trip.expectedStart || '';
            const delay = trip.delay ?? trip.delayMinutes ?? 0;
            const isActive = status === 'IN_PROGRESS' || status === 'ACTIVE';
            return (
              <div key={trip.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-2xl ${
                      isActive ? 'bg-emerald-50 text-emerald-600' :
                      status === 'COMPLETED' ? 'bg-navy-50 text-navy-900' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {isActive ? <Play className="w-6 h-6 animate-pulse" /> :
                       status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-tight mb-1">{route}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{vehicle}</span>
                        <span className="text-[10px] text-slate-300 font-black uppercase">•</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{driver}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-8">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Départ</p>
                      <p className="text-lg font-black text-slate-900 tracking-tighter">{start || expectedStart || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">
                        {status === 'COMPLETED' ? 'Arrivée' : 'Estimation'}
                      </p>
                      <p className="text-lg font-black text-slate-900 tracking-tighter">{end || expected || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Retard</p>
                      <p className={`text-lg font-black tracking-tighter ${delay > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {delay ? `+${delay} min` : '0 min'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        isActive ? 'bg-emerald-50 text-emerald-600' :
                        status === 'COMPLETED' ? 'bg-slate-50 text-slate-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-8 pt-8 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression de l'itinéraire</p>
                      <p className="text-[10px] font-black text-navy-900 uppercase tracking-widest">65% complété</p>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => { setEventTripId(trip.id); setEventForm({ type: 'BOARDING', description: '' }); setEventModalOpen(true); }}
                        disabled={actionLoading === trip.id}
                        className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
                      >
                        Événement
                      </button>
                      <button
                        onClick={() => handleCompleteTrip(trip.id)}
                        disabled={actionLoading === trip.id}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {actionLoading === trip.id ? 'Envoi...' : 'Terminer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {startModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Démarrer un trajet</h3>
              <button onClick={() => setStartModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
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
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Route ID</label>
                <input
                  type="text"
                  value={formData.routeId}
                  onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="route-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Driver ID</label>
                <input
                  type="text"
                  value={formData.driverId}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="driver-001"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setStartModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleStartTrip}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Démarrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Événement de trajet</h3>
              <button onClick={() => setEventModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Type d'événement</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="BOARDING">Embarquement</option>
                  <option value="DISEMBARKING">Débarquement</option>
                  <option value="DELAY">Retard</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="ARRIVAL">Arrivée</option>
                  <option value="DEPARTURE">Départ</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  rows={3}
                  placeholder="Détails de l'événement"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEventModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleAddEvent}
                disabled={eventSubmitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {eventSubmitting ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
