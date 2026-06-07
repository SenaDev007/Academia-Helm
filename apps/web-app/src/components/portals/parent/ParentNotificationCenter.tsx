'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ClipboardList,
  Search,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  MessageSquare,
  FileText,
  Filter,
  Download,
  ChevronRight,
  MoreVertical,
  History,
  Archive,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'Toutes', icon: Bell },
  { id: 'homework', label: 'Devoirs', icon: ClipboardList },
  { id: 'lessons', label: 'Leçons', icon: BookOpen },
  { id: 'observations', label: 'Observations', icon: MessageSquare },
  { id: 'alerts', label: 'Alertes', icon: AlertCircle },
];

const MOCK_NOTIFICATIONS = [
  { 
    id: 1, 
    type: 'homework', 
    title: 'Nouveau Devoir : Calcul de fractions', 
    content: 'M. KOFFI a ajouté un nouveau devoir de Mathématiques à rendre pour demain.',
    priority: 'HIGH',
    status: 'UNREAD',
    date: 'Il y a 10 min',
    requiresAcknowledge: true
  },
  { 
    id: 2, 
    type: 'lessons', 
    title: 'Leçon non copiée', 
    content: 'La leçon de Sciences sur "Le cycle de l\'eau" n\'a pas été recopiée par votre enfant.',
    priority: 'MEDIUM',
    status: 'UNREAD',
    date: 'Il y a 2h',
    requiresAcknowledge: true
  },
  { 
    id: 3, 
    type: 'observations', 
    title: 'Félicitations', 
    content: 'Mme SOSSOU souligne un effort notable en Français cette semaine.',
    priority: 'LOW',
    status: 'READ',
    date: 'Hier, 16:45',
    requiresAcknowledge: false
  },
];

export default function ParentNotificationCenter() {
  const [activeCat, setActiveCat] = useState('all');

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Centre de Notifications
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Suivi Pédagogique Quotidien</p>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-2.5 bg-slate-50 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
             <Archive className="w-4 h-4" />
           </button>
           <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100">
             Tout marquer comme lu
           </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-8 py-4 border-b border-slate-50 overflow-x-auto no-scrollbar flex items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeCat === cat.id 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        <AnimatePresence mode="popLayout">
          {MOCK_NOTIFICATIONS.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`p-6 hover:bg-slate-50/50 transition-all flex items-start gap-4 cursor-pointer group ${
                notif.status === 'UNREAD' ? 'bg-indigo-50/30' : ''
              }`}
            >
              <div className={`p-3 rounded-2xl shrink-0 ${
                notif.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
              }`}>
                {notif.type === 'homework' ? <ClipboardList className="w-6 h-6" /> : notif.type === 'lessons' ? <BookOpen className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-bold ${notif.status === 'UNREAD' ? 'text-slate-900' : 'text-slate-600'}`}>
                      {notif.title}
                    </h4>
                    {notif.status === 'UNREAD' && (
                      <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{notif.date}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed truncate md:whitespace-normal line-clamp-2">
                  {notif.content}
                </p>
                
                {notif.requiresAcknowledge && (
                  <div className="mt-4 flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all">
                      Accuser réception
                    </button>
                    <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all">
                      Détails
                    </button>
                  </div>
                )}
              </div>

              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                 <button className="p-2 text-slate-300 hover:text-slate-600">
                    <MoreVertical className="w-4 h-4" />
                 </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer / Weekly Summary Link */}
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <History className="w-4 h-4 text-slate-400" />
           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Synthèse hebdomadaire</span>
         </div>
         <button className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
           Consulter <ChevronRight className="w-3.5 h-3.5" />
         </button>
      </div>
    </div>
  );
}
