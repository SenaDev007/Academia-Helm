'use client';

import React from 'react';
import { 
  History as HistoryIcon, 
  Search, 
  Filter, 
  Download, 
  Smartphone, 
  Mail, 
  MessageSquare, 
  Globe,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function CommunicationHistoryPage() {
  const history = [
    { id: 1, type: 'SMS', recipient: '+229 97 00 00 01', subject: 'Alerte Absence', status: 'DELIVERED', date: '12/05/2026 08:30', user: 'Système' },
    { id: 2, type: 'EMAIL', recipient: 'parent@example.com', subject: 'Bulletin Trimestre 1', status: 'OPENED', date: '11/05/2026 14:15', user: 'Secrétariat' },
    { id: 3, type: 'WHATSAPP', recipient: '+229 61 00 00 02', subject: 'Relance Scolarité', status: 'FAILED', date: '11/05/2026 10:00', user: 'Comptabilité' },
    { id: 4, type: 'PORTAL', recipient: 'Tous les enseignants', subject: 'Conseil de classe', status: 'READ', date: '10/05/2026 16:45', user: 'Direction' },
  ];

  const getChannelIcon = (type: string) => {
    switch(type) {
      case 'SMS': return <Smartphone size={18} className="text-emerald-500" />;
      case 'EMAIL': return <Mail size={18} className="text-blue-500" />;
      case 'WHATSAPP': return <MessageSquare size={18} className="text-green-500" />;
      default: return <Globe size={18} className="text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'DELIVERED': return <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={10} /> Livré</span>;
      case 'OPENED': return <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1"><Eye size={10} /> Ouvert</span>;
      case 'READ': return <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={10} /> Lu</span>;
      case 'FAILED': return <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1"><XCircle size={10} /> Échec</span>;
      default: return <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">Inconnu</span>;
    }
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <HistoryIcon size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">Traçabilité & Historique</h3>
              <p className="text-slate-400 font-medium">Archive complète et preuve de communication pour tous les échanges du tenant.</p>
            </div>
          </div>
          <button className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all">
            <Download size={18} /> Exporter le Log
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Rechercher par destinataire, objet ou contenu..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm shadow-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <button className="bg-white p-4 rounded-[1.5rem] border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
            <Filter size={20} />
          </button>
          <button className="bg-white p-4 rounded-[1.5rem] border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
            <Calendar size={20} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left border-b border-slate-100">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinataire</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Objet / Message</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Heure</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expéditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">{getChannelIcon(log.type)}</td>
                  <td className="px-8 py-5 font-bold text-slate-700">{log.recipient}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{log.subject}</td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">{getStatusBadge(log.status)}</div>
                  </td>
                  <td className="px-8 py-5 text-slate-400 text-xs font-mono">{log.date}</td>
                  <td className="px-8 py-5">
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">{log.user}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-center">
            <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">Charger plus d'entrées</button>
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}
