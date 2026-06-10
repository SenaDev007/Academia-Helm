/**
 * ============================================================================
 * QHSE RISKS & PREVENTION
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, Activity, ArrowUpRight, Zap, Droplets, Flame, Users, Lock, MoreVertical } from 'lucide-react';

export default function QHSERisks() {
  const risks = [
    { id: 1, title: 'Risque Incendie', category: 'SECURITE', criticite: 'ELEVE', probability: 2, impact: 5, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 2, title: 'Intoxication Alimentaire', category: 'HYGIENE', criticite: 'MOYEN', probability: 2, impact: 4, icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 3, title: 'Court-circuit électrique', category: 'INFRA', criticite: 'CRITIQUE', probability: 3, impact: 5, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 4, title: 'Intrusion malveillante', category: 'SECURITE', criticite: 'MOYEN', probability: 1, impact: 5, icon: Lock, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Risk Matrix Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Matrice de Criticité</h4>
            <div className="aspect-square grid grid-cols-5 grid-rows-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => {
                const x = i % 5;
                const y = Math.floor(i / 5);
                const isCritical = x + (4 - y) >= 6;
                const isHigh = x + (4 - y) >= 4 && !isCritical;
                return (
                  <div key={i} className={`rounded-sm transition-all hover:scale-110 cursor-help ${
                    isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-400' : 'bg-emerald-400'
                  } opacity-40 hover:opacity-100`} title={`Impact: ${x + 1}, Proba: ${5 - y}`} />
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-rose-500" /> Critique
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-amber-400" /> Élevé
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400" /> Modéré
              </div>
            </div>
          </div>
        </div>

        {/* Risk Cards */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {risks.map((risk, i) => (
              <motion.div
                key={risk.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className={`p-4 rounded-2xl ${risk.bg} ${risk.color}`}>
                    <risk.icon className="w-8 h-8" />
                  </div>
                  <button className="p-2 hover:bg-slate-50 rounded-xl">
                    <MoreVertical className="w-5 h-5 text-slate-300" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tighter leading-tight">{risk.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{risk.category}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Proba</p>
                        <p className="text-sm font-black text-slate-900">{risk.probability}/5</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Impact</p>
                        <p className="text-sm font-black text-slate-900">{risk.impact}/5</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      risk.criticite === 'CRITIQUE' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 
                      risk.criticite === 'ELEVE' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {risk.criticite}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
