'use client';

import { Bus, Plus, Search, Filter, MoreVertical, Fuel, Gauge, Users } from 'lucide-react';

export default function TransportVehicles() {
  const vehicles = [
    { id: '1', name: 'Bus #01', plate: 'AB-123-CD', type: 'Bus Scolaire', capacity: 60, status: 'ACTIVE', driver: 'Moussa Diop' },
    { id: '2', name: 'Bus #02', plate: 'EF-456-GH', type: 'Mini-bus', capacity: 30, status: 'AVAILABLE', driver: 'Jean Gomis' },
    { id: '3', name: 'Bus #03', plate: 'IJ-789-KL', type: 'Van', capacity: 15, status: 'MAINTENANCE', driver: 'Paul Sarr' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un véhicule..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
            <Plus className="w-4 h-4" />
            Nouveau Véhicule
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${
                  vehicle.status === 'ACTIVE' ? 'bg-emerald-50' : 
                  vehicle.status === 'MAINTENANCE' ? 'bg-rose-50' : 'bg-slate-50'
                }`}>
                  <Bus className={`w-6 h-6 ${
                    vehicle.status === 'ACTIVE' ? 'text-emerald-600' : 
                    vehicle.status === 'MAINTENANCE' ? 'text-rose-600' : 'text-slate-600'
                  }`} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 tracking-tighter uppercase">{vehicle.name}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{vehicle.plate}</p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-1 text-slate-400">
                  <Users className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Capacité</span>
                </div>
                <p className="text-sm font-black text-slate-900">{vehicle.capacity} places</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-1 text-slate-400">
                  <Gauge className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Status</span>
                </div>
                <p className={`text-sm font-black uppercase tracking-tighter ${
                  vehicle.status === 'ACTIVE' ? 'text-emerald-600' : 
                  vehicle.status === 'MAINTENANCE' ? 'text-rose-600' : 'text-slate-900'
                }`}>{vehicle.status}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-900 font-black text-[10px]">
                  {vehicle.driver.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Chauffeur</p>
                  <p className="text-xs font-bold text-slate-900">{vehicle.driver}</p>
                </div>
              </div>
              <button className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition-all">
                <Fuel className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
