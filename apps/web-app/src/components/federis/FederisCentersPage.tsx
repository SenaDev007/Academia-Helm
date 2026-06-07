/**
 * FederisCentersPage Component
 * 
 * Gestion des Centres d'Examen et de la Logistique
 * Module 7 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Center {
  id: string;
  name: string;
  city: string;
  capacity: number;
  assignedCandidates: number;
  status: 'READY' | 'SETUP' | 'FULL';
}

export default function FederisCentersPage() {
  const [centers, setCenters] = useState<Center[]>([
    { id: '1', name: 'Lycée Coulibaly', city: 'Cotonou', capacity: 1200, assignedCandidates: 1150, status: 'READY' },
    { id: '2', name: 'Collège Notre Dame', city: 'Cotonou', capacity: 800, assignedCandidates: 800, status: 'FULL' },
    { id: '3', name: 'Lycée de l\'Excellence', city: 'Parakou', capacity: 1500, assignedCandidates: 1200, status: 'READY' },
    { id: '4', name: 'EPC Littoral', city: 'Porto-Novo', capacity: 500, assignedCandidates: 420, status: 'SETUP' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Premium Centers */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="classes" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Cartographie des Centres</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Gérez le réseau national des centres d'examen. Optimisez l'affectation des candidats et suivez la préparation logistique.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">42</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Centres Recensés</p>
          </div>
          <button className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all">
            Ajouter un Centre
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre des Établissements d'Accueil</h3>
               <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Opérationnel</span>
               </div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {centers.map(center => (
                 <div key={center.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-900 text-lg group-hover:bg-blue-900 group-hover:text-white transition-all shadow-sm">
                          {center.city[0]}
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900">{center.name}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {center.city} • Capacité: <span className="text-blue-600">{center.capacity}</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-8">
                       <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                             <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    (center.assignedCandidates / center.capacity) > 0.9 ? "bg-red-500" : "bg-blue-500"
                                  )} 
                                  style={{ width: `${(center.assignedCandidates / center.capacity) * 100}%` }}
                                />
                             </div>
                             <span className="text-[10px] font-black text-gray-900">{Math.round((center.assignedCandidates / center.capacity) * 100)}%</span>
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{center.assignedCandidates} / {center.capacity} Candidats</p>
                       </div>
                       <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-blue-900 hover:bg-blue-50 transition-all">
                          <AppIcon name="edit" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-indigo-950 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-blue-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">ORION Logistics</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Alerte Capacité</h4>
                  <p className="text-xs text-indigo-100/70 leading-relaxed font-medium">
                     "Le centre de **Cotonou - Notre Dame** est à 100% de sa capacité. ORION suggère d'ouvrir 2 salles supplémentaires au centre voisin **Littoral**."
                  </p>
                  <button className="mt-6 w-full py-3 bg-white text-blue-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Optimiser les affectations</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
