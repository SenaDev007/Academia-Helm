/**
 * ============================================================================
 * QHSE ACTION PLANS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, User, AlertTriangle, ArrowRight, MoreVertical, Plus, Filter, LayoutGrid, List, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ActionPlanItem {
  id: string | number;
  title?: string;
  name?: string;
  origin?: string;
  source?: string;
  responsible?: string;
  assignee?: string;
  priority?: string;
  deadline?: string;
  dueDate?: string;
  progress?: number;
  status?: string;
}

export default function QHSEActionPlans() {
  const { academicYear } = useModuleContext();
  const { data: plans, loading, error } = useModulesList<ActionPlanItem>('qhse', 'action-plans', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des plans d'action...</span>
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

      {plans.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucun plan d'action pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
            const title = plan.title || plan.name || 'Action';
            const origin = plan.origin || plan.source || '—';
            const responsible = plan.responsible || plan.assignee || '—';
            const priority = plan.priority || 'MOYENNE';
            const deadline = plan.deadline || plan.dueDate || '—';
            const progress = plan.progress ?? 0;
            const status = plan.status || 'A_FAIRE';
            return (
              <motion.div
                key={plan.id ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    priority === 'CRITIQUE' ? 'bg-rose-50 text-rose-600' : 
                    priority === 'HAUTE' || priority === 'HIGH' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {priority}
                  </span>
                  <button className="p-1 hover:bg-slate-50 rounded-lg">
                    <MoreVertical className="w-4 h-4 text-slate-300" />
                  </button>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2">{title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Origine : {origin}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400 italic">Progression</span>
                      <span className="text-slate-900">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                        {responsible[0]}
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">{responsible}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-[9px] font-black">{deadline}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
