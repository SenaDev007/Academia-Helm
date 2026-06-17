'use client';

import { Calendar, Plus, Clock, Bus, Route, ChevronRight, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ScheduleItem {
  id: string;
  route?: string;
  routeName?: string;
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

export default function TransportSchedules() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<ScheduleItem>('transport', 'assignments', academicYear?.id);

  const assignments = data ?? [];

  // Groupe les assignments par jour de la semaine (fallback: Lundi)
  const byDay: Record<string, ScheduleItem[]> = {};
  for (const d of DAYS) byDay[d] = [];
  for (const a of assignments) {
    const day = a.dayOfWeek || a.day || 'Lundi';
    const key = DAYS.includes(day) ? day : 'Lundi';
    byDay[key].push(a);
  }

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
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Nouveau Trajet
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
    </div>
  );
}
