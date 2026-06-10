/**
 * ChannelConnectors Component
 * 
 * ONGLET 11 — Canaux & Connecteurs
 * Configuration des passerelles SMS, WhatsApp, Email, et Push.
 */

'use client';

import { useState } from 'react';
import { 
  Wifi, 
  Settings, 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Bell,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChannelConnectors() {
  const [channels] = useState([
    { id: 'CH-001', name: 'Passerelle SMS (Twilio)', type: 'SMS', status: 'ONLINE', cost: '0.04€/msg', default: true, icon: MessageSquare },
    { id: 'CH-002', name: 'WhatsApp Business API', type: 'WHATSAPP', status: 'ONLINE', cost: '0.02€/msg', default: true, icon: Smartphone },
    { id: 'CH-003', name: 'Serveur SMTP (SendGrid)', type: 'EMAIL', status: 'ONLINE', cost: 'Gratuit', default: true, icon: Mail },
    { id: 'CH-004', name: 'Notifications Push', type: 'PORTAIL', status: 'DEGRADED', cost: 'Gratuit', default: true, icon: Bell },
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex items-center justify-between">
        <div className="relative z-10">
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
            <Wifi className="w-6 h-6 text-emerald-400" /> Connecteurs & Omnicanalité
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Gestion des fournisseurs d'envoi. Academia Helm bascule automatiquement en cas de panne d'un canal (Fallback).
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold transition-colors border border-emerald-500/30">
          <RefreshCw className="w-4 h-4" /> Tester Connexions
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {channels.map((channel) => (
          <div key={channel.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between group hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center border",
                  channel.type === 'SMS' ? "bg-blue-50 border-blue-100 text-blue-600" :
                  channel.type === 'WHATSAPP' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : 
                  channel.type === 'EMAIL' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-violet-50 border-violet-100 text-violet-600"
                )}>
                  <channel.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{channel.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{channel.type}</span>
                    {channel.default && (
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">Par défaut</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1",
                channel.status === 'ONLINE' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}>
                {channel.status === 'ONLINE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {channel.status}
              </span>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Coût est. : <strong className="text-slate-900">{channel.cost}</strong></span>
              </div>
              <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
