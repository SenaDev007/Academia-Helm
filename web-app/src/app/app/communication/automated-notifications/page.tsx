'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  Settings2, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  MousePointer2,
  BellRing,
  Code,
  Send
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function AutomationPage() {
  const [rules, setRules] = useState([
    { id: 1, name: 'Alerte Absence Immédiate', trigger: 'Student Mark Absent', action: 'Send SMS to Parent', status: 'ACTIVE', count: 124 },
    { id: 2, name: 'Rappel Facture J-5', trigger: 'Invoice Due in 5 days', action: 'Send Email', status: 'ACTIVE', count: 850 },
    { id: 3, name: 'Félicitations Notes > 16', trigger: 'Grade Published > 16', action: 'Send Portal Notification', status: 'INACTIVE', count: 0 },
    { id: 4, name: 'Alerte Retard de Paiement J+2', trigger: 'Invoice Overdue by 2 days', action: 'Send WhatsApp + SMS', status: 'ACTIVE', count: 45 },
  ]);

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"><Play size={10} fill="currentColor" /> Actif</span>;
    }
    return <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"><Pause size={10} fill="currentColor" /> Inactif</span>;
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Hero Section */}
        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
          <div className="absolute top-0 right-0 p-12 opacity-10 animate-pulse">
            <Zap size={200} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-4xl font-black mb-4 tracking-tight">Automatisation Intelligente</h3>
            <p className="text-blue-100 font-medium text-lg leading-relaxed">
              Réduisez la charge administrative en automatisant vos notifications récurrentes. Laissez le système communiquer au bon moment.
            </p>
            <div className="flex gap-4 mt-8">
              <button className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-50 transition-all">
                <Plus size={20} /> Nouvelle Règle
              </button>
              <button className="bg-blue-500/30 text-white border border-white/20 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-500/50 transition-all">
                <Settings2 size={20} /> Paramètres Globaux
              </button>
            </div>
          </div>
        </div>

        {/* Rule List */}
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
              <BellRing size={14} className="text-blue-600" /> Vos Règles Actives
            </h4>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filtrer les règles..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {rules.map((rule) => (
            <div key={rule.id} className="group bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6 flex-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${rule.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'} group-hover:scale-110 transition-transform`}>
                  <Zap size={24} fill={rule.status === 'ACTIVE' ? 'currentColor' : 'none'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h5 className="font-bold text-slate-900 text-lg">{rule.name}</h5>
                    {getStatusBadge(rule.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      <MousePointer2 size={12} className="text-blue-500" /> SI : {rule.trigger}
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      <Send size={12} className="text-emerald-500" /> ALORS : {rule.action}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 pl-6 border-l border-slate-50">
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">{rule.count}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Exécutions</p>
                </div>
                <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}

          <button className="w-full py-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100">
              <Plus size={24} />
            </div>
            Ajouter une règle d'automatisation personnalisée
          </button>
        </div>

        {/* Technical Logs / Advanced Section */}
        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Code size={20} className="text-slate-600" /> Journaux techniques d'automatisation
            </h4>
            <button className="text-xs font-bold text-slate-500 hover:text-slate-900 underline">Voir tous les logs</button>
          </div>
          <div className="space-y-3">
            {[
              { time: '10:42:01', msg: 'Règle "Alerte Absence" exécutée pour l\'élève K. Amoussou', status: 'SUCCESS' },
              { time: '09:15:34', msg: 'Règle "Rappel Facture" : 12 emails envoyés avec succès', status: 'SUCCESS' },
              { time: '08:00:12', msg: 'Erreur lors de l\'exécution de "Alerte Retard" : API Infobip non disponible', status: 'ERROR' },
            ].map((log, i) => (
              <div key={i} className="flex items-center gap-4 text-xs font-mono p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400">{log.time}</span>
                <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="flex-1 text-slate-700">{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}

