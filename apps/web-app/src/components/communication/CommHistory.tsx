/**
 * CommHistory Component
 * 
 * ONGLET 12 — Historique & Traçabilité
 * Journal d'audit et preuves de livraison des communications.
 */

'use client';

import { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  XCircle,
  Eye,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommHistory() {
  const [logs] = useState([
    { id: 'LOG-001', type: 'Campagne (Relance)', channel: 'SMS', recipient: 'Famille Koné (+225 01020304)', status: 'DELIVERED', time: '16 Mai 2026, 14:30', cost: '1 Crédit' },
    { id: 'LOG-002', type: 'Message Auto (Absence)', channel: 'WHATSAPP', recipient: 'Famille Diallo', status: 'READ', time: '16 Mai 2026, 09:15', cost: 'Gratuit' },
    { id: 'LOG-003', type: 'Notification Push', channel: 'PORTAIL', recipient: 'Tous les Enseignants', status: 'SENT', time: '15 Mai 2026, 17:00', cost: '-' },
    { id: 'LOG-004', type: 'Bulletin T2', channel: 'EMAIL', recipient: 'Famille Sylla', status: 'FAILED', time: '15 Mai 2026, 16:45', cost: 'Bounced' },
  ]);

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'DELIVERED': return { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Livré' };
      case 'READ': return { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Lu' };
      case 'SENT': return { icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Envoyé' };
      case 'FAILED': return { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Échec' };
      default: return { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100', label: status };
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
              <History className="w-6 h-6 text-violet-400" /> Registre d'Audit des Communications
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Journal immuable de tous les messages envoyés depuis l'établissement. Preuves de livraison opposables.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors border border-white/10">
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher par destinataire, ID..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20" />
          </div>
          <select className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none">
            <option>Tous les statuts</option>
            <option>Livré</option>
            <option>Échec</option>
            <option>Lu</option>
          </select>
          <select className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none">
            <option>Tous les canaux</option>
            <option>SMS</option>
            <option>WhatsApp</option>
            <option>Email</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type & Canal</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinataire</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const status = getStatusConfig(log.status);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-900">{log.time}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{log.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{log.channel}</span>
                        <span className="text-xs font-medium text-slate-700">{log.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-slate-800">{log.recipient}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 w-fit", status.bg, status.color)}>
                        <status.icon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline">
                        Preuve technique
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
