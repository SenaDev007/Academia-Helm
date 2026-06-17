'use client';

import { MapPin, Bus, Clock, Activity, Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface AssignmentItem {
  id: string;
  route?: string;
  routeName?: string;
  vehicle?: string;
  vehicleName?: string;
  driver?: string;
  driverName?: string;
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

export default function TransportTrips() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<AssignmentItem>('transport', 'assignments', academicYear?.id);

  const trips = data ?? [];

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
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
          <Activity className="w-3 h-3" /> System Live
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
            const status = trip.status || 'PLANNED';
            const start = trip.start || trip.startTime || '';
            const end = trip.end || trip.endTime || '';
            const expected = trip.expected || trip.expectedEnd || '';
            const expectedStart = trip.expectedStart || '';
            const delay = trip.delay ?? trip.delayMinutes ?? 0;
            return (
              <div key={trip.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-2xl ${
                      status === 'IN_PROGRESS' ? 'bg-emerald-50 text-emerald-600' :
                      status === 'COMPLETED' ? 'bg-navy-50 text-navy-900' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {status === 'IN_PROGRESS' ? <Play className="w-6 h-6 animate-pulse" /> :
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
                        status === 'IN_PROGRESS' ? 'bg-emerald-50 text-emerald-600' :
                        status === 'COMPLETED' ? 'bg-slate-50 text-slate-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {status}
                      </span>
                    </div>
                  </div>
                </div>

                {status === 'IN_PROGRESS' && (
                  <div className="mt-8 pt-8 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression de l'itinéraire</p>
                      <p className="text-[10px] font-black text-navy-900 uppercase tracking-widest">65% complété</p>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
