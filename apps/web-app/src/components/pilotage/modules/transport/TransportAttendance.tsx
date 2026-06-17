'use client';

import { Users, CheckCircle2, XCircle, Clock, Search, Filter, Calendar } from 'lucide-react';

// TODO: endpoint non disponible — garder mock
// Le backend expose uniquement POST transport/attendances (pas de GET).
// Les présences restent en données statiques en attendant un endpoint de lecture.
export default function TransportAttendance() {
  const attendance = [
    { id: '1', name: 'Fatou Sow', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:15' },
    { id: '2', name: 'Abdoulaye Diallo', route: 'Circuit Est', stop: 'Pharmacie du Marché', status: 'ABSENT', time: '—' },
    { id: '3', name: 'Mariama Ba', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:12' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <Calendar className="w-5 h-5 text-navy-900" />
          <p className="font-black text-slate-900 uppercase tracking-tighter text-sm">Vendredi 15 Mai 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" /> Filtres
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
            Exporter le registre
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Itinéraire / Arrêt</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Heure de montée</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                        {entry.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{entry.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-700">{entry.route}</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{entry.stop}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span className="text-sm font-black text-slate-900">{entry.time}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
                      entry.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {entry.status === 'PRESENT' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-xs font-black text-navy-900 uppercase tracking-widest hover:underline">Détails</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
