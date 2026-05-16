/**
 * FederisGradingPage Component
 * 
 * Saisie des Notes & Gestion de l'Anonymat
 * Module 13 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface MarkEntry {
  id: string;
  anonymatCode: string;
  subject: string;
  mark?: number;
  status: 'PENDING' | 'ENTERED' | 'VALIDATED';
}

export default function FederisGradingPage() {
  const [entries, setEntries] = useState<MarkEntry[]>([
    { id: '1', anonymatCode: 'AN-24-001', subject: 'Mathématiques', status: 'PENDING' },
    { id: '2', anonymatCode: 'AN-24-002', subject: 'Mathématiques', mark: 14.5, status: 'VALIDATED' },
    { id: '3', anonymatCode: 'AN-24-003', subject: 'Mathématiques', mark: 11, status: 'ENTERED' },
    { id: '4', anonymatCode: 'AN-24-004', subject: 'Mathématiques', status: 'PENDING' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Marks Entry */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full -mr-24 -mt-24" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <AppIcon name="document" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 tracking-tighter italic">Saisie des Notes Nationales</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Interface de saisie hautement sécurisée avec gestion de l'anonymat. Les notes sont cryptées et validées par double saisie.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-indigo-900 tracking-tighter">84.2%</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taux de Saisie</p>
          </div>
          <button className="px-6 py-3 bg-indigo-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-indigo-800 transition-all">
            Valider le Lot (Batch)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Sidebar Filtres */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Configuration</h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Centre de Correction</label>
                     <select className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold p-3 focus:ring-2 focus:ring-indigo-900 transition-all">
                        <option>Lycée de l'Excellence</option>
                        <option>Lycée Coulibaly</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Matière</label>
                     <select className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold p-3 focus:ring-2 focus:ring-indigo-900 transition-all">
                        <option>Mathématiques</option>
                        <option>Français</option>
                        <option>Anglais</option>
                     </select>
                  </div>
                  <div className="pt-4">
                     <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-indigo-900 rounded border-gray-300 focus:ring-indigo-900" defaultChecked />
                        <span className="text-[11px] font-bold text-gray-600 uppercase">Double Saisie Active</span>
                     </label>
                  </div>
               </div>
            </div>

            <div className="bg-indigo-900 p-8 rounded-3xl text-white">
               <div className="flex items-center space-x-3 mb-4">
                  <AppIcon name="warning" size="menu" className="text-indigo-300" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-200">Alerte Intégrité</h4>
               </div>
               <p className="text-[11px] text-indigo-100/70 leading-relaxed font-medium">
                  Les écarts entre les deux saisies sont signalés en rouge. Le superviseur doit arbitrer toute différence &gt; 0.5 point.
               </p>
            </div>
         </div>

         {/* Liste de saisie */}
         <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre de Saisie (Anonymat)</h3>
               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  42 entrées en attente
               </div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {entries.map(entry => (
                 <div key={entry.id} className="p-8 flex items-center justify-between hover:bg-indigo-50/20 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-900 text-lg group-hover:bg-indigo-900 group-hover:text-white transition-all shadow-sm">
                          {entry.anonymatCode.split('-').pop()}
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900 tracking-tighter">{entry.anonymatCode}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             Code Barre Scandinave • <span className="text-indigo-600">{entry.subject}</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-8">
                       <div className="relative w-24">
                          <input 
                            type="number" 
                            defaultValue={entry.mark}
                            placeholder="00.00"
                            className="w-full bg-gray-100 border-none rounded-xl text-center font-black text-xl py-3 focus:ring-4 focus:ring-indigo-900/10 focus:bg-white transition-all"
                          />
                       </div>
                       <div className={cn(
                         "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                         entry.status === 'VALIDATED' ? "bg-green-100 text-green-700" : 
                         entry.status === 'ENTERED' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
                       )}>
                          {entry.status === 'VALIDATED' ? 'Validé' : entry.status === 'ENTERED' ? 'Saisi' : 'En attente'}
                       </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
