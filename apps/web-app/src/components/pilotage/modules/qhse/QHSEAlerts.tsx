/**
 * ============================================================================
 * QHSE ALERTS & NOTIFICATIONS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, Info, Clock, Trash2, Send, Filter, Settings, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface AlertItem {
  id: string | number;
  title?: string;
  level?: string;
  severity?: string;
  time?: string;
  createdAt?: string;
  type?: string;
  category?: string;
  message?: string;
  description?: string;
  read?: boolean;
}

export default function QHSEAlerts() {
  const { academicYear } = useModuleContext();
  const { data: alerts, loading, error } = useModulesList<AlertItem>('qhse', 'alerts', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des alertes...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

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

      {alerts.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucune alerte QHSE pour cette année scolaire.
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, i) => {
            const level = alert.level || alert.severity || 'INFO';
            const time = alert.time || (alert.createdAt ? new Date(alert.createdAt).toLocaleString('fr-FR') : '—');
            const type = alert.type || alert.category || 'QHSE';
            const message = alert.message || alert.description || '';
            const title = alert.title || 'Alerte';
            return (
              <motion.div
                key={alert.id ?? i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-6 rounded-3xl border ${
                  level === 'CRITIQUE' || level === 'CRITICAL' ? 'bg-rose-50 border-rose-100' : 
                  level === 'IMPORTANT' || level === 'HIGH' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100 shadow-sm'
                } flex items-start gap-6 group relative overflow-hidden`}
              >
                <div className={`p-4 rounded-2xl shrink-0 ${
                  level === 'CRITIQUE' || level === 'CRITICAL' ? 'bg-rose-600 text-white' : 
                  level === 'IMPORTANT' || level === 'HIGH' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {level === 'CRITIQUE' || level === 'CRITICAL' ? <ShieldAlert className="w-6 h-6" /> : level === 'IMPORTANT' || level === 'HIGH' ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h4>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{time}</span>
                  </div>
                  {message && <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-2xl">{message}</p>}
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Source : {type}</span>
                    <button className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1 ml-auto">
                       Voir les détails <Send className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                
                {(level === 'CRITIQUE' || level === 'CRITICAL') && (
                  <div className="absolute top-0 right-0 p-2">
                    <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
