/**
 * ============================================================================
 * QHSE PERIODIC CONTROLS
 * ============================================================================
 * Note: utilise l'endpoint qhse/audits (filtre type=periodic) faute d'endpoint dédié.
 */

'use client';

import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, RefreshCw, CheckCircle2, AlertTriangle, User, MoreVertical, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ControlItem {
  id: string | number;
  title?: string;
  name?: string;
  frequency?: string;
  lastCheck?: string;
  lastCheckedAt?: string;
  nextCheck?: string;
  nextDueDate?: string;
  status?: string;
  responsible?: string;
  assignee?: string;
}

export default function QHSEPeriodicControls() {
  const { academicYear } = useModuleContext();
  const { data: controls, loading, error } = useModulesList<ControlItem>('qhse', 'audits', academicYear?.id, { type: 'periodic' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des contrôles périodiques...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <RefreshCw className="w-6 h-6 mr-3 text-amber-600" /> Contrôles Périodiques
          </h3>
          <p className="text-slate-500 text-sm font-medium">Programmation des inspections récurrentes obligatoires.</p>
        </div>
        <button
          onClick={() => alert('Bientôt disponible')}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-slate-800 transition-all"
        >
          Programmer un Contrôle
        </button>
      </div>

      {controls.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucun contrôle périodique pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {controls.map((control, i) => {
            const title = control.title || control.name || 'Contrôle';
            const frequency = control.frequency || 'PONCTUEL';
            const lastCheck = control.lastCheck || (control.lastCheckedAt ? new Date(control.lastCheckedAt).toLocaleDateString('fr-FR') : '—');
            const nextCheck = control.nextCheck || control.nextDueDate || '—';
            const status = control.status || 'OK';
            const responsible = control.responsible || control.assignee || '—';
            return (
              <motion.div
                key={control.id ?? i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-lg transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${
                      status === 'RETARD' || status === 'LATE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                    } group-hover:scale-110 transition-transform`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tight">{title}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fréquence : {frequency}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    status === 'RETARD' || status === 'LATE' ? 'bg-rose-600 text-white' : 
                    status === 'AUJOURD_HUI' || status === 'TODAY' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dernier passage</p>
                    <p className="text-xs font-black text-slate-900">{lastCheck}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Prochain passage</p>
                    <p className="text-xs font-black text-slate-900 flex items-center gap-2">
                      {nextCheck}
                      {(status === 'AUJOURD_HUI' || status === 'TODAY') && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border-2 border-white shadow-sm">
                      {responsible[0]}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{responsible}</p>
                  </div>
                  <button className="px-4 py-2 bg-slate-50 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Valider
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
