/**
 * OrionFinanceVigilance Component
 * 
 * Moteur de vigilance financière ORION.
 * Détecte les anomalies de paiement, les risques de fraude et les baisses de recouvrement.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Search, 
  Filter, 
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useModuleContext } from '@/hooks/useModuleContext';
import { orionService } from '@/services/orion.service';

export default function OrionFinanceVigilance() {
  const { academicYear } = useModuleContext();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (academicYear?.id) {
      loadAlerts();
    }
  }, [academicYear?.id]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await orionService.getAlerts({ alertType: 'FINANCIAL', academicYearId: academicYear?.id });
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Orion Header */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden border border-slate-800 shadow-2xl">
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
               <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Moteur de Vigilance ORION</span>
            </div>
            <h2 className="text-3xl font-black tracking-tighter">Vigilance Financière Live</h2>
            <p className="text-slate-400 text-sm max-w-md mt-2">Surveillance algorithmique des flux de trésorerie, détection de fraudes et analyse prédictive des impayés.</p>
         </div>
         {/* Decorative AI visual */}
         <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-20">
            <ShieldAlert className="w-40 h-40 text-blue-500" />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Alerts List */}
         <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
               <Activity className="w-4 h-4 text-blue-600" /> Journal de Vigilance
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               {alerts.map((alert, i) => (
                 <div key={i} className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-all border-b border-slate-100 last:border-0">
                    <div className={cn(
                      "p-2.5 rounded-xl",
                      alert.severity === 'CRITICAL' ? "bg-rose-50 text-rose-600" :
                      alert.severity === 'WARNING' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {alert.severity === 'CRITICAL' ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                       <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-900">{alert.type.replace('_', ' ')}</p>
                          <span className="text-[10px] font-bold text-slate-400">{alert.date}</span>
                       </div>
                       <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                       <div className="pt-2 flex gap-2">
                          <button className="text-[10px] font-bold text-blue-600 hover:underline">Investiguer</button>
                          <button className="text-[10px] font-bold text-slate-400 hover:underline">Ignorer</button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Risk Analytics */}
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-tight">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Risque d'Impayés
               </h4>
               <div className="space-y-6">
                  {[
                    { level: 'Terminale', risk: 45, color: 'text-rose-600' },
                    { level: '3ème', risk: 12, color: 'text-emerald-600' },
                    { level: '6ème', risk: 28, color: 'text-amber-600' },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <span className="text-xs font-bold text-slate-500">{r.level}</span>
                       <div className="flex items-center gap-3">
                          <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div className={cn("h-full bg-slate-900")} style={{ width: `${r.risk}%` }} />
                          </div>
                          <span className={cn("text-xs font-black w-8", r.color)}>{r.risk}%</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-xl">
               <h4 className="font-bold flex items-center gap-2 mb-2">
                 <CheckCircle2 className="w-4 h-4" /> Score de Conformité
               </h4>
               <p className="text-4xl font-black">94.8%</p>
               <p className="text-[10px] text-emerald-100 mt-2 uppercase font-bold tracking-widest">Index de Robustesse Financière</p>
            </div>
         </div>
      </div>
    </div>
  );
}
