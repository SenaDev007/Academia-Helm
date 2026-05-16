/**
 * ReportCardsManagement Component
 * 
 * Gestion automatisée des bulletins et des moyennes.
 */

'use client';

import { useState } from 'react';
import { 
  Award, 
  Download, 
  FileCheck, 
  AlertCircle, 
  Filter, 
  Search,
  ChevronRight,
  Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportCardsManagement() {
  const [reportCards] = useState([
    { id: 'RC-001', student: 'Amadou Koné', class: 'Terminale C', average: 15.42, status: 'GENERATED', rank: '1er' },
    { id: 'RC-002', student: 'Saliou Diop', class: 'Terminale C', average: 14.85, status: 'VALIDATED', rank: '2ème' },
    { id: 'RC-003', student: 'Fatou Traoré', class: 'Terminale C', average: 9.12, status: 'PENDING', rank: '28ème' },
  ]);

  return (
    <div className="space-y-6">
      {/* Automation Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10">
               <h3 className="text-2xl font-black tracking-tighter">Générateur de Bulletins</h3>
               <p className="text-indigo-100 text-xs mt-1">Calcul automatique des moyennes et rangs du 2ème Trimestre.</p>
               <button className="mt-6 px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm shadow-xl shadow-indigo-900/20 hover:scale-105 transition-all">
                  Lancer la génération
               </button>
            </div>
            <Award className="w-32 h-32 text-white/10 absolute -right-4 -bottom-4 group-hover:rotate-12 transition-transform" />
         </div>

         <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
               <h3 className="text-2xl font-black tracking-tighter text-slate-900">Validation & Impression</h3>
               <p className="text-slate-400 text-xs mt-1">Générez des fichiers PDF certifiés avec QR Code pour les parents.</p>
               <div className="flex gap-2 mt-6">
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all">
                     <Printer className="w-3 h-3" /> Imprimer tout
                  </button>
                  <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">
                     Archiver
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
               <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Liste des Bulletins</h3>
               <div className="h-4 w-px bg-slate-200" />
               <p className="text-xs font-medium text-slate-400">Période : 2ème Trimestre 2025-2026</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input placeholder="Filtrer..." className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none w-40" />
               </div>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="bg-slate-50">
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rang</th>
                     <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                     <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {reportCards.map((rc) => (
                     <tr key={rc.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                           <p className="text-sm font-bold text-slate-900">{rc.student}</p>
                           <p className="text-[10px] text-slate-400">{rc.class}</p>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "text-sm font-black",
                             rc.average < 10 ? "text-rose-600" : "text-slate-900"
                           )}>
                              {rc.average.toFixed(2)}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-xs font-bold text-slate-500">{rc.rank}</span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "px-2 py-0.5 rounded-full text-[10px] font-bold",
                             rc.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600" :
                             rc.status === 'GENERATED' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                           )}>
                              {rc.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all shadow-none hover:shadow-sm">
                              <Download className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
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
