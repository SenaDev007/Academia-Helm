'use client';

import { Bus, Users, Clock, AlertTriangle, PenTool, CreditCard, Route, MapPin } from 'lucide-react';

export default function TransportDashboard() {
  const kpis = [
    { label: 'Véhicules actifs', value: '12', icon: Bus, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Élèves transportés', value: '450', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ponctualité', value: '94%', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Incidents récents', value: '2', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${kpi.bg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aujourd'hui</span>
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</p>
            <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Trips */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Trajets en cours</h3>
            <button className="text-xs font-black text-navy-900 uppercase tracking-widest hover:underline">Voir tout</button>
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Bus className="w-5 h-5 text-navy-900" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">Bus #04 - Circuit Nord</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium italic">
                      <MapPin className="w-3 h-3" /> Arrêt: Rond-point Central
                    </span>
                    <span className="text-[10px] text-slate-400 font-black uppercase">•</span>
                    <span className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">En mouvement</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 text-sm">07:45</p>
                  <p className="text-[10px] font-medium text-slate-500 italic">Arrivée estimée</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Alerts */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-8 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-rose-600" /> Maintenance
          </h3>
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
              <p className="font-black text-rose-900 text-xs uppercase tracking-tight mb-1">Assurance expirée</p>
              <p className="text-sm font-medium text-rose-700">Bus #07 - Toyota Coaster</p>
              <p className="text-[10px] text-rose-600 mt-2 font-bold uppercase italic tracking-widest">Action requise urgente</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="font-black text-amber-900 text-xs uppercase tracking-tight mb-1">Vidange prévue</p>
              <p className="text-sm font-medium text-amber-700">Bus #03 - Mercedes Sprinter</p>
              <p className="text-[10px] text-amber-600 mt-2 font-bold uppercase italic tracking-widest">Dans 250 km</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
