/**
 * FinanceSimulation Component
 * 
 * Simulation de budget et prévisions financières.
 */

'use client';

import { TrendingUp, Target, Plus, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function FinanceSimulation() {
  return (
    <div className="space-y-6">
       <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
             <h2 className="text-3xl font-black tracking-tighter">Simulateur Budgétaire</h2>
             <p className="text-slate-400 text-sm max-w-md mt-2">Prévoyez l'impact d'une augmentation des frais ou d'un nouvel investissement sur votre trésorerie annuelle.</p>
          </div>
          <Calculator className="absolute top-1/2 right-8 -translate-y-1/2 w-40 h-40 text-blue-500 opacity-10" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
             <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Paramètres de Simulation</h3>
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Augmentation des Frais (%)</label>
                   <input type="range" className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-blue-600 mt-2" />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Investissement Prévu (XOF)</label>
                   <input type="number" placeholder="ex: 5,000,000" className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20">
                  Calculer l'impact
                </button>
             </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">
             <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                <Target className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">Résultat de la Simulation</p>
             <p className="text-xs text-slate-400 mt-2">Veuillez configurer les paramètres à gauche pour lancer la projection.</p>
          </div>
       </div>
    </div>
  );
}
