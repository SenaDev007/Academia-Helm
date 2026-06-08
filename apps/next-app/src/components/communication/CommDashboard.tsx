/**
 * CommDashboard Component
 * 
 * Vue d'ensemble de la communication institutionnelle.
 */

'use client';

import { 
  Send, 
  MessageSquare, 
  Bell, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommDashboard() {
  const kpis = [
    { label: 'Taux de Livraison', value: '98.5%', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Taux d\'Ouverture', value: '74.2%', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Alertes ORION', value: '2', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Crédit SMS Restant', value: '12,450', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</p>
            </div>
            <div className={cn("p-4 rounded-xl transition-transform group-hover:scale-110", kpi.bg, kpi.color)}>
              <kpi.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-500" /> Activité Récente
            </h3>
            <button className="text-[10px] font-black text-violet-600 hover:underline uppercase">Voir tout</button>
          </div>
          <div className="p-0 flex-1">
            <div className="divide-y divide-slate-50">
              {[
                { title: 'Annonce Rentrée Scolaire', target: 'Tous les Parents', channel: 'Email/Push', status: 'SENT', time: '10:30' },
                { title: 'Alerte Absence : Jean Koffi', target: 'Parent de J. Koffi', channel: 'WhatsApp', status: 'DELIVERED', time: '09:15' },
                { title: 'Campagne Scolarité T2', target: 'Parents (Débiteurs)', channel: 'SMS', status: 'FAILED', time: '08:45' },
                { title: 'Note de Service RH #12', target: 'Tous les Enseignants', channel: 'Portail', status: 'READ', time: 'Hier' },
              ].map((item, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      item.status === 'SENT' ? "bg-blue-50 text-blue-600" :
                      item.status === 'DELIVERED' ? "bg-emerald-50 text-emerald-600" :
                      item.status === 'READ' ? "bg-violet-50 text-violet-600" : "bg-rose-50 text-rose-600"
                    )}>
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Pour : {item.target} · {item.channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">{item.time}</p>
                    <span className={cn(
                      "text-[10px] font-bold",
                      item.status === 'FAILED' ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channel Health */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl">
          <h3 className="font-bold flex items-center gap-2 mb-8 text-violet-400 uppercase text-xs tracking-widest">
            <Zap className="w-4 h-4" /> État des Canaux
          </h3>
          <div className="space-y-8">
            {[
              { label: 'Portail Web', status: 'ONLINE', rate: 100 },
              { label: 'WhatsApp API', status: 'ONLINE', rate: 99.8 },
              { label: 'Passerelle SMS', status: 'DEGRADED', rate: 85.5 },
              { label: 'Serveur Email', status: 'ONLINE', rate: 99.9 },
            ].map((channel, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{channel.label}</p>
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                    channel.status === 'ONLINE' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {channel.status}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      channel.status === 'ONLINE' ? "bg-emerald-500" : "bg-amber-500"
                    )} 
                    style={{ width: `${channel.rate}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
