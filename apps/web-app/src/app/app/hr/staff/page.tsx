'use client';
import { useState } from 'react';
import { HRShell } from '../_components/HRShell';
import { StaffWorkspace } from '../_components/workspaces/StaffWorkspace';
import { StaffListPDF } from '../_components/workspaces/StaffListPDF';
import { Users, FileText } from 'lucide-react';

/**
 * Page Personnel (route /app/hr/staff — accessible par URL directe, mais
 * l'onglet n'est plus dans la sidebar du module RH : on y accède via
 * "Collaborateurs" > sous-tab "Personnel" pour la gestion courante).
 *
 * ⭐ Les sous-tabs "Carte professionnelle" et "Trombinoscope" ont été
 *    supprimés définitivement sur demande utilisateur.
 */
export default function StaffPage() {
  const [subTab, setSubTab] = useState<'staff' | 'list'>('staff');
  return (
    <HRShell activeId="staff" title="Personnel"
      titleEn="Staff" description="Gestion des collaborateurs et liste du personnel."
      descriptionEn="Staff records management and personnel list.">
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setSubTab('staff')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'staff' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Users className="h-4 w-4" /> Personnel
        </button>
        <button onClick={() => setSubTab('list')} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${subTab === 'list' ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <FileText className="h-4 w-4" /> Liste du personnel
        </button>
      </div>
      {subTab === 'staff' && <StaffWorkspace />}
      {subTab === 'list' && <StaffListPDF />}
    </HRShell>
  );
}
