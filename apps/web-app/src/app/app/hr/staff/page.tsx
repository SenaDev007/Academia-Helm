'use client';
import { useState } from 'react';
import { HRShell } from '../_components/HRShell';
import { StaffWorkspace } from '../_components/workspaces/StaffWorkspace';
import { StaffCardWorkspace } from '../_components/workspaces/StaffCardWorkspace';
import { Users, IdCard } from 'lucide-react';

export default function StaffPage() {
  const [subTab, setSubTab] = useState<'staff' | 'cards'>('staff');
  return (
    <HRShell activeId="staff" title="Personnel" description="Gestion des collaborateurs, fiches individuelles, matricules et documents RH.">
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        <button onClick={() => setSubTab('staff')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${subTab === 'staff' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Users className="h-4 w-4" /> Personnel
        </button>
        <button onClick={() => setSubTab('cards')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${subTab === 'cards' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IdCard className="h-4 w-4" /> Carte professionnelle
        </button>
      </div>
      {subTab === 'staff' ? <StaffWorkspace /> : <StaffCardWorkspace />}
    </HRShell>
  );
}
