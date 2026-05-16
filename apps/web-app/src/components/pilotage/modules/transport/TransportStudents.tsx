'use client';

import { Users, Plus, Search, MapPin, Bus, CreditCard, MoreVertical } from 'lucide-react';

export default function TransportStudents() {
  const students = [
    { id: '1', name: 'Fatou Sow', class: '6ème A', route: 'Circuit Nord', stop: 'Rond-point Central', payment: 'PAID', status: 'ACTIVE' },
    { id: '2', name: 'Abdoulaye Diallo', class: 'CM2', route: 'Circuit Est', stop: 'Pharmacie du Marché', payment: 'PENDING', status: 'ACTIVE' },
    { id: '3', name: 'Mariama Ba', class: '3ème B', route: 'Circuit Nord', stop: 'Rond-point Central', payment: 'PAID', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un élève..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Inscrire un Élève
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Itinéraire / Arrêt</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paiement</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-navy-50 flex items-center justify-center text-navy-900 font-black text-xs">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{student.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.class}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Bus className="w-3 h-3 text-slate-400" /> {student.route}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-slate-300" /> {student.stop}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">Annuel (A/R)</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      student.payment === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {student.payment}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {student.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
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
