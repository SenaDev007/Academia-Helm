/**
 * MessageTemplates Component
 * 
 * ONGLET 6 — Modèles de messages
 * Standardisation et gestion des gabarits de communication.
 */

'use client';

import { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  MessageSquare,
  Mail,
  Smartphone,
  MoreVertical,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MessageTemplates() {
  const [templates] = useState([
    { id: 'TPL-001', name: 'Alerte Absence', category: 'DISCIPLINE', channel: 'SMS', variables: ['{{studentName}}', '{{date}}', '{{schoolName}}'] },
    { id: 'TPL-002', name: 'Relance Facture', category: 'FINANCE', channel: 'EMAIL', variables: ['{{parentName}}', '{{amount}}', '{{dueDate}}', '{{paymentLink}}'] },
    { id: 'TPL-003', name: 'Disponibilité Bulletin', category: 'ACADEMIC', channel: 'WHATSAPP', variables: ['{{studentName}}', '{{period}}', '{{portalLink}}'] },
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
          <input placeholder="Rechercher un modèle..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/20">
          <Plus className="w-4 h-4" /> Créer un Modèle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => {
          const Icon = channelIcons[tpl.channel] || FileText;
          return (
            <div key={tpl.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl flex items-center justify-center",
                    tpl.channel === 'SMS' ? "bg-blue-50 text-blue-600" :
                    tpl.channel === 'WHATSAPP' ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                    {tpl.category}
                  </span>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <h4 className="font-bold text-slate-900">{tpl.name}</h4>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <Code className="w-3 h-3" /> Variables Utilisées
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.variables.map((v, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
