'use client';

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Globe,
  Filter,
  Download,
  Activity
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';

export default function CommunicationReportsPage() {
  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <BarChart3 className="text-blue-600" size={32} /> Rapports & Analytique
            </h3>
            <p className="text-slate-500 font-medium">Analyse stratégique de l'efficacité de vos communications.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Filter size={16} /> Période
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              <Download size={16} /> Exporter PDF
            </button>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Stat Card */}
          <div className="md:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-slate-50">
              <Activity size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Volume Total de Messages</p>
              <h4 className="text-5xl font-black text-slate-900 mb-6">4,829</h4>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg text-xs">
                  <TrendingUp size={14} /> +12%
                </span>
                <p className="text-xs text-slate-400 font-medium italic">vs mois précédent</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mt-12 pt-8 border-t border-slate-50">
              {[
                { label: 'Emails', val: '2,140', icon: <Mail size={14}/> },
                { label: 'SMS', val: '1,050', icon: <Smartphone size={14}/> },
                { label: 'WhatsApp', val: '845', icon: <MessageSquare size={14}/> },
                { label: 'Portail', val: '794', icon: <Globe size={14}/> },
              ].map((c, i) => (
                <div key={i}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1 mb-1">{c.icon} {c.label}</p>
                  <p className="text-lg font-black text-slate-900">{c.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Side Performance Card */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-2xl shadow-slate-200">
            <div>
              <h5 className="text-xl font-black mb-1">Engagement Moyen</h5>
              <p className="text-slate-400 text-xs font-medium mb-8">Taux de lecture global cumulé</p>
              <div className="relative w-32 h-32 mx-auto mb-8">
                <svg viewBox="0 0 36 36" className="w-full h-full text-blue-600">
                  <path className="text-slate-800" strokeDasharray="100, 100" strokeWidth="3" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-blue-500" strokeDasharray="85, 100" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-black">85%</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Délivrabilité</span>
                <span className="text-emerald-400 font-black">99.2%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[99%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts / Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-64 flex flex-col items-center justify-center text-slate-300">
            <BarChart3 size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-[10px]">Graphique des tendances (Atlas)</p>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-64 flex flex-col items-center justify-center text-slate-300">
            <PieChart size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-[10px]">Répartition par module source</p>
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}
