'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  Smartphone, 
  Mail, 
  MessageSquare, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Settings, 
  ExternalLink,
  ShieldCheck,
  Activity,
  ChevronRight,
  Plus
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function ChannelsPage() {
  const [channels, setChannels] = useState([
    { id: 'email', name: 'SendGrid (Email)', status: 'HEALTHY', type: 'SMTP/API', usage: 'High', rate: '99.2%', icon: Mail, color: 'blue' },
    { id: 'sms', name: 'Infobip (SMS)', status: 'WARNING', type: 'REST API', usage: 'Medium', rate: '85.4%', icon: Smartphone, color: 'emerald' },
    { id: 'whatsapp', name: 'WhatsApp Business', status: 'HEALTHY', type: 'Official API', usage: 'Medium', rate: '96.8%', icon: MessageSquare, color: 'green' },
    { id: 'portal', name: 'Internal Portal', status: 'HEALTHY', type: 'WebSocket', usage: 'Critical', rate: '100%', icon: Globe, color: 'violet' },
  ]);

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Connection Status Banner */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent pointer-events-none" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">Connectivité Globale</h3>
              <p className="text-slate-400 font-medium">Tous les systèmes sont synchronisés avec les passerelles régionales.</p>
            </div>
          </div>
          <div className="flex gap-4 relative z-10">
            <div className="text-center px-6 border-r border-white/10">
              <p className="text-2xl font-black text-emerald-400">98.4%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uptime Moyen</p>
            </div>
            <div className="text-center px-6">
              <p className="text-2xl font-black text-blue-400"><Zap size={24} className="inline mr-1" /> 2ms</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latence API</p>
            </div>
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {channels.map((channel) => (
            <div key={channel.id} className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-2xl bg-${channel.color}-50 text-${channel.color}-600 group-hover:bg-${channel.color}-600 group-hover:text-white transition-all`}>
                    <channel.icon size={28} />
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-2 ${
                    channel.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {channel.status === 'HEALTHY' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {channel.status}
                  </span>
                </div>
                
                <h4 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">{channel.name}</h4>
                <p className="text-sm font-medium text-slate-500 mb-8 uppercase tracking-widest text-[10px]">{channel.type}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Délivrabilité</p>
                    <p className="text-xl font-black text-slate-900">{channel.rate}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Priorité</p>
                    <p className="text-xl font-black text-slate-900">{channel.usage}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <button className="text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-2 font-bold text-sm">
                  <Settings size={18} /> Configurer
                </button>
                <button className="bg-slate-50 hover:bg-slate-100 text-slate-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
                  Documentation <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Add Provider Card */}
          <button className="border-4 border-dashed border-slate-100 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50/20 transition-all group">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Plus size={32} />
            </div>
            <p className="font-black uppercase tracking-widest text-sm">Ajouter un nouveau fournisseur</p>
          </button>
        </div>

        {/* Diagnostic Logs */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <Activity size={24} className="text-blue-600" /> Diagnostics Temps Réel
            </h4>
            <div className="flex gap-2">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En direct</span>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { time: '10:45:02', channel: 'SendGrid', status: '200 OK', lat: '124ms', log: 'Email Campaign "Absence" sent successfully to 45 recipients.' },
              { time: '10:44:58', channel: 'Infobip', status: '202 Accepted', lat: '85ms', log: 'SMS chunk 1/3 processed. Regional gateway MTN CI.' },
              { time: '10:44:12', channel: 'WhatsApp', status: '429 Rate Limit', lat: '5ms', log: 'Throttling applied for institutional broadcast. Auto-retry in 2s.' },
            ].map((log, i) => (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] font-mono">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 font-bold">{log.time}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-black text-slate-900">{log.channel}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-black ${log.status.includes('200') || log.status.includes('202') ? 'text-emerald-600' : 'text-rose-600'}`}>{log.status}</span>
                  <span className="text-slate-400">({log.lat})</span>
                </div>
                <span className="text-slate-600 flex-1 truncate">{log.log}</span>
                <ChevronRight size={14} className="text-slate-300 ml-auto hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}

