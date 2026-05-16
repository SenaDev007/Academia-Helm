/**
 * OrionCommunication Component
 * 
 * ONGLET 15 — ORION Communication
 * Moteur IA de détection d'anomalies et d'optimisation des flux de communication.
 */

'use client';

import { 
  ShieldCheck, 
  BrainCircuit, 
  AlertTriangle, 
  TrendingUp, 
  Zap,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrionCommunication() {
  const alerts = [
    { id: 'ORA-001', level: 'HIGH', message: 'Taux de rebond anormal (12%) sur la campagne "Relance T2". Veuillez vérifier la liste de diffusion.', time: 'Il y a 2 heures' },
    { id: 'ORA-002', level: 'MEDIUM', message: '7 familles n\'ont ouvert aucune communication sur les 30 derniers jours.', time: 'Hier' },
    { id: 'ORA-003', level: 'LOW', message: 'Heure d\'envoi optimisée : L\'engagement maximal est observé le mardi entre 18h et 19h.', time: 'Il y a 3 jours' },
  ];

  const orionStats = [
    { label: 'Indice de Fiabilité', value: '99.8%', desc: 'Base de données', icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'Comportements Anormaux', value: '2', desc: 'Détectés ce mois', icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Optimisations IA', value: '14', desc: 'Heures d\'envoi ajustées', icon: TrendingUp, color: 'text-violet-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero ORION */}
      <div className="bg-slate-950 rounded-[2.5rem] p-10 text-white relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex items-start gap-6">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex-shrink-0">
            <BrainCircuit className="w-10 h-10 text-violet-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Bot className="w-3 h-3" /> Moteur Actif
            </p>
            <h2 className="text-3xl font-black tracking-tighter leading-none">ORION Communication Vanguard</h2>
            <p className="text-slate-400 text-sm mt-3 max-w-xl leading-relaxed">
              Le moteur d'intelligence ORION analyse en temps réel les flux de communication pour détecter les familles déconnectées, prévenir les défaillances de livraison et optimiser les taux d'ouverture.
            </p>
          </div>
        </div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 100% 100%, #8b5cf6 0, transparent 50%)' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI ORION */}
        <div className="space-y-6 lg:col-span-1">
          {orionStats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={cn("p-4 rounded-2xl bg-slate-50 border border-slate-100", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                <p className="text-xs font-bold text-slate-900">{stat.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Intelligence Feed */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h3 className="font-black text-slate-900 flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-amber-500" /> Recommandations & Alertes ORION
          </h3>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className={cn(
                "p-5 rounded-2xl border flex items-start gap-4 transition-all hover:shadow-md",
                alert.level === 'HIGH' ? "bg-rose-50/50 border-rose-200" :
                alert.level === 'MEDIUM' ? "bg-amber-50/50 border-amber-200" : "bg-emerald-50/50 border-emerald-200"
              )}>
                <div className={cn(
                  "p-2 rounded-xl mt-0.5",
                  alert.level === 'HIGH' ? "bg-rose-100 text-rose-600" :
                  alert.level === 'MEDIUM' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  {alert.level === 'HIGH' ? <AlertTriangle className="w-4 h-4" /> :
                   alert.level === 'MEDIUM' ? <Users className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 leading-snug">{alert.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">{alert.time}</p>
                    {alert.level === 'HIGH' && (
                      <button className="text-[10px] font-black text-rose-600 uppercase hover:underline">
                        Investiguer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
