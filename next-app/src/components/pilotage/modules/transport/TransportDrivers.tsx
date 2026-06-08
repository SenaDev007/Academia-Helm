'use client';

import { Users, Plus, Search, Mail, Phone, Calendar, ShieldCheck, MoreVertical } from 'lucide-react';

export default function TransportDrivers() {
  const drivers = [
    { id: '1', name: 'Moussa Diop', phone: '+221 77 123 45 67', license: 'B, C, D', expiry: '2027-05-20', status: 'ACTIVE' },
    { id: '2', name: 'Jean Gomis', phone: '+221 70 987 65 43', license: 'B, C', expiry: '2026-12-15', status: 'ACTIVE' },
    { id: '3', name: 'Awa Ndiaye', phone: '+221 76 543 21 09', role: 'Accompagnatrice', status: 'ACTIVE' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un chauffeur ou accompagnateur..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Nouveau Personnel
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Permis / Rôle</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiration</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-navy-900 group-hover:text-white transition-all font-black text-xs">
                        {person.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{person.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: DRV-{person.id.padStart(3, '0')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-600 flex items-center gap-2">
                        <Phone className="w-3 h-3 text-slate-400" /> {person.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-tighter">{person.license || person.role}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium text-slate-600">{person.expiry ? new Date(person.expiry).toLocaleDateString() : '—'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {person.status}
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
