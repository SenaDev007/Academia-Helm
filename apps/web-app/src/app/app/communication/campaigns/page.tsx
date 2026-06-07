'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Users,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Mail,
  MessageSquare,
  Zap
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function SchedulingPage() {
  const { academicYear } = useModuleContext();
  const [scheduledItems, setScheduledItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulation of fetching scheduled campaigns
    setTimeout(() => {
      setScheduledItems([
        { id: 1, title: 'Rappel Frais Scolaires T2', channel: 'SMS', date: '2026-05-15', time: '09:00', target: 'Parents (Arriérés)', status: 'PENDING' },
        { id: 2, title: 'Annonce Conseil de Classe', channel: 'PORTAL', date: '2026-05-18', time: '14:00', target: 'Enseignants', status: 'PENDING' },
        { id: 3, title: 'Newsletter Mensuelle Mai', channel: 'EMAIL', date: '2026-05-30', time: '10:00', target: 'Tous les Parents', status: 'DRAFT' },
      ]);
      setIsLoading(false);
    }, 1000);
  }, [academicYear]);

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header with Calendar Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Planification</h3>
              <p className="text-slate-500 text-sm font-medium">Campagnes et messages programmés</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft size={20} /></button>
            <span className="px-4 font-bold text-slate-700">Mai 2026</span>
            <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight size={20} /></button>
          </div>

          <button className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95">
            <Plus size={18} />
            Programmer un envoi
          </button>
        </div>

        {/* Timeline View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
              <Clock size={14} className="text-blue-600" /> Prochainement
            </h4>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 bg-white rounded-3xl animate-pulse border border-slate-100" />
              ))
            ) : scheduledItems.length > 0 ? (
              scheduledItems.map((item) => (
                <div key={item.id} className="group bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black uppercase opacity-60">MAI</span>
                      <span className="text-xl font-black leading-none">{item.date.split('-')[2]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{item.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          {item.channel === 'SMS' && <Smartphone size={14} />}
                          {item.channel === 'EMAIL' && <Mail size={14} />}
                          {item.channel === 'PORTAL' && <Users size={14} />}
                          {item.channel}
                        </span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full" />
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Clock size={14} /> {item.time}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                      item.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.status}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Dest. : {item.target}</p>
                  </div>

                  <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400">
                    <MoreVertical size={20} />
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl py-20 text-center border border-dashed border-slate-200">
                <CalendarIcon size={48} className="mx-auto mb-4 text-slate-200" />
                <h3 className="text-xl font-bold text-slate-900">Rien de prévu</h3>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto">Aucune communication n'est programmée pour les prochains jours.</p>
              </div>
            )}
          </div>

          {/* Quick Stats / Calendar Mini */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap size={100} className="text-yellow-400" />
              </div>
              <h4 className="text-xl font-black mb-6 relative z-10">Résumé Mai</h4>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Total programmés</span>
                  <span className="font-black text-2xl">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Canal favori</span>
                  <span className="font-black text-emerald-400 uppercase tracking-widest text-xs">SMS</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-blue-500 w-[65%]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4 tracking-tight">Conseils SARA</h4>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                  <AlertCircle size={18} className="text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    Programmez vos rappels de paiement entre 09h et 11h pour un meilleur taux de conversion.
                  </p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <Clock size={18} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Vous avez 3 messages prévus le même jour (15 Mai). Attention à ne pas saturer vos destinataires.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}

