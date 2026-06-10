/**
 * ============================================================================
 * QHSE ALERTS & NOTIFICATIONS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info, Clock, Trash2, Send, Filter, Settings } from 'lucide-react';

export default function QHSEAlerts() {
  const alerts = [
    { id: 1, title: 'Accident Critique déclaré', level: 'CRITIQUE', time: 'Il y a 5min', type: 'SÉCURITÉ', message: 'Accident élève sur le terrain de sport. Évacuation demandée.' },
    { id: 2, title: 'Non-conformité majeure', level: 'IMPORTANT', time: 'Il y a 2h', type: 'HYGIÈNE', message: 'Score d\'inspection Sanitaires Bloc A : 65%. Action requise.' },
    { id: 3, title: 'Rappel Audit Périodique', level: 'INFO', time: 'Ce matin', type: 'CONFORMITÉ', message: 'L\'audit extincteurs est prévu pour demain 09:00.' },
    { id: 4, title: 'Action en retard', level: 'IMPORTANT', time: 'Hier', type: 'PLAN_ACTION', message: 'Le remplacement des extincteurs aurait dû être finalisé.' },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Bell className="w-6 h-6 mr-3 text-rose-600" /> Centre d'Alertes QHSE
          </h3>
          <p className="text-slate-500 text-sm font-medium">Alertes critiques et notifications de conformité en temps réel.</p>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400">
            <Settings className="w-5 h-5" />
          </button>
          <button className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all">
            Tout Marquer Lu
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-6 rounded-3xl border ${
              alert.level === 'CRITIQUE' ? 'bg-rose-50 border-rose-100' : 
              alert.level === 'IMPORTANT' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100 shadow-sm'
            } flex items-start gap-6 group relative overflow-hidden`}
          >
            <div className={`p-4 rounded-2xl shrink-0 ${
              alert.level === 'CRITIQUE' ? 'bg-rose-600 text-white' : 
              alert.level === 'IMPORTANT' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {alert.level === 'CRITIQUE' ? <ShieldAlert className="w-6 h-6" /> : alert.level === 'IMPORTANT' ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{alert.title}</h4>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{alert.time}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-2xl">{alert.message}</p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Source : {alert.type}</span>
                <button className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1 ml-auto">
                   Voir les détails <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            
            {alert.level === 'CRITIQUE' && (
              <div className="absolute top-0 right-0 p-2">
                <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
