/**
 * FederisCompositionsPage Component
 * 
 * Suivi en Temps Réel des Compositions Nationales
 * Module 11 de l'infrastructure Academia Federis
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface CompositionLive {
  id: string;
  subject: string;
  centerCount: number;
  candidateCount: number;
  presenceRate: number;
  status: 'LIVE' | 'COMPLETED' | 'PENDING';
}

export default function FederisCompositionsPage() {
  const [compositions, setCompositions] = useState<CompositionLive[]>([
    { id: '1', subject: 'Mathématiques', centerCount: 42, candidateCount: 15420, presenceRate: 98.4, status: 'LIVE' },
    { id: '2', subject: 'Français', centerCount: 42, candidateCount: 15420, presenceRate: 99.1, status: 'COMPLETED' },
    { id: '3', subject: 'SVT', centerCount: 42, candidateCount: 15420, presenceRate: 0, status: 'PENDING' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Live Composition */}
      <div className="bg-indigo-950 p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                    Flux Live National
                 </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-2">Suivi des Compositions</h1>
              <p className="text-blue-100/70 font-medium max-w-xl">
                Monitorez en temps réel le déroulement des épreuves, le taux de présence et les incidents logistiques sur tout le territoire.
              </p>
           </div>
           
           <div className="bg-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] border border-white/10 text-center">
              <p className="text-3xl font-black text-white">98.4%</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Présence Globale</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Épreuves du Jour</h3>
               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Session Juin 2024</div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {compositions.map(comp => (
                 <div key={comp.id} className="p-8 flex items-center justify-between hover:bg-indigo-50/20 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg",
                         comp.status === 'LIVE' ? "bg-blue-900 text-white shadow-xl shadow-blue-900/20 animate-pulse" : "bg-gray-50 text-gray-400"
                       )}>
                          {comp.subject[0]}
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900 group-hover:text-blue-900 transition-colors">{comp.subject}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {comp.centerCount} Centres • {comp.candidateCount.toLocaleString()} Candidats
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-8">
                       <div className="text-right">
                          <p className={cn("text-lg font-black", comp.status === 'LIVE' ? "text-blue-600" : "text-gray-900")}>
                             {comp.presenceRate}%
                          </p>
                          <div className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block mt-1",
                            comp.status === 'LIVE' ? "bg-blue-100 text-blue-700" : 
                            comp.status === 'COMPLETED' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                          )}>
                             {comp.status === 'LIVE' ? 'En Cours' : comp.status === 'COMPLETED' ? 'Terminé' : 'En Attente'}
                          </div>
                       </div>
                       <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-blue-900 hover:bg-blue-50 transition-all">
                          <AppIcon name="eye" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
               <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center">
                     <AppIcon name="sparkles" size="menu" className="text-white" />
                  </div>
                  <h4 className="text-xs font-black text-gray-900 uppercase">Alerte Vigilance</h4>
               </div>
               <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                     <p className="text-[11px] font-bold text-red-900 leading-relaxed">
                        Retard de démarrage signalé au centre "Littoral A" pour l'épreuve de Mathématiques.
                     </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                     <p className="text-[11px] font-bold text-blue-900 leading-relaxed">
                        Livraison de copies de secours effectuée au centre "Borgou C".
                     </p>
                  </div>
               </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-8 rounded-[2.5rem] text-white">
               <h4 className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-4">ORION Live Forecast</h4>
               <p className="text-xs text-blue-100/70 leading-relaxed font-medium">
                  "Sur la base des taux de présence actuels, ORION prévoit une session BAC 2024 avec une participation record de **99.2%**."
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
