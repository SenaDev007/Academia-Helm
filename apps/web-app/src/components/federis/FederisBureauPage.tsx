/**
 * FederisBureauPage Component
 * 
 * Gestion du Bureau et des Membres du Patronat
 * Module 1 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  name: string;
  position: string;
  organization: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export default function FederisBureauPage() {
  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: 'Dr. Jean-Pierre Dupont', position: 'Président National', organization: 'Association des Écoles de l\'Ouest', status: 'ACTIVE' },
    { id: '2', name: 'Mme. Sarah Lawson', position: 'Secrétaire Générale', organization: 'Lycée de l\'Excellence', status: 'ACTIVE' },
    { id: '3', name: 'M. Marc Zinsou', position: 'Trésorier', organization: 'Groupe Scolaire Horizon', status: 'ACTIVE' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Premium Bureau */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="building" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Bureau & Membres</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Gérez la composition du bureau national et les représentants des organisations membres du patronat Federis.
          </p>
        </div>

        <button className="px-8 py-4 bg-blue-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-3">
          <AppIcon name="add" size="submenu" />
          Nouveau Membre
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map(member => (
          <div key={member.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
             <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-900 font-black text-xl group-hover:bg-blue-900 group-hover:text-white transition-all">
                   {member.name[0]}
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                   {member.status}
                </div>
             </div>
             
             <h3 className="text-lg font-black text-gray-900 mb-1">{member.name}</h3>
             <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-4">{member.position}</p>
             
             <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{member.organization}</p>
                <div className="flex space-x-2">
                   <button className="p-2 text-gray-400 hover:text-blue-900 transition-colors">
                      <AppIcon name="edit" size="submenu" />
                   </button>
                   <button className="p-2 text-gray-400 hover:text-red-900 transition-colors">
                      <AppIcon name="delete" size="submenu" />
                   </button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
