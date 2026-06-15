'use client';

import { motion } from 'framer-motion';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  MessageSquare,
  History,
  FileText,
  Clock,
  PlusCircle,
} from 'lucide-react';

const TIMELINE_EVENTS = [
  { 
    id: 1, 
    date: 'Aujourd\'hui, 09:30', 
    type: 'assignment', 
    title: 'Nouveau Devoir : Calcul de fractions', 
    subject: 'Mathématiques',
    teacher: 'M. KOFFI',
    icon: ClipboardList,
    color: 'indigo'
  },
  { 
    id: 2, 
    date: 'Hier, 14:15', 
    type: 'observation', 
    title: 'Observation : Participation active', 
    subject: 'Français',
    teacher: 'Mme SOSSOU',
    content: 'A bien participé au débat sur la lecture suivie.',
    icon: MessageSquare,
    color: 'emerald'
  },
  { 
    id: 3, 
    date: '12 Mai, 10:00', 
    type: 'alert', 
    title: 'Alerte : Leçon non copiée', 
    subject: 'Sciences',
    teacher: 'M. TOURE',
    content: 'Leçon sur le cycle de l\'eau non présente dans le cahier.',
    icon: AlertCircle,
    color: 'rose'
  },
  { 
    id: 4, 
    date: '11 Mai, 15:30', 
    type: 'completion', 
    title: 'Devoir Rendu : Exposé Histoire', 
    subject: 'Histoire-Géo',
    teacher: 'M. DJOSSOU',
    icon: CheckCircle2,
    color: 'blue'
  },
];

export default function ParentPedagogicalTimeline() {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          Timeline Pédagogique
        </h3>
        <button className="text-indigo-600 text-xs font-bold px-4 py-2 bg-indigo-50 rounded-xl">
          Filtrer par enfant
        </button>
      </div>

      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {TIMELINE_EVENTS.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            {/* Dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <event.icon className={`w-5 h-5 ${
                event.color === 'indigo' ? 'text-indigo-600' : 
                event.color === 'emerald' ? 'text-emerald-600' : 
                event.color === 'rose' ? 'text-rose-600' : 'text-blue-600'
              }`} />
            </div>

            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-3xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
              <div className="flex items-center justify-between mb-2">
                <time className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">{event.date}</time>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                   event.color === 'indigo' ? 'text-indigo-600' : 
                   event.color === 'emerald' ? 'text-emerald-600' : 
                   event.color === 'rose' ? 'text-rose-600' : 'text-blue-600'
                }`}>{event.subject}</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{event.title}</h4>
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-4 h-4 rounded-full bg-slate-200" />
                 <span className="text-[10px] font-bold text-slate-500 uppercase">{event.teacher}</span>
              </div>
              {event.content && (
                <p className="text-xs text-slate-500 leading-relaxed italic border-l-2 border-slate-200 pl-3 mb-4">
                  &quot;{event.content}&quot;
                </p>
              )}
              <div className="flex justify-end">
                 <button className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                   Voir les détails <PlusCircle className="w-3 h-3" />
                 </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
