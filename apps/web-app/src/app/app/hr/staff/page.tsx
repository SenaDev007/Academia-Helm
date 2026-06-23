'use client';
import { useState } from 'react';
import { HRShell } from '../_components/HRShell';
import { StaffWorkspace } from '../_components/workspaces/StaffWorkspace';
import { StaffCardWorkspace } from '../_components/workspaces/StaffCardWorkspace';
import { CardGallery } from '../_components/workspaces/CardGallery';
import { StaffListPDF } from '../_components/workspaces/StaffListPDF';
import { Users, IdCard, LayoutGrid, FileText } from 'lucide-react';

export default function StaffPage() {
  const [subTab, setSubTab] = useState<'staff' | 'cards' | 'gallery' | 'list'>('staff');
  return (
    <HRShell activeId="staff" title="Personnel" description="Gestion des collaborateurs, fiches individuelles, cartes professionnelles et liste du personnel.">
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setSubTab('staff')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'staff' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Users className="h-4 w-4" /> Personnel
        </button>
        <button onClick={() => setSubTab('cards')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'cards' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IdCard className="h-4 w-4" /> Carte professionnelle
        </button>
        <button onClick={() => setSubTab('gallery')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'gallery' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <LayoutGrid className="h-4 w-4" /> Trombinoscope
        </button>
        <button onClick={() => setSubTab('list')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'list' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <FileText className="h-4 w-4" /> Liste du personnel
        </button>
      </div>
      {subTab === 'staff' && <StaffWorkspace />}
      {subTab === 'cards' && <StaffCardWorkspace />}
      {subTab === 'gallery' && <CardGallery />}
      {subTab === 'list' && <StaffListPDF />}
    </HRShell>
  );
}
