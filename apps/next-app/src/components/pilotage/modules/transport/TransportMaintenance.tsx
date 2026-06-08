'use client';

import { PenTool, Plus, Search, Filter, Calendar, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TransportMaintenance() {
  const maintenances = [
    { id: '1', vehicle: 'Bus #01', type: 'Vidange & Filtres', date: '2026-05-10', cost: '45 000 F CFA', status: 'COMPLETED' },
    { id: '2', vehicle: 'Bus #04', type: 'Révision freins', date: '2026-05-18', cost: '—', status: 'PLANNED' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <Wrench className="w-6 h-6 text-navy-900" /> Maintenance Préventive
        </h3>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" /> Planifier un entretien
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Véhicule</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type d'entretien</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Coût</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenances.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-900 text-sm uppercase">{m.vehicle}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{m.type}</td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{new Date(m.date).toLocaleDateString()}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{m.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Alertes Maintenance</h4>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-rose-50 border border-rose-100">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-rose-900 uppercase mb-1">Visite technique</p>
                  <p className="text-xs font-medium text-rose-700">Bus #02 expiré le 12/05</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-amber-900 uppercase mb-1">Pneumatiques</p>
                  <p className="text-xs font-medium text-amber-700">Bus #01 à vérifier (15,000km)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
