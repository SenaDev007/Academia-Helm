/**
 * FederisDeliberationsPage Component
 * 
 * Gestion des Délibérations et des Seuils d'Admission
 * Module 14 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface ExamSession {
  id: string;
  name: string;
  level: string;
  date: string;
  candidates: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export default function FederisDeliberationsPage() {
  const [sessions, setSessions] = useState<ExamSession[]>([
    { id: '1', name: 'BEPC National 2024', level: 'BEPC', date: '2024-06-12', candidates: 12500, status: 'IN_PROGRESS' },
    { id: '2', name: 'BAC National 2024', level: 'BAC', date: '2024-06-18', candidates: 8400, status: 'PENDING' },
    { id: '3', name: 'CEPD National 2024', level: 'CEPD', date: '2024-05-30', candidates: 25000, status: 'COMPLETED' },
  ]);

  const [threshold, setThreshold] = useState(10);
  const [repechage, setRepechage] = useState(9.5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Délibérations & Rachat</h1>
          <p className="text-gray-500 font-medium mt-1">Configurez les critères de succès et validez les résultats nationaux.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-5 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-blue-900/20 transition-all flex items-center gap-2">
            <AppIcon name="document" size="submenu" />
            PV de Délibération
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Paramètres de Délibération */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-8 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full" />
              Critères d'Admission
            </h3>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Moyenne Admission</label>
                  <span className="text-xl font-black text-blue-900 bg-blue-50 px-3 py-1 rounded-xl">{threshold}/20</span>
                </div>
                <input 
                  type="range" min="8" max="12" step="0.1" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-900"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Seuil de Rachat (Pêchage)</label>
                  <span className="text-xl font-black text-indigo-900 bg-indigo-50 px-3 py-1 rounded-xl">{repechage}/20</span>
                </div>
                <input 
                  type="range" min="7" max="11" step="0.1" 
                  value={repechage} 
                  onChange={(e) => setRepechage(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Calcul des Mention</h4>
                    <p className="text-[10px] text-gray-400 font-medium">Appliquer le barème standard national</p>
                  </div>
                  <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>

                <button className="w-full py-4 bg-blue-900 text-white rounded-2xl text-sm font-black shadow-xl shadow-blue-900/10 hover:bg-blue-800 transition-all">
                  Lancer la Simulation
                </button>
              </div>
            </div>
          </div>

          {/* ORION Forecast */}
          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-4">
                <AppIcon name="sparkles" size="menu" className="text-blue-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Prédiction ORION</span>
              </div>
              <h4 className="text-2xl font-black mb-2">~68.4%</h4>
              <p className="text-xs text-blue-100/70 font-medium leading-relaxed">
                Taux de réussite estimé avec un seuil à {threshold}/20. En abaissant le rachat à {repechage}/20, vous récupérez environ 450 candidats supplémentaires.
              </p>
            </div>
          </div>
        </div>

        {/* Sessions d'examens */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              Files de Délibération
            </h3>
            <div className="flex items-center space-x-2">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Filtre :</span>
               {['Tout', 'BEPC', 'BAC'].map(f => (
                 <button key={f} className={cn(
                   "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                   f === 'Tout' ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                 )}>{f}</button>
               ))}
            </div>
          </div>

          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg",
                      session.status === 'COMPLETED' ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                    )}>
                      {session.level}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 group-hover:text-indigo-900 transition-colors">{session.name}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <AppIcon name="students" size="menu" className="w-3 h-3" />
                          {session.candidates.toLocaleString()} Candidats
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                          <AppIcon name="dashboard" size="menu" className="w-3 h-3" />
                          Session {new Date(session.date).getFullYear()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block mb-1",
                        session.status === 'COMPLETED' ? "bg-green-100 text-green-700" : 
                        session.status === 'IN_PROGRESS' ? "bg-blue-100 text-blue-700 animate-pulse" : "bg-gray-100 text-gray-500"
                      )}>
                        {session.status === 'COMPLETED' ? 'Terminé' : session.status === 'IN_PROGRESS' ? 'En Cours' : 'En Attente'}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 block uppercase">
                        {session.status === 'COMPLETED' ? 'Clôturé le 25/06' : 'Démarré le 12/06'}
                      </div>
                    </div>
                    <button className={cn(
                      "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                      session.status === 'COMPLETED' ? "bg-gray-900 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                    )}>
                      {session.status === 'COMPLETED' ? 'Voir PV' : 'Délibérer'}
                    </button>
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
