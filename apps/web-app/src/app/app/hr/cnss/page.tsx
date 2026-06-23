'use client';

import { useState } from 'react';
import { HRShell } from '../_components/HRShell';
import { TaxDashboard } from '../_components/taxes/TaxDashboard';
import { StaffFiscalManagement } from '../_components/taxes/StaffFiscalManagement';
import { FinancialStatements } from '../_components/taxes/FinancialStatements';
import { FinancialNotes } from '../_components/taxes/FinancialNotes';
import { TaxDeclarations } from '../_components/taxes/TaxDeclarations';
import { TaxSettingsPanel } from '../_components/taxes/TaxSettingsPanel';
import { ReportHeader } from '../_components/taxes/ReportHeader';
import { PayrollManagement } from '../_components/taxes/PayrollManagement';
import { LayoutDashboard, Users, FileText, Landmark, Settings, FileEdit, Receipt } from 'lucide-react';

const SUB_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'staff', label: 'Gestion du personnel', icon: Users },
  { id: 'payroll', label: 'Paie & Fiches', icon: Receipt },
  { id: 'financial', label: 'États financiers', icon: FileText },
  { id: 'notes', label: 'Notes annexes', icon: FileEdit },
  { id: 'declarations', label: 'Déclarations fiscales', icon: Landmark },
  { id: 'report-header', label: 'Fiches R1-R4', icon: FileText },
  { id: 'settings', label: 'Paramètres', icon: Settings },
] as const;

export default function CnssPage() {
  const [activeSubTab, setActiveSubTab] = useState<string>('dashboard');

  return (
    <HRShell
      activeId="cnss"
      title="Impôts & États financiers"
      description="Gestion fiscale complète : états financiers SYSCOHADA, déclarations IST/AIB/CNSS, paie et fiches de renseignements."
    >
      <div className="mb-6 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#1A2BA6] text-[#1A2BA6]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'dashboard' && <TaxDashboard />}
      {activeSubTab === 'staff' && <StaffFiscalManagement />}
      {activeSubTab === 'payroll' && <PayrollManagement />}
      {activeSubTab === 'financial' && <FinancialStatements />}
      {activeSubTab === 'notes' && <FinancialNotes />}
      {activeSubTab === 'declarations' && <TaxDeclarations />}
      {activeSubTab === 'report-header' && <ReportHeader />}
      {activeSubTab === 'settings' && <TaxSettingsPanel />}
    </HRShell>
  );
}
