'use client';

import { Calendar, Plus, Clock, Bus, Route, ChevronRight } from 'lucide-react';

export default function TransportSchedules() {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Planning hebdomadaire</h3>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Nouveau Trajet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {days.map((day) => (
          <div key={day} className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{day}</p>
            </div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-navy-900 transition-all cursor-pointer group">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3 h-3 text-navy-600" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">07:00 - 08:30</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-1">Circuit {i === 1 ? 'Nord' : 'Est'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bus #0{i + 3}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-navy-900 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
