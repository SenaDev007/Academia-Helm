/**
 * GradeEntrySecure Component
 * 
 * Interface sécurisée de saisie des notes avec support de l'anonymat (Codes Secrets).
 */

'use client';

import { useState } from 'react';
import { 
  Lock, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Save,
  Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GradeEntrySecure() {
  const [anonymityEnabled, setAnonymityEnabled] = useState(true);
  const [grades] = useState([
    { id: 'S-001', student: anonymityEnabled ? 'CODE-8842' : 'Jean-Luc Koné', class: 'Terminale C', status: 'DRAFT', grade: '' },
    { id: 'S-002', student: anonymityEnabled ? 'CODE-1293' : 'Marie-Ange Kouassi', class: 'Terminale C', status: 'VALIDATED', grade: '15.5' },
    { id: 'S-003', student: anonymityEnabled ? 'CODE-5501' : 'Bakayoko Idriss', class: 'Terminale C', status: 'PENDING', grade: '09.25' },
  ]);

  return (
    <div className="space-y-6">
      {/* Security Banner */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-emerald-500 text-white rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
           </div>
           <div>
              <h3 className="text-sm font-black text-emerald-900 uppercase tracking-tighter">Session de Saisie Sécurisée</h3>
              <p className="text-xs text-emerald-700">Toutes les modifications sont tracées par ORION VIGILANCE.</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anonymat</span>
              <button 
                onClick={() => setAnonymityEnabled(!anonymityEnabled)}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-all duration-300",
                  anonymityEnabled ? "bg-emerald-500" : "bg-slate-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
                  anonymityEnabled ? "right-1" : "left-1"
                )} />
              </button>
           </div>
           <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all">
              <Save className="w-4 h-4" /> Valider tout
           </button>
        </div>
      </div>

      {/* Grade Entry Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <h4 className="font-bold text-slate-900">Matière : Physique-Chimie</h4>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">Tle C</span>
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                  <Printer className="w-4 h-4" />
               </button>
               <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                  <Filter className="w-4 h-4" />
               </button>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="bg-slate-50">
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identifiant / Élève</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Note (/20)</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Appréciation</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                     <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {grades.map((g) => (
                     <tr key={g.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              {anonymityEnabled ? <Lock className="w-3 h-3 text-amber-500" /> : null}
                              <p className={cn("text-sm font-bold", anonymityEnabled ? "text-amber-600 italic" : "text-slate-900")}>
                                 {g.student}
                              </p>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <input 
                              defaultValue={g.grade}
                              placeholder="00.00"
                              className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                           />
                        </td>
                        <td className="px-6 py-4">
                           <input 
                              placeholder="Ajouter une appréciation..."
                              className="w-full min-w-[200px] px-3 py-2 bg-transparent text-sm text-slate-600 focus:outline-none placeholder:text-slate-300"
                           />
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              g.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600" :
                              g.status === 'DRAFT' ? "bg-slate-50 text-slate-500" : "bg-amber-50 text-amber-600"
                           )}>
                              {g.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button className="p-2 text-slate-300 hover:text-emerald-600 transition-colors">
                              <CheckCircle2 className="w-4 h-4" />
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
