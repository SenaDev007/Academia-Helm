/**
 * CampaignManager Component
 * 
 * ONGLET 5 — Campagnes de communication
 * Gestion des envois massifs ou planifiés via différents canaux.
 */

'use client';

import { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  Mail,
  Smartphone,
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CampaignManager() {
  const [campaigns] = useState([
    { id: 'CMP-001', name: 'Relance Scolarité T2', channel: 'SMS', target: 'Parents (Débiteurs)', status: 'RUNNING', progress: 45, total: 120, sent: 54 },
    { id: 'CMP-002', name: 'Bulletin Disponible', channel: 'EMAIL', target: 'Tous les Parents', status: 'COMPLETED', progress: 100, total: 450, sent: 450 },
    { id: 'CMP-003', name: 'Rappel Réunion AP', channel: 'WHATSAPP', target: 'Association Parents', status: 'SCHEDULED', progress: 0, total: 12, sent: 0 },
  ]);

  const channelIcons: Record<string, any> = {
    SMS: MessageSquare,
    EMAIL: Mail,
    WHATSAPP: Smartphone,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input placeholder="Rechercher une campagne..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/20">
          <Plus className="w-4 h-4" /> Nouvelle Campagne
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {campaigns.map((camp) => {
          const Icon = channelIcons[camp.channel] || MessageSquare;
          return (
            <div key={camp.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl flex items-center justify-center",
                  camp.channel === 'SMS' ? "bg-blue-50 text-blue-600" :
                  camp.channel === 'WHATSAPP' ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1",
                  camp.status === 'RUNNING' ? "bg-amber-50 text-amber-600" :
                  camp.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                  {camp.status === 'RUNNING' && <Zap className="w-3 h-3" />}
                  {camp.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                  {camp.status === 'SCHEDULED' && <Clock className="w-3 h-3" />}
                  {camp.status}
                </span>
              </div>
              
              <h4 className="font-bold text-slate-900 truncate">{camp.name}</h4>
              <p className="text-xs text-slate-400 mt-1 truncate">Cible : {camp.target}</p>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 uppercase tracking-widest">Progression</span>
                  <span className="text-slate-900">{camp.sent} / {camp.total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      camp.status === 'RUNNING' ? "bg-amber-500" :
                      camp.status === 'COMPLETED' ? "bg-emerald-500" : "bg-slate-300"
                    )}
                    style={{ width: `${camp.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex gap-2">
                  {camp.status === 'RUNNING' ? (
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-amber-600 transition-colors">
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : camp.status === 'SCHEDULED' ? (
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-emerald-600 transition-colors">
                      <Play className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
