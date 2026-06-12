/**
 * AutoNotifications Component
 * 
 * ONGLET 4 — Notifications Automatiques
 * Gestion des triggers (paiement, absence, notes) et des canaux associés.
 */

'use client';

import { useState } from 'react';
import { 
  Bell, 
  Settings,
  Activity,
  CreditCard,
  GraduationCap,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AutoNotifications() {
  const triggers = [
    { id: 'TRG-001', name: 'Absence Élève', module: 'DISCIPLINE', icon: Users, active: true, channels: ['SMS', 'PUSH'] },
    { id: 'TRG-002', name: 'Paiement Reçu', module: 'FINANCE', icon: CreditCard, active: true, channels: ['EMAIL', 'WHATSAPP'] },
    { id: 'TRG-003', name: 'Nouvelle Note', module: 'PEDAGOGY', icon: GraduationCap, active: false, channels: ['PUSH'] },
    { id: 'TRG-004', name: 'Retard Paiement', module: 'FINANCE', icon: CreditCard, active: true, channels: ['SMS', 'EMAIL'] },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter">Moteur de Notifications</h2>
              <p className="text-slate-400 text-sm">Automatisation des alertes liées aux événements académiques et financiers.</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {triggers.map((trg) => (
          <div key={trg.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                <trg.icon className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{trg.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trg.module}</span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <div className="flex gap-1">
                    {trg.channels.map(c => (
                      <span key={c} className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                trg.active ? "bg-emerald-500" : "bg-slate-200"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                  trg.active ? "right-1" : "left-1"
                )} />
              </button>
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
