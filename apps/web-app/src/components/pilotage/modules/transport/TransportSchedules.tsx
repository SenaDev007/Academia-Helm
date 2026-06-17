'use client';

import { useState } from 'react';
import { Calendar, Plus, Clock, Bus, Route, ChevronRight, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ScheduleItem {
  id: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  vehicle?: string;
  vehicleName?: string;
  startTime?: string;
  start?: string;
  endTime?: string;
  end?: string;
  dayOfWeek?: string;
  day?: string;
  [key: string]: any;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const EMPTY_FORM = { routeId: '', dayOfWeek: 'Lundi', departureTime: '07:00' };

export default function TransportSchedules() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<ScheduleItem>('transport', 'assignments', academicYear?.id);

  const assignments = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ routeId: string; dayOfWeek: string; departureTime: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Groupe les assignments par jour de la semaine (fallback: Lundi)
  const byDay: Record<string, ScheduleItem[]> = {};
  for (const d of DAYS) byDay[d] = [];
  for (const a of assignments) {
    const day = a.dayOfWeek || a.day || 'Lundi';
    const key = DAYS.includes(day) ? day : 'Lundi';
    byDay[key].push(a);
  }

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/schedules', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de la création du planning');
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
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Planning hebdomadaire</h3>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouveau Planning
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS.map((day) => (
          <div key={day} className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{day}</p>
            </div>
            <div className="space-y-3">
              {byDay[day].length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-dashed border-slate-100 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Aucun trajet
                </div>
              ) : (
                byDay[day].map((s) => {
                  const routeName = s.route || s.routeName || `Itinéraire ${s.id}`;
                  const start = s.startTime || s.start || '07:00';
                  const end = s.endTime || s.end || '08:30';
                  const vehicle = s.vehicle || s.vehicleName || '—';
                  return (
                    <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-navy-900 transition-all cursor-pointer group">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 text-navy-600" />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{start} - {end}</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 uppercase mb-1">{routeName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{vehicle}</span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-navy-900 transition-colors" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {assignments.length === 0 && !error && (
        <div className="text-center py-10 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouveau planning</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
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
                <label className="text-xs font-bold text-slate-500 uppercase">Jour de la semaine</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Heure de départ</label>
                <input
                  type="time"
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
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
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
