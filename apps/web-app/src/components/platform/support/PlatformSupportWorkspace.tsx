'use client';

import { HelpCircle, MessageSquare, Plus, Search, Filter, Clock, CheckCircle2, MoreVertical, AlertCircle } from 'lucide-react';

const MOCK_TICKETS = [
  { id: 'TKT-882', school: 'Lycée Excellence', subject: 'Problème accès ORION', priority: 'HIGH', status: 'OPEN', date: 'Il y a 1h' },
  { id: 'TKT-881', school: 'Collège Horizon', subject: 'Question facturation', priority: 'MEDIUM', status: 'IN_PROGRESS', date: 'Il y a 4h' },
];

export default function PlatformSupportWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support & Tickets</h1>
          <p className="text-slate-500">Gérer les demandes d'assistance des établissements</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <Plus className="w-4 h-4" />
          Ouvrir un Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Ouverts', value: '12', color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'En cours', value: '8', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Urgents', value: '3', color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Résolus (24h)', value: '45', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <h3 className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher un ticket..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20" />
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">N° Ticket</th>
              <th className="px-6 py-4">École</th>
              <th className="px-6 py-4">Sujet</th>
              <th className="px-6 py-4">Priorité</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_TICKETS.map((tkt) => (
              <tr key={tkt.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900">{tkt.id}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{tkt.school}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{tkt.subject}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    tkt.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {tkt.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    tkt.status === 'OPEN' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {tkt.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{tkt.date}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <MessageSquare className="w-4 h-4" />
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
