/**
 * FederisCandidatesPage Component
 * 
 * Fichier National des Candidats aux Examens
 * Module 8 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Candidate {
  id: string;
  name: string;
  school: string;
  exam: string;
  matricule: string;
  status: 'VALIDATED' | 'PENDING' | 'REJECTED';
}

export default function FederisCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: 'Alice Mensah', school: 'Lycée Technique', exam: 'BAC D', matricule: 'FF-2024-001', status: 'VALIDATED' },
    { id: '2', name: 'Koffi Zinsou', school: 'Collège St Joseph', exam: 'BEPC', matricule: 'FF-2024-085', status: 'PENDING' },
    { id: '3', name: 'Yawa Lawson', school: 'Lycée de l\'Excellence', exam: 'BAC C', matricule: 'FF-2024-122', status: 'VALIDATED' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Premium Candidates */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black mb-2 italic tracking-tighter">Fichier National Candidats</h1>
            <p className="text-blue-100/70 font-medium max-w-xl">
              Consultez et validez les inscriptions aux examens nationaux remontées par les établissements du réseau.
            </p>
          </div>
          
          <div className="flex gap-4">
             <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                <p className="text-2xl font-black">15.4k</p>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Inscriptions</p>
             </div>
             <button className="p-5 bg-white text-blue-900 rounded-2xl shadow-xl hover:bg-blue-50 transition-all">
                <AppIcon name="print" size="dashboard" />
             </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
           <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre de Candidature 2024</h3>
           <div className="flex items-center space-x-3">
              <input type="text" placeholder="Rechercher par matricule..." className="pl-6 pr-12 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold w-64 focus:ring-2 focus:ring-blue-900 transition-all" />
           </div>
        </div>

        <div className="divide-y divide-gray-50">
           {candidates.map(candidate => (
             <div key={candidate.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                <div className="flex items-center space-x-6">
                   <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-900 text-xl group-hover:bg-blue-900 group-hover:text-white transition-all shadow-sm">
                      {candidate.name[0]}
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-gray-900">{candidate.name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                         {candidate.matricule} • <span className="text-blue-600">{candidate.school}</span>
                      </p>
                   </div>
                </div>

                <div className="flex items-center space-x-8">
                   <div className="text-right">
                      <p className="text-sm font-black text-gray-900">{candidate.exam}</p>
                      <div className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block mt-1",
                        candidate.status === 'VALIDATED' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                         {candidate.status === 'VALIDATED' ? 'Validé' : 'À vérifier'}
                      </div>
                   </div>
                   <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-blue-900 hover:bg-blue-50 transition-all shadow-sm">
                      <AppIcon name="eye" size="submenu" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
