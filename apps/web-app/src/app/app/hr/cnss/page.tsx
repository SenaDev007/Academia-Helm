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
import { LayoutDashboard, Users, FileText, Landmark, Settings, BarChart3, FileEdit, Receipt, ClipboardList } from 'lucide-react';

// ─── Architecture des sous-onglets (4 sous-onglets principaux + Paramètres) ─
// 1. Tableau de bord      → KPIs, alertes
// 2. Gestion du personnel  → Annuaire, états de paiement, fiches de paie
// 3. États financiers      → Bilan/CR/TFT, notes annexes, fiches R1-R4
// 4. Déclarations fiscales → IST, AIB, CNSS
// 5. Paramètres            → Taux configurables

const MAIN_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'staff', label: 'Gestion du personnel', icon: Users },
  { id: 'financial', label: 'États financiers', icon: FileText },
  { id: 'declarations', label: 'Déclarations fiscales', icon: Landmark },
  { id: 'settings', label: 'Paramètres', icon: Settings },
] as const;

// Sous-navigation pour "Gestion du personnel"
const STAFF_SUBTABS = [
  { id: 'annuaire', label: 'Annuaire fiscal', icon: Users },
  { id: 'payroll', label: 'États de paiement & Fiches', icon: Receipt },
] as const;

// Sous-navigation pour "États financiers"
const FINANCIAL_SUBTABS = [
  { id: 'page-garde', label: 'Page de garde', icon: FileText },
  { id: 'r1-r4', label: 'Fiches R1-R4', icon: ClipboardList },
  { id: 'statements', label: 'Bilan / CR / TFT', icon: FileText },
  { id: 'notes', label: 'Notes annexes (36)', icon: FileEdit },
] as const;

export default function CnssPage() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [staffSubtab, setStaffSubtab] = useState<string>('annuaire');
  const [financialSubtab, setFinancialSubtab] = useState<string>('statements');

  const renderSubTabs = (tabs: readonly any[], active: string, setActive: (v: string) => void) => (
    <div className="mb-4 flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition whitespace-nowrap ${
              isActive ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <HRShell
      activeId="cnss"
      title="Impôts & États financiers"
      description="Gestion fiscale complète : états financiers SYSCOHADA, déclarations IST/AIB/CNSS, paie et fiches de renseignements."
    >
      {/* ─── Sous-onglets principaux ─── */}
      <div className="mb-6 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* ─── 1. TABLEAU DE BORD ─── */}
      {activeTab === 'dashboard' && <TaxDashboard />}

      {/* ─── 2. GESTION DU PERSONNEL ─── */}
      {activeTab === 'staff' && (
        <div>
          {renderSubTabs(STAFF_SUBTABS, staffSubtab, setStaffSubtab)}
          {staffSubtab === 'annuaire' && <StaffFiscalManagement />}
          {staffSubtab === 'payroll' && <PayrollManagement />}
        </div>
      )}

      {/* ─── 3. ÉTATS FINANCIERS ─── */}
      {activeTab === 'financial' && (
        <div>
          {renderSubTabs(FINANCIAL_SUBTABS, financialSubtab, setFinancialSubtab)}
          {financialSubtab === 'page-garde' && <ReportHeader initialSection="garde" />}
          {financialSubtab === 'r1-r4' && <ReportHeader initialSection="r1" />}
          {financialSubtab === 'statements' && <FinancialStatements />}
          {financialSubtab === 'notes' && <FinancialNotes />}
        </div>
      )}

      {/* ─── 4. DÉCLARATIONS FISCALES ─── */}
      {activeTab === 'declarations' && <TaxDeclarations />}

      {/* ─── 5. PARAMÈTRES ─── */}
      {activeTab === 'settings' && <TaxSettingsPanel />}
    </HRShell>
  );
}
