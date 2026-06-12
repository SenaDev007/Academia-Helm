/**
 * CommAnalytics Component
 * 
 * ONGLET 13 — Rapports & Analytique
 * Graphiques et statistiques des performances de communication.
 */

'use client';

import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Smartphone, 
  Mail, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommAnalytics() {
  const metrics = [
    { label: 'Taux de Lecture Global', value: '82%', trend: '+5%', positive: true, icon: BarChart3 },
    { label: 'Messages Délivrés', value: '14,520', trend: '+12%', positive: true, icon: TrendingUp },
    { label: 'Familles Injoignables', value: '12', trend: '-2', positive: true, icon: Users },
    { label: 'Échecs d\'Envoi (Bounce)', value: '45', trend: '+15', positive: false, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-violet-400" /> Analytique des Communications
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Performance des campagnes, taux d'engagement et santé de la base de données.
            </p>
          </div>
          <select className="px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white outline-none">
            <option className="text-slate-900">30 derniers jours</option>
            <option className="text-slate-900">Ce trimestre</option>
            <option className="text-slate-900">Cette année</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
                <m.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded-md",
                m.positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {m.trend}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900">{m.value}</p>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canaux Performants */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-500" /> Performance par Canal
          </h3>
          <div className="space-y-6">
            {[
              { name: 'WhatsApp', value: 85, icon: Smartphone, color: 'bg-emerald-500' },
              { name: 'Portail (Push)', value: 72, icon: BellIcon, color: 'bg-violet-500' },
              { name: 'SMS', value: 98, icon: MessageSquareIcon, color: 'bg-blue-500' },
              { name: 'Email', value: 45, icon: Mail, color: 'bg-amber-500' },
            ].map((c, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <c.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">{c.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{c.value}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", c.color)} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cibles Injoignables */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" /> Top Cibles Injoignables (Défaut de contact)
          </h3>
          <div className="divide-y divide-slate-100">
            {[
              { name: 'Famille Sylla', error: 'Numéro invalide', lastTry: 'Il y a 2 jours' },
              { name: 'Famille Bamba', error: 'Email rebondi (Bounce)', lastTry: 'Il y a 3 jours' },
              { name: 'Koffi Marie (Tle C)', error: 'Application non installée', lastTry: 'Semaine dernière' },
            ].map((err, i) => (
              <div key={i} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-slate-900">{err.name}</p>
                  <p className="text-xs text-rose-600 mt-0.5">{err.error}</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{err.lastTry}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl transition-colors">
            Voir le rapport complet
          </button>
        </div>
      </div>
    </div>
  );
}

function BellIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
}

function MessageSquareIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
