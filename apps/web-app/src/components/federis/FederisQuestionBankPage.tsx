/**
 * FederisQuestionBankPage Component
 * 
 * Banque Nationale des Épreuves & Sujets d'Examens
 * Module 9 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface QuestionPaper {
  id: string;
  subject: string;
  level: string;
  year: string;
  status: 'DRAFT' | 'VALIDATED' | 'LOCKED';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export default function FederisQuestionBankPage() {
  const [papers, setPapers] = useState<QuestionPaper[]>([
    { id: '1', subject: 'Mathématiques', level: 'BAC D', year: '2024', status: 'LOCKED', difficulty: 'HARD' },
    { id: '2', subject: 'Physique-Chimie', level: 'BAC C', year: '2024', status: 'VALIDATED', difficulty: 'MEDIUM' },
    { id: '3', subject: 'Français', level: 'BEPC', year: '2024', status: 'LOCKED', difficulty: 'MEDIUM' },
    { id: '4', subject: 'SVT', level: 'BAC D', year: '2023', status: 'LOCKED', difficulty: 'MEDIUM' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header High-Security */}
      <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-blue-950 p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400">
                    Niveau de Sécurité : Maximum
                 </div>
                 <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <h1 className="text-4xl font-black tracking-tight mb-4 italic">Banque des Épreuves</h1>
              <p className="text-gray-400 font-medium max-w-xl text-lg leading-relaxed">
                Gestion centralisée et sécurisée des sujets d'examens nationaux. Accès restreint aux inspecteurs et membres de la commission.
              </p>
           </div>
           
           <div className="flex flex-col items-end gap-3">
              <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all flex items-center gap-3">
                 <AppIcon name="plus" size="submenu" />
                 Proposer un Sujet
              </button>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Dernière modification il y a 45 min</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Sidebar Filtres */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Explorateur</h3>
               <div className="space-y-2">
                  {['Toutes les matières', 'Mathématiques', 'Sciences', 'Lettres', 'Langues'].map((f, i) => (
                    <button key={i} className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all",
                      i === 0 ? "bg-blue-900 text-white shadow-lg" : "text-gray-500 hover:bg-gray-50"
                    )}>{f}</button>
                  ))}
               </div>
            </div>

            <div className="bg-gray-900 p-8 rounded-3xl text-white">
               <div className="flex items-center space-x-3 mb-4">
                  <AppIcon name="warning" size="menu" className="text-yellow-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Alerte Intégrité</h4>
               </div>
               <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                  Tout accès aux sujets verrouillés est tracé par **ORION Integrity Guard**. Toute impression nécessite un code d'autorisation unique.
               </p>
            </div>
         </div>

         {/* Liste des épreuves */}
         <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Sujets Recensés</h3>
               <div className="flex items-center space-x-4">
                  <div className="relative">
                     <input type="text" placeholder="Rechercher..." className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-900" />
                     <AppIcon name="search" size="submenu" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
               </div>
            </div>
            
            <div className="divide-y divide-gray-50">
               {papers.map(paper => (
                 <div key={paper.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 group-hover:bg-blue-900 group-hover:text-white transition-all">
                          <AppIcon name="document" size="dashboard" />
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900">{paper.subject}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {paper.level} • Session {paper.year} • Difficulté: <span className={cn(
                               paper.difficulty === 'HARD' ? "text-red-600" : "text-amber-600"
                             )}>{paper.difficulty}</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                         paper.status === 'LOCKED' ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                       )}>
                          {paper.status === 'LOCKED' && <AppIcon name="warning" size="submenu" className="w-3 h-3" />}
                          {paper.status === 'LOCKED' ? 'Verrouillé' : 'Validé'}
                       </div>
                       <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-blue-900 hover:bg-blue-50 transition-all">
                          <AppIcon name="eye" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
