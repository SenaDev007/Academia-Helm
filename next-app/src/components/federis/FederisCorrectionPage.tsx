/**
 * FederisCorrectionPage Component
 * 
 * Gestion de la Correction et du Dispatching
 * Module 12 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface CorrectionBatch {
  id: string;
  subject: string;
  center: string;
  copiesCount: number;
  status: 'PENDING' | 'DISPATCHED' | 'COMPLETED';
}

export default function FederisCorrectionPage() {
  const [batches, setBatches] = useState<CorrectionBatch[]>([
    { id: '1', subject: 'Mathématiques', center: 'Centre A - Littoral', copiesCount: 1250, status: 'DISPATCHED' },
    { id: '2', subject: 'Physique', center: 'Centre B - Borgou', copiesCount: 840, status: 'PENDING' },
    { id: '3', subject: 'Français', center: 'Centre C - Ouémé', copiesCount: 2100, status: 'COMPLETED' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Correction */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-purple-900 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/20">
                <AppIcon name="document" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 tracking-tighter italic">Correction & Dispatching</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Gérez l'anonymat des copies et leur distribution vers les centres de correction nationaux. Suivez l'avancement des corrections en temps réel.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <button className="px-6 py-3 bg-purple-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-purple-800 transition-all">
            Générer Anonymats
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Lots de Copies (Batches)</h3>
               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  3 lots actifs
               </div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {batches.map(batch => (
                 <div key={batch.id} className="p-8 flex items-center justify-between hover:bg-purple-50/20 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center font-black text-purple-900 text-lg group-hover:bg-purple-900 group-hover:text-white transition-all shadow-sm">
                          {batch.subject[0]}
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900">{batch.subject}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {batch.center} • <span className="text-purple-600">{batch.copiesCount} copies</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                         batch.status === 'COMPLETED' ? "bg-green-100 text-green-700" : 
                         batch.status === 'DISPATCHED' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
                       )}>
                          {batch.status === 'COMPLETED' ? 'Terminé' : batch.status === 'DISPATCHED' ? 'Envoi Effectué' : 'En Attente'}
                       </div>
                       <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-purple-900 hover:bg-purple-50 transition-all">
                          <AppIcon name="edit" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-purple-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-purple-200">ORION Dispatch</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Optimisation des Flux</h4>
                  <p className="text-xs text-purple-100/70 leading-relaxed font-medium">
                     "Le centre de Littoral est à saturation. ORION recommande de délester 300 copies de Mathématiques vers le centre de Borgou."
                  </p>
                  <button className="mt-6 w-full py-3 bg-white text-purple-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Appliquer le délestage</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
