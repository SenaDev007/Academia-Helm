/**
 * FederisSaraPage Component
 * 
 * Sara AI - Assistance Institutionnelle Intelligente
 * Module 21 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

export default function FederisSaraPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour. Je suis Sara AI, votre assistante institutionnelle Federis. Comment puis-je vous aider dans le pilotage de votre réseau aujourd\'hui ?' }
  ]);
  const [input, setInput] = useState('');

  const suggestions = [
    "Analyser les taux de réussite du BAC 2023",
    "Générer un rapport sur les retards de synchro",
    "Prédire les effectifs pour la session 2025",
    "Comparer les performances par région"
  ];

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-8">
      {/* Header Premium Sara */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
           <div className="flex items-center space-x-5">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                 <AppIcon name="sparkles" size="dashboard" className="text-purple-300 animate-pulse" />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tight">Sara AI <span className="text-purple-300">Federis</span></h1>
                 <p className="text-blue-100/70 font-medium text-sm">Intelligence augmentée pour le pilotage stratégique national.</p>
              </div>
           </div>
           <div className="hidden md:flex items-center space-x-3 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-md border border-white/5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Sara Engine v4.2 Active</span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
         {/* Chat Interface */}
         <div className="flex-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 p-8 overflow-y-auto space-y-6">
               {messages.map((m, i) => (
                 <div key={i} className={cn(
                   "flex",
                   m.role === 'user' ? "justify-end" : "justify-start"
                 )}>
                    <div className={cn(
                      "max-w-[80%] p-5 rounded-[2rem] text-sm font-medium leading-relaxed",
                      m.role === 'user' 
                        ? "bg-blue-900 text-white rounded-tr-none shadow-xl shadow-blue-900/10" 
                        : "bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100"
                    )}>
                       {m.content}
                    </div>
                 </div>
               ))}
            </div>

            <div className="p-8 border-t border-gray-50 bg-gray-50/30">
               <div className="relative group">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Posez une question sur vos examens ou vos écoles..." 
                    className="w-full pl-6 pr-20 py-5 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all placeholder:text-gray-300"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-900 text-white rounded-xl shadow-lg hover:bg-blue-800 transition-all">
                     <AppIcon name="arrowRight" size="submenu" />
                  </button>
               </div>
            </div>
         </div>

         {/* Sidebar Suggestions & Context */}
         <div className="w-80 space-y-6 shrink-0 hidden lg:block">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Suggestions</h3>
               <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <button key={i} className="w-full text-left p-4 bg-gray-50 rounded-2xl text-[11px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-900 border border-transparent hover:border-blue-100 transition-all">
                       {s}
                    </button>
                  ))}
               </div>
            </div>

            <div className="bg-purple-50 p-8 rounded-[2.5rem] border border-purple-100">
               <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-purple-900 rounded-lg flex items-center justify-center">
                     <AppIcon name="sparkles" size="menu" className="text-white" />
                  </div>
                  <h4 className="text-xs font-black text-purple-900 uppercase">Capacités Sara</h4>
               </div>
               <ul className="space-y-3">
                  {[
                    "Analyse de sentiments",
                    "Détection d'anomalies sync",
                    "Rapports PDF instantanés",
                    "Traduction multi-langues"
                  ].map((cap, i) => (
                    <li key={i} className="flex items-center space-x-2 text-[10px] font-bold text-purple-800">
                       <div className="w-1 h-1 bg-purple-400 rounded-full" />
                       <span>{cap}</span>
                    </li>
                  ))}
               </ul>
            </div>
         </div>
      </div>
    </div>
  );
}
