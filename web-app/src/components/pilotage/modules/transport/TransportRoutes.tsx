'use client';

import { Route, Plus, Search, MapPin, Clock, Users, ArrowRight } from 'lucide-react';

export default function TransportRoutes() {
  const routes = [
    { id: '1', name: 'Circuit Nord', code: 'RT-N', stops: 8, students: 45, morning: '07:00', evening: '17:30', vehicle: 'Bus #04' },
    { id: '2', name: 'Circuit Est', code: 'RT-E', stops: 12, students: 58, morning: '06:45', evening: '17:45', vehicle: 'Bus #02' },
    { id: '3', name: 'Circuit Centre', code: 'RT-C', stops: 6, students: 32, morning: '07:15', evening: '17:15', vehicle: 'Bus #01' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un itinéraire..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Nouvel Itinéraire
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {routes.map((route) => (
          <div key={route.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-navy-50 rounded-2xl text-navy-900 group-hover:bg-navy-900 group-hover:text-white transition-all">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{route.name}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{route.code}</p>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Véhicule</p>
                <p className="text-xs font-black text-slate-900">{route.vehicle}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-400">
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Arrêts</span>
                </div>
                <p className="text-lg font-black text-slate-900 tracking-tighter">{route.stops}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-400">
                  <Users className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Élèves</span>
                </div>
                <p className="text-lg font-black text-slate-900 tracking-tighter">{route.students}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Horaires</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{route.morning}</span>
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  <span className="text-xs font-bold text-slate-900">{route.evening}</span>
                </div>
              </div>
            </div>

            <button className="w-full py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-navy-900 hover:text-white hover:border-navy-900 transition-all">
              Gérer les arrêts et l'itinéraire
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
