/**
 * ============================================================================
 * QHSE PERIODIC CONTROLS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, RefreshCw, CheckCircle2, AlertTriangle, User, MoreVertical } from 'lucide-react';

export default function QHSEPeriodicControls() {
  const controls = [
    { id: 1, title: 'Contrôle Extincteurs', frequency: 'MENSUEL', lastCheck: '15/04/2026', nextCheck: '15/05/2026', status: 'AUJOURD_HUI', responsible: 'Sécu-Expert' },
    { id: 2, title: 'Nettoyage Cuve Eau', frequency: 'TRIMESTRIEL', lastCheck: '01/03/2026', nextCheck: '01/06/2026', status: 'OK', responsible: 'M. Saliou' },
    { id: 3, title: 'Vérification Système Alarme', frequency: 'ANNUEL', lastCheck: '10/05/2025', nextCheck: '10/05/2026', status: 'RETARD', responsible: 'Telecom-SA' },
    { id: 4, title: 'Inspection Cantine', frequency: 'HEBDOMADAIRE', lastCheck: '08/05/2026', nextCheck: '15/05/2026', status: 'AUJOURD_HUI', responsible: 'Dr. Saliou' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <RefreshCw className="w-6 h-6 mr-3 text-amber-600" /> Contrôles Périodiques
          </h3>
          <p className="text-slate-500 text-sm font-medium">Programmation des inspections récurrentes obligatoires.</p>
        </div>
        <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-slate-800 transition-all">
          Programmer un Contrôle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {controls.map((control, i) => (
          <motion.div
            key={control.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-lg transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${
                  control.status === 'RETARD' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                } group-hover:scale-110 transition-transform`}>
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{control.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fréquence : {control.frequency}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                control.status === 'RETARD' ? 'bg-rose-600 text-white' : 
                control.status === 'AUJOURD_HUI' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {control.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dernier passage</p>
                <p className="text-xs font-black text-slate-900">{control.lastCheck}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Prochain passage</p>
                <p className="text-xs font-black text-slate-900 flex items-center gap-2">
                  {control.nextCheck}
                  {control.status === 'AUJOURD_HUI' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border-2 border-white shadow-sm">
                  {control.responsible[0]}
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{control.responsible}</p>
              </div>
              <button className="px-4 py-2 bg-slate-50 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Valider
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
