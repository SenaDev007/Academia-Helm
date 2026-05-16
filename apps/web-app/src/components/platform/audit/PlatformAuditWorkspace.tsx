'use client';

import { History, Search, Filter, Shield, Clock, ArrowRight } from 'lucide-react';

const MOCK_AUDIT_LOGS = [
  { id: 'LOG-001', user: 'admin@academiahelm.com', action: 'SUSPEND_TENANT', target: 'Lycée Excellence', date: 'Il y a 10 min', ip: '192.168.1.1' },
  { id: 'LOG-002', user: 'billing@academiahelm.com', action: 'GENERATE_INVOICE', target: 'Collège Horizon', date: 'Il y a 45 min', ip: '192.168.1.5' },
  { id: 'LOG-003', user: 'support1@academiahelm.com', action: 'LOGIN', target: 'Platform', date: 'Aujourd\'hui 09:00', ip: '10.0.0.12' },
];

export default function PlatformAuditWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit & Logs</h1>
          <p className="text-slate-500">Traçabilité complète des actions administratives</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
          <History className="w-4 h-4" />
          Exporter les logs
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher par utilisateur ou action..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <button className="p-2 bg-slate-50 rounded-lg text-slate-500">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Utilisateur</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Cible</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">IP Address</th>
              <th className="px-6 py-4 text-right">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_AUDIT_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{log.user}</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{log.action}</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{log.target}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{log.date}</td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{log.ip}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
