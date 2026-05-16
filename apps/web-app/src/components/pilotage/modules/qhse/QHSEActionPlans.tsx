/**
 * ============================================================================
 * QHSE ACTION PLANS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, User, AlertTriangle, ArrowRight, MoreVertical, Plus, Filter, LayoutGrid, List } from 'lucide-react';

export default function QHSEActionPlans() {
  const plans = [
    { id: 1, title: 'Renforcement Clôture Sud', origin: 'Risque Intrusion', responsible: 'M. Diallo', priority: 'HAUTE', deadline: '25/05/2026', progress: 45, status: 'EN_COURS' },
    { id: 2, title: 'Remplacement Extincteurs', origin: 'Audit Sécurité', responsible: 'M. Saliou', priority: 'CRITIQUE', deadline: '18/05/2026', progress: 0, status: 'A_FAIRE' },
    { id: 3, title: 'Formation Hygiène Cuisine', origin: 'Non-conformité', responsible: 'Mme Koffi', priority: 'MOYENNE', deadline: '01/06/2026', progress: 100, status: 'TERMINE' },
    { id: 4, title: 'Installation Caméras Entrée', origin: 'Plan Sécurité', responsible: 'M. Diallo', priority: 'MOYENNE', deadline: '15/06/2026', progress: 20, status: 'EN_COURS' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <CheckCircle2 className="w-6 h-6 mr-3 text-emerald-600" /> Plans d'Action QHSE
          </h3>
          <p className="text-slate-500 text-sm font-medium">Suivi des actions correctives et préventives.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400">
            <Filter className="w-5 h-5" />
          </button>
          <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
            Nouvelle Action
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                plan.priority === 'CRITIQUE' ? 'bg-rose-50 text-rose-600' : 
                plan.priority === 'HAUTE' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {plan.priority}
              </span>
              <button className="p-1 hover:bg-slate-50 rounded-lg">
                <MoreVertical className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2">{plan.title}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Origine : {plan.origin}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-400 italic">Progression</span>
                  <span className="text-slate-900">{plan.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${
                    plan.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} style={{ width: `${plan.progress}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                    {plan.responsible[0]}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">{plan.responsible}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span className="text-[9px] font-black">{plan.deadline}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
