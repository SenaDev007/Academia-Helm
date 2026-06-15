/**
 * ParentCommunication Component
 * 
 * ONGLET 7 — Communication Parents
 * Gestion ciblée des échanges avec les responsables légaux.
 */

'use client';

import { useState } from 'react';
import { 
  Users, 
  Search, 
  Send, 
  PhoneCall, 
  MessageSquare,
  AlertTriangle,
  FileText,
  Filter,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ParentCommunication() {
  const [families] = useState([
    { id: 'FAM-001', name: 'Famille Koné', students: 'Amadou (Tle C)', phone: '+225 01020304', unread: 1, lastContact: 'Aujourd\'hui, 10:30', status: 'ACTIVE' },
    { id: 'FAM-002', name: 'Famille Diallo', students: 'Fatou (3ème A), Omar (6ème)', phone: '+225 05060708', unread: 0, lastContact: 'Hier, 15:45', status: 'ACTIVE' },
    { id: 'FAM-003', name: 'Famille Sylla', students: 'Ibrahim (Tle C)', phone: '+225 09080706', unread: 0, lastContact: '10 Mai 2026', status: 'UNREACHABLE' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher une famille, un élève..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 transition-all" />
          </div>
          <button className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
            <MessageSquare className="w-4 h-4" /> Message Groupé
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Répertoire des Familles
          </h3>
          <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black">
            1 alerte de contact
          </span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {families.map((fam) => (
            <div key={fam.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border",
                    fam.status === 'UNREACHABLE' ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-blue-50 border-blue-100 text-blue-600"
                  )}>
                    <Users className="w-6 h-6" />
                  </div>
                  {fam.unread > 0 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm">
                      {fam.unread}
                    </div>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-base">{fam.name}</h4>
                    {fam.status === 'UNREACHABLE' && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" /> Injoignable
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                    <span>Enfants : <strong className="text-slate-700">{fam.students}</strong></span>
                    <span className="flex items-center gap-1 text-slate-400"><PhoneCall className="w-3 h-3" /> {fam.phone}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernier Contact</p>
                  <p className="text-xs font-medium text-slate-700 mt-1">{fam.lastContact}</p>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Envoyer un message">
                    <Send className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Historique">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
