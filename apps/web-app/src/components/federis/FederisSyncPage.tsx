/**
 * FederisSyncPage Component
 * 
 * Monitoring de la Synchronisation Helm -> Federis
 * Module 3 de l'infrastructure Academia Federis
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface SyncLog {
  id: string;
  schoolName: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  dataPoints: number;
  lastSync: string;
  latency: string;
}

export default function FederisSyncPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation du flux de synchro
    setTimeout(() => {
      setLogs([
        { id: '1', schoolName: 'Lycée Technique de Cotonou', status: 'SUCCESS', dataPoints: 1250, lastSync: 'Il y a 2 min', latency: '450ms' },
        { id: '2', schoolName: 'Collège Notre Dame', status: 'SUCCESS', dataPoints: 840, lastSync: 'Il y a 5 min', latency: '320ms' },
        { id: '3', schoolName: 'Groupe Scolaire Les Pépites', status: 'WARNING', dataPoints: 0, lastSync: 'Il y a 12h', latency: 'Timeout' },
        { id: '4', schoolName: 'Complexe International', status: 'SUCCESS', dataPoints: 2100, lastSync: 'Il y a 1 min', latency: '1.2s' },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header Premium Sync */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="finance" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Flux de Synchronisation</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Surveillez en temps réel la remontée des données statistiques des établissements Academia Helm vers le portail Federis.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-blue-900 tracking-tighter">99.8%</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Uptime Réseau</p>
          </div>
          <button className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all">
            Lancer Sync Globale
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Live Status Table */}
         <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Terminaux de Synchro</h3>
               <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">En direct</span>
               </div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {loading ? (
                 <div className="p-20 text-center text-gray-400 font-bold">Initialisation des flux...</div>
               ) : (
                 logs.map(log => (
                   <div key={log.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all group">
                      <div className="flex items-center space-x-4">
                         <div className={cn(
                           "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                           log.status === 'SUCCESS' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                         )}>
                            <AppIcon name="building" size="dashboard" />
                         </div>
                         <div>
                            <h4 className="text-sm font-black text-gray-900 group-hover:text-blue-900 transition-colors">{log.schoolName}</h4>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{log.lastSync} • Latence: {log.latency}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-gray-900">{log.dataPoints.toLocaleString()} pts</p>
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Données Transmises</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>

         {/* ORION Sync Insights */}
         <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900 to-blue-950 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-blue-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Intelligence Synchro</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Analyse ORION</h4>
                  <p className="text-xs text-blue-100/70 leading-relaxed font-medium">
                     "ORION a détecté un ralentissement sur le nœud du Littoral. La synchronisation automatique a été routée vers le serveur de secours (Bénin-West-1)."
                  </p>
                  <div className="mt-8 pt-6 border-t border-white/10">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-300 uppercase">Intégrité Globale</span>
                        <span className="text-xs font-black">94.2%</span>
                     </div>
                     <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div className="w-[94%] h-full bg-blue-400 rounded-full" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
               <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-3">Alerte Critique</h4>
               <p className="text-xs font-medium text-amber-800 leading-relaxed">
                  L'école <strong>Groupe Scolaire Les Pépites</strong> n'a pas transmis de données depuis 12 heures. Vérifiez la connexion du serveur local.
               </p>
               <button className="mt-4 text-[10px] font-black text-amber-900 underline uppercase tracking-widest hover:text-amber-700 transition-colors">Relancer manuellement</button>
            </div>
         </div>
      </div>
    </div>
  );
}
