/**
 * FederisConnectEvents Component
 * 
 * Agenda Institutionnel & Réunions
 * Partie du module Federis Connect
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  type: 'MEETING' | 'EXAM' | 'CEREMONY';
}

export default function FederisConnectEvents() {
  const [events, setEvents] = useState<Event[]>([
    { id: '1', title: 'Commission Nationale des Examens', date: '2024-06-12', time: '09:00', location: 'Salle de Conférence Federis', attendees: 24, type: 'MEETING' },
    { id: '2', title: 'Lancement Session BAC 2024', date: '2024-06-15', time: '08:00', location: 'Tous les centres', attendees: 15000, type: 'EXAM' },
    { id: '3', title: 'Remise des Diplômes Promotion 2023', date: '2024-07-20', time: '14:00', location: 'Palais des Congrès', attendees: 500, type: 'CEREMONY' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">Agenda Institutionnel</h3>
        <button className="px-6 py-2 bg-blue-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2">
           <AppIcon name="add" size="submenu" />
           Planifier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <div key={event.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <AppIcon name="exams" size="large" className="text-blue-900" />
             </div>
             
             <div className={cn(
               "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm",
               event.type === 'MEETING' ? "bg-amber-50 text-amber-600" : 
               event.type === 'EXAM' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-900"
             )}>
                <AppIcon name={event.type === 'MEETING' ? 'students' : 'exams'} size="dashboard" />
             </div>

             <h4 className="text-lg font-black text-gray-900 mb-2 leading-tight">{event.title}</h4>
             <div className="space-y-2 mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <AppIcon name="exams" size="submenu" className="w-3 h-3" />
                   {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <AppIcon name="sparkles" size="submenu" className="w-3 h-3" />
                   {event.time} • {event.location}
                </p>
             </div>
             
             <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex -space-x-2">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-blue-600">
                        +
                     </div>
                   ))}
                   <span className="ml-4 text-[9px] font-bold text-gray-400 uppercase">+{event.attendees}</span>
                </div>
                <button className="text-[10px] font-black text-blue-900 uppercase tracking-widest hover:underline">Détails</button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
