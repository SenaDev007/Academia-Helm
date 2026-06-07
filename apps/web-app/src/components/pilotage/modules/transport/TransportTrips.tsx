'use client';

import { MapPin, Bus, Clock, Activity, Play, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function TransportTrips() {
  const trips = [
    { id: '1', route: 'Circuit Nord', vehicle: 'Bus #04', driver: 'Moussa Diop', status: 'IN_PROGRESS', start: '07:05', expected: '08:15', delay: 5 },
    { id: '2', route: 'Circuit Est', vehicle: 'Bus #02', driver: 'Jean Gomis', status: 'COMPLETED', start: '06:50', end: '08:05', delay: 0 },
    { id: '3', route: 'Circuit Centre', vehicle: 'Bus #01', driver: 'Paul Sarr', status: 'PLANNED', expectedStart: '07:15' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Suivi des trajets (Temps réel)</h3>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
          <Activity className="w-3 h-3" /> System Live
        </div>
      </div>

      <div className="space-y-6">
        {trips.map((trip) => (
          <div key={trip.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-2xl ${
                  trip.status === 'IN_PROGRESS' ? 'bg-emerald-50 text-emerald-600' :
                  trip.status === 'COMPLETED' ? 'bg-navy-50 text-navy-900' : 'bg-slate-50 text-slate-400'
                }`}>
                  {trip.status === 'IN_PROGRESS' ? <Play className="w-6 h-6 animate-pulse" /> :
                   trip.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-tight mb-1">{trip.route}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{trip.vehicle}</span>
                    <span className="text-[10px] text-slate-300 font-black uppercase">•</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{trip.driver}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Départ</p>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">{trip.start || trip.expectedStart || '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">
                    {trip.status === 'COMPLETED' ? 'Arrivée' : 'Estimation'}
                  </p>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">{trip.end || trip.expected || '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Retard</p>
                  <p className={`text-lg font-black tracking-tighter ${trip.delay && trip.delay > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {trip.delay ? `+${trip.delay} min` : '0 min'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    trip.status === 'IN_PROGRESS' ? 'bg-emerald-50 text-emerald-600' :
                    trip.status === 'COMPLETED' ? 'bg-slate-50 text-slate-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {trip.status}
                  </span>
                </div>
              </div>
            </div>

            {trip.status === 'IN_PROGRESS' && (
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
        ))}
      </div>
    </div>
  );
}
