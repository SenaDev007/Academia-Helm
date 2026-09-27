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
import { FedPage, FedStagger, FedStaggerItem } from '@/components/federis/federis-motion';

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
    <FedPage className="space-y-8">
      {/* Header Premium Bureau */}
      <div className="fed-card p-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="fed-badge mb-4">Module gouvernance</div>
          <div className="flex items-center space-x-3 mb-3">
             <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="building" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">Bureau & Membres</h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm">
            Gérez la composition du bureau national et les représentants des organisations membres du patronat Federis.
          </p>
        </div>

        <button className="fed-btn-gold fed-btn-shimmer px-8 py-3.5 text-sm">
          <AppIcon name="add" size="submenu" />
          Nouveau Membre
        </button>
      </div>

      <FedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map(member => (
          <FedStaggerItem key={member.id}>
          <div className="fed-card fed-card-shimmer p-8 transition-all group h-full">
             <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center text-[#1e3a8a] font-black text-xl group-hover:bg-[#0b1d3a] group-hover:text-white transition-all">
                   {member.name[0]}
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                   {member.status}
                </div>
             </div>
             
             <h3 className="text-lg font-black text-[#0b1d3a] mb-1">{member.name}</h3>
             <p className="text-[#1e3a8a] text-xs font-bold uppercase tracking-widest mb-4">{member.position}</p>
             
             <div className="pt-4 border-t border-blue-50 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.organization}</p>
                <div className="flex space-x-2">
                   <button className="p-2 text-slate-400 hover:text-[#0b1d3a] transition-colors">
                      <AppIcon name="edit" size="submenu" />
                   </button>
                   <button className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                      <AppIcon name="delete" size="submenu" />
                   </button>
                </div>
             </div>
          </div>
          </FedStaggerItem>
        ))}
      </FedStagger>
    </FedPage>
  );
}
