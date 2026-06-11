/**
 * FederisResultsPage Component
 * 
 * Publication Officielle des Résultats
 * Module 15 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

export default function FederisResultsPage() {
  const [isPublished, setIsPublished] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header Results Publication */}
      <div className="bg-gradient-to-r from-green-900 to-emerald-950 p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-green-400">
                    Officiel & Certifié
                 </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-2 italic">Publication des Résultats</h1>
              <p className="text-emerald-100/70 font-medium max-w-xl">
                Portail de diffusion nationale des résultats d'examens. Diffusion multicanale (Web, SMS, Affichage).
              </p>
           </div>
           
           <button 
             onClick={() => setIsPublished(!isPublished)}
             className={cn(
               "px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center gap-3",
               isPublished ? "bg-red-600 text-white hover:bg-red-700" : "bg-white text-green-900 hover:bg-green-50"
             )}
           >
              <AppIcon name="bell" size="submenu" />
              {isPublished ? "Suspendre la Publication" : "Publier les Résultats"}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-8">Statistiques de Diffusion</h3>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <div className="text-center">
                     <p className="text-3xl font-black text-gray-900 mb-1">~250k</p>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Consultations Web</p>
                  </div>
                  <div className="text-center">
                     <p className="text-3xl font-black text-gray-900 mb-1">15.2k</p>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SMS Envoyés</p>
                  </div>
                  <div className="text-center">
                     <p className="text-3xl font-black text-green-600 mb-1">68.4%</p>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Taux de Réussite</p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-8">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 italic">Canaux de Diffusion</h3>
               <div className="space-y-4">
                  {[
                    { name: 'Portail Web Candidats', status: 'Actif', icon: 'scolarite' },
                    { name: 'Passerelle SMS Nationale', status: 'Prêt', icon: 'bell' },
                    { name: 'Application Mobile Academia', status: 'Actif', icon: 'sparkles' },
                  ].map((canal, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-green-200 transition-all">
                       <div className="flex items-center space-x-4">
                          <AppIcon name={canal.icon as any} size="menu" className="text-gray-400" />
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">{canal.name}</span>
                       </div>
                       <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-widest">{canal.status}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem]">
               <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.2em] mb-4">Vérification de Publication</h4>
               <p className="text-xs font-medium text-emerald-800 leading-relaxed mb-6">
                  Assurez-vous que tous les centres ont terminé la saisie et que les délibérations ont été officiellement signées avant de cliquer sur "Publier".
               </p>
               <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                     <div className="w-2 h-2 bg-green-500 rounded-full" />
                     <span className="text-[10px] font-bold text-emerald-900 uppercase">Saisie 100% Terminée</span>
                  </div>
                  <div className="flex items-center space-x-3">
                     <div className="w-2 h-2 bg-green-500 rounded-full" />
                     <span className="text-[10px] font-bold text-emerald-900 uppercase">PV Signés Numériquement</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
