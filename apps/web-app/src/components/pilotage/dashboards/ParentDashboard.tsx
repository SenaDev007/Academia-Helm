'use client';

import { motion } from 'framer-motion';
import ParentDashboardFollowup from '@/components/portals/parent/ParentDashboardFollowup';
import ParentNotificationCenter from '@/components/portals/parent/ParentNotificationCenter';
import ParentPedagogicalTimeline from '@/components/portals/parent/ParentPedagogicalTimeline';
import { 
  Users, 
  Calendar, 
  GraduationCap, 
  CreditCard, 
  MessageCircle,
  Sparkles,
  LayoutDashboard
} from 'lucide-react';

export default function ParentDashboard() {
  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-indigo-600" />
            Bonjour, Parent Academia
          </h1>
          <p className="text-slate-500 mt-1">Espace de suivi consolidé pour vos enfants</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
             <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">EA</div>
             <div className="w-10 h-10 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">SJ</div>
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Changer d'enfant
          </button>
        </div>
      </div>

      {/* Main Blocks */}
      <div className="space-y-8">
        {/* Core Follow-up Block (FROM DOC) */}
        <ParentDashboardFollowup />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Notification Center (FROM DOC) */}
           <div className="lg:col-span-2">
             <ParentNotificationCenter />
           </div>

           {/* Quick Actions / Shortcuts */}
           <div className="space-y-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-indigo-500" />
                   Accès Rapides
                </h3>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { label: 'Notes', icon: GraduationCap, color: 'bg-emerald-50 text-emerald-600' },
                     { label: 'Absences', icon: Users, color: 'bg-rose-50 text-rose-600' },
                     { label: 'Finance', icon: CreditCard, color: 'bg-blue-50 text-blue-600' },
                     { label: 'Agenda', icon: Calendar, color: 'bg-indigo-50 text-indigo-600' },
                   ].map((action, i) => (
                     <button key={i} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-50 hover:border-indigo-100 hover:shadow-md transition-all group">
                        <div className={`p-3 rounded-xl transition-all group-hover:scale-110 ${action.color}`}>
                           <action.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{action.label}</span>
                     </button>
                   ))}
                </div>
              </div>

              <div className="p-6 bg-emerald-900 rounded-3xl shadow-xl text-white">
                 <h3 className="font-bold mb-2">Support Parent</h3>
                 <p className="text-xs text-emerald-200 mb-6 leading-relaxed">Une question sur le suivi ? Contactez directement l'administration ou les enseignants.</p>
                 <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Contacter l'école
                 </button>
              </div>
           </div>
        </div>

        {/* Timeline (FROM DOC) */}
        <ParentPedagogicalTimeline />
      </div>
    </div>
  );
}
