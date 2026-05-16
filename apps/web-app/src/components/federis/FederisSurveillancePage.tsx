/**
 * FederisSurveillancePage Component
 * 
 * Surveillance & Intégrité des Examens en Temps Réel
 * Module 10 de l'infrastructure Academia Federis
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Incident {
  id: string;
  center: string;
  type: 'FRAUD' | 'LOGISTIC' | 'HEALTH' | 'SECURITY';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  time: string;
}

export default function FederisSurveillancePage() {
  const [incidents, setIncidents] = useState<Incident[]>([
    { id: '1', center: 'Lycée Coulibaly', type: 'FRAUD', status: 'INVESTIGATING', time: '10:45' },
    { id: '2', center: 'Collège St Joseph', type: 'LOGISTIC', status: 'OPEN', time: '11:12' },
    { id: '3', center: 'EPC Littoral', type: 'HEALTH', status: 'RESOLVED', time: '09:30' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Real-Time Monitoring */}
      <div className="bg-red-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
                    LIVE : Session Juin 2024
                 </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-2">Vigilance Surveillance</h1>
              <p className="text-red-100/70 font-medium max-w-xl">
                Suivi centralisé des incidents, fraudes et besoins logistiques dans tous les centres d'examen nationaux.
              </p>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
                 <p className="text-2xl font-black text-white">42</p>
                 <p className="text-[9px] font-bold text-red-200 uppercase tracking-widest">Centres Actifs</p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
                 <p className="text-2xl font-black text-red-300">03</p>
                 <p className="text-[9px] font-bold text-red-200 uppercase tracking-widest">Alertes Ouvertes</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Flux d'incidents */}
         <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Journal des Incidents</h3>
               <button className="text-[10px] font-black text-red-600 uppercase tracking-widest underline">Actualiser le flux</button>
            </div>
            
            <div className="divide-y divide-gray-50">
               {incidents.map(incident => (
                 <div key={incident.id} className="p-8 flex items-center justify-between hover:bg-red-50/30 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "w-14 h-14 rounded-2xl flex items-center justify-center font-black",
                         incident.type === 'FRAUD' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                       )}>
                          <AppIcon name="warning" size="dashboard" />
                       </div>
                       <div>
                          <div className="flex items-center gap-3">
                             <h4 className="text-lg font-black text-gray-900">{incident.center}</h4>
                             <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase tracking-widest">{incident.time}</span>
                          </div>
                          <p className="text-xs font-bold text-gray-400 mt-1">
                             Type : <span className="text-gray-600">{incident.type === 'FRAUD' ? 'Tentative de Fraude' : 'Incident Logistique'}</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                         incident.status === 'OPEN' ? "bg-red-900 text-white" : "bg-blue-50 text-blue-700"
                       )}>
                          {incident.status === 'OPEN' ? 'Urgent' : 'En cours'}
                       </div>
                       <button className="px-6 py-3 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 shadow-sm transition-all">
                          Détails
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* ORION Surveillance Insights */}
         <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-blue-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">ORION Watchtower</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Analyse de Risque</h4>
                  <p className="text-xs text-blue-100/70 leading-relaxed font-medium">
                     "Le centre **Lycée Coulibaly** présente un écart de présence de **-12%** par rapport à la session 2023. ORION recommande une inspection inopinée."
                  </p>
                  <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-blue-300 uppercase">Indice d'Intégrité</span>
                     <span className="text-xs font-black text-green-400">92/100</span>
                  </div>
               </div>
            </div>

            <button className="w-full py-6 bg-white border-2 border-dashed border-gray-200 rounded-[2.5rem] text-center group hover:border-red-200 hover:bg-red-50 transition-all">
               <AppIcon name="warning" size="dashboard" className="text-gray-300 group-hover:text-red-400 mx-auto mb-3" />
               <p className="text-[10px] font-black text-gray-400 group-hover:text-red-900 uppercase tracking-widest">Signaler un Incident Global</p>
            </button>
         </div>
      </div>
    </div>
  );
}
