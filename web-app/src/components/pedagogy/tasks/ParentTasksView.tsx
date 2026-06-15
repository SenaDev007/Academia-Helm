'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Users,
  Search,
  ChevronRight,
  Download,
  MessageSquare,
  PlusCircle,
  FileText
} from 'lucide-react';

const TASKS: any[] = [];

export default function ParentTasksView() {
  const [selectedTask, setSelectedTask] = useState<any>(null);

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Travail à faire & Suivi
          </h1>
          <p className="text-slate-500 mt-1">Suivez les devoirs et progrès pédagogiques de votre enfant</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">{TASKS.length} Activités en attente</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Tasks List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">À faire prochainement</h3>
              <div className="flex items-center gap-2">
                 <button className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors">
                   <Search className="w-4 h-4" />
                 </button>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {TASKS.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                  <ClipboardList className="w-10 h-10 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Aucun devoir en attente</p>
                  <p className="text-xs text-slate-300">Les prochains devoirs de votre enfant apparaîtront ici</p>
                </div>
              ) : (
                TASKS.map((task) => (
                  <div key={task.id} className="p-6 hover:bg-slate-50/50 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex gap-4">
                        <div className={`p-3 rounded-2xl ${
                          task.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          <ClipboardList className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase">{task.subject}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold uppercase">{task.type}</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">{task.title}</h4>
                          <div className="flex items-center gap-4 mt-2">
                             <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                               <Clock className="w-3.5 h-3.5" />
                               Échéance : {task.deadline}
                             </div>
                             {task.priority === 'HIGH' && (
                               <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
                                 <AlertCircle className="w-3.5 h-3.5" />
                                 Urgent
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end md:self-center">
                        <button 
                          onClick={() => setSelectedTask(task)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all"
                        >
                          Détails
                        </button>
                        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-100">
                          Marquer comme fait
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
              <div className="flex items-center gap-2 text-emerald-700 mb-4">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-bold">Derniers retours</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-white/50 rounded-2xl border border-emerald-100/50">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Dictée préparée</p>
                  <p className="text-xs text-slate-600 italic">&quot;Très bon travail, l'orthographe est maîtrisée.&quot;</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">18/20</span>
                    <span className="text-[10px] text-slate-400 italic">Il y a 2 jours</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-900 rounded-3xl text-white">
               <div className="flex items-center gap-2 mb-4">
                 <MessageSquare className="w-5 h-5 text-blue-400" />
                 <h3 className="font-bold">Communication</h3>
               </div>
               <p className="text-xs text-slate-400 mb-6 leading-relaxed">L'enseignant de Mathématiques a laissé une note concernant la prochaine recherche documentaire.</p>
               <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                 Ouvrir la messagerie
                 <ChevronRight className="w-3.5 h-3.5" />
               </button>
            </div>
          </div>
        </div>

        {/* Right Column: Follow-up Stats & Alerts */}
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6">Indicateur d'Engagement</h3>
            <div className="flex justify-center mb-8">
               <div className="relative w-32 h-32">
                 <svg className="w-full h-full transform -rotate-90">
                   <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                   <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="352" strokeDashoffset="352" className="text-indigo-600 transition-all duration-1000" style={{ strokeDashoffset: 352 - (352 * 0.92) }} />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-2xl font-black text-slate-900">92%</span>
                 </div>
               </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Devoirs faits', val: '98%', color: 'bg-emerald-500' },
                { label: 'Récitations', val: '85%', color: 'bg-blue-500' },
                { label: 'Participation', val: '94%', color: 'bg-indigo-500' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase">
                    <span>{s.label}</span>
                    <span>{s.val}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color}`} style={{ width: s.val }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl">
             <div className="flex items-center gap-2 text-amber-700 mb-3">
               <AlertCircle className="w-4 h-4" />
               <span className="text-xs font-bold uppercase tracking-widest">Points d'attention</span>
             </div>
             <div className="space-y-3">
               <div className="text-xs text-amber-900 font-medium leading-relaxed">
                 Le cahier de leçons n'était pas complet lors du contrôle de lundi.
               </div>
               <button className="text-[10px] font-bold text-amber-700 flex items-center gap-1 hover:underline">
                 Voir l'observation complète <ChevronRight className="w-3 h-3" />
               </button>
             </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-slate-50 rounded-lg">
                 <Download className="w-4 h-4 text-slate-400" />
               </div>
               <span className="text-xs font-bold text-slate-700">Guide de l'Exposé</span>
             </div>
             <button className="text-[10px] font-bold text-indigo-600">Télécharger</button>
          </div>
        </div>

      </div>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-600 text-white">
                <div>
                   <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{selectedTask.subject} • {selectedTask.type}</span>
                   <h2 className="text-2xl font-bold">{selectedTask.title}</h2>
                </div>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                >
                  <PlusCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Enseignant</span>
                    <p className="text-sm font-bold text-slate-900">M. KOFFI</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Échéance</span>
                    <p className="text-sm font-bold text-rose-600">{selectedTask.deadline}</p>
                  </div>
                </div>

                <div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Consigne</span>
                   <p className="text-sm text-slate-600 leading-relaxed mt-1">
                     Veuillez réaliser les exercices 4, 5 et 8 de la page 42 du manuel de mathématiques. 
                     Portez une attention particulière à la présentation des calculs.
                   </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-indigo-500" />
                     <span className="text-xs font-bold text-slate-700">Pièce jointe : fiche_exercices.pdf</span>
                   </div>
                   <button className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                     <Download className="w-3.5 h-3.5" /> Télécharger
                   </button>
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                   <button className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all">
                      Accuser réception
                   </button>
                   <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-100">
                      Confirmer suivi fait
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
