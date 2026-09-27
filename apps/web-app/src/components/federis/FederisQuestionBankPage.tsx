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
import { FedPage } from '@/components/federis/federis-motion';

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
    <FedPage className="space-y-8">
      {/* Header High-Security */}
      <div className="bg-gradient-to-br from-[#0b1d3a] via-[#0b1d3a] to-[#071528] p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-blue-400/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-red-400">
                    Niveau de Sécurité : Maximum
                 </div>
                 <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Banque des Épreuves</h1>
              <p className="text-blue-100/70 font-medium max-w-xl text-base leading-relaxed">
                Gestion centralisée et sécurisée des sujets d'examens nationaux. Accès restreint aux inspecteurs et membres de la commission.
              </p>
           </div>
           
           <div className="flex flex-col items-end gap-3">
              <button className="fed-btn-gold fed-btn-shimmer px-8 py-3.5 text-sm">
                 <AppIcon name="add" size="submenu" />
                 Proposer un Sujet
              </button>
              <p className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest italic">Dernière modification il y a 45 min</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Sidebar Filtres */}
         <div className="lg:col-span-1 space-y-6">
            <div className="fed-card p-8">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Explorateur</h3>
               <div className="space-y-2">
                  {['Toutes les matières', 'Mathématiques', 'Sciences', 'Lettres', 'Langues'].map((f, i) => (
                    <button key={i} className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all",
                      i === 0 ? "bg-[#0b1d3a] text-white shadow-lg" : "text-slate-500 hover:bg-[#eff6ff]"
                    )}>{f}</button>
                  ))}
               </div>
            </div>

            <div className="fed-card-dark p-8 text-white">
               <div className="flex items-center space-x-3 mb-4">
                  <AppIcon name="warning" size="menu" className="text-amber-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Alerte Intégrité</h4>
               </div>
               <p className="text-[11px] text-blue-100/60 leading-relaxed font-medium">
                  Tout accès aux sujets verrouillés est tracé par **ORION Integrity Guard**. Toute impression nécessite un code d'autorisation unique.
               </p>
            </div>
         </div>

         {/* Liste des épreuves */}
         <div className="lg:col-span-3 fed-card overflow-hidden">
            <div className="p-8 border-b border-blue-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">Sujets Recensés</h3>
               <div className="flex items-center space-x-4">
                  <div className="relative">
                     <input type="text" placeholder="Rechercher..." className="fed-input-light pl-10 pr-4 py-2 text-xs font-bold !w-auto" />
                     <AppIcon name="search" size="submenu" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
               </div>
            </div>
            
            <div className="divide-y divide-blue-50">
               {papers.map(paper => (
                 <div key={paper.id} className="p-8 flex items-center justify-between hover:bg-[#f7f9fc] transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center text-[#0b1d3a] group-hover:bg-[#0b1d3a] group-hover:text-white transition-all">
                          <AppIcon name="document" size="dashboard" />
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-[#0b1d3a]">{paper.subject}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                             {paper.level} • Session {paper.year} • Difficulté: <span className={cn(
                               paper.difficulty === 'HARD' ? "text-red-600" : "text-amber-600"
                             )}>{paper.difficulty}</span>
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-6">
                       <div className={cn(
                         "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                         paper.status === 'LOCKED' ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                       )}>
                          {paper.status === 'LOCKED' && <AppIcon name="warning" size="submenu" className="w-3 h-3" />}
                          {paper.status === 'LOCKED' ? 'Verrouillé' : 'Validé'}
                       </div>
                       <button className="p-4 bg-[#eff6ff] rounded-2xl text-[#1e3a8a] hover:bg-[#0b1d3a] hover:text-white transition-all">
                          <AppIcon name="view" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </FedPage>
  );
}
