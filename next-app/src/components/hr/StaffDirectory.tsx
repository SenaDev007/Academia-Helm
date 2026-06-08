/**
 * StaffDirectory Component
 * 
 * Annuaire du personnel avec dossiers numériques.
 */

'use client';

import { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  Mail,
  Phone,
  Briefcase,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StaffDirectory() {
  const [staff] = useState([
    { id: 'STF-001', name: 'Jean-Marc Kouassi', role: 'Professeur Principal', dept: 'Sciences', status: 'ACTIVE', email: 'jm.kouassi@academia.edu' },
    { id: 'STF-002', name: 'Marie-Noëlle Traoré', role: 'Directrice Adjointe', dept: 'Administration', status: 'ACTIVE', email: 'mn.traore@academia.edu' },
    { id: 'STF-003', name: 'Dr. Bakayoko Idriss', role: 'Conseiller d\'Orientation', dept: 'Vie Scolaire', status: 'ON_LEAVE', email: 'b.idriss@academia.edu' },
  ]);

  return (
    <div className="space-y-6">
      {/* Search & Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Rechercher un membre du personnel..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
          <Plus className="w-4 h-4" /> Ajouter Personnel
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div key={member.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
             <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                   <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-xl font-black text-blue-600">
                      {member.name.charAt(0)}
                   </div>
                   <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                      <MoreHorizontal className="w-5 h-5 text-slate-400" />
                   </button>
                </div>
                
                <h3 className="font-black text-slate-900 text-lg leading-tight">{member.name}</h3>
                <p className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-widest">{member.role}</p>
                
                <div className="mt-6 space-y-3">
                   <div className="flex items-center gap-3 text-slate-500">
                      <Briefcase className="w-4 h-4" />
                      <span className="text-xs font-medium">{member.dept}</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-500">
                      <Mail className="w-4 h-4" />
                      <span className="text-xs font-medium">{member.email}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                     member.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                   )}>
                      {member.status === 'ACTIVE' ? 'Actif' : 'En Congé'}
                   </span>
                   <button className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase transition-colors">
                      Dossier complet <ChevronRight className="w-3 h-3" />
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
