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
import { CnssDeclarationView } from '../_components/taxes/CnssDeclarationView';
import { IrppDeclarationView } from '../_components/taxes/IrppDeclarationView';
import { AibDeclarationView } from '../_components/taxes/AibDeclarationView';
import { VpsDeclarationView } from '../_components/taxes/VpsDeclarationView';
import { VacatairesView } from '../_components/taxes/VacatairesView';
import {
  LayoutDashboard, Users, FileText, Landmark, Settings,
  BarChart3, FileEdit, Receipt, ClipboardList,
  IdCard, ShieldCheck, Percent, FileBarChart, UserCheck,
} from 'lucide-react';

// ─── Architecture des sous-onglets ──
// Onglets principaux avec tous les documents fiscaux séparés:
// 1. Tableau de bord
// 2. Gestion du personnel (Annuaire + Fiches de paie)
// 3. Fiche (Page de garde + R1-R4)
// 4. Vacataires (État des vacataires)
// 5. CNSS (Déclaration trimestrielle nominative)
// 6. IRPP (Impôt sur le Revenu des Personnes Physiques)
// 7. VPS (Versement Préventif à la Source)
// 8. AIB (Avis d'Imposition à la Base)
// 9. États financiers (Bilan/CR/TFT + Notes)
// 10. Paramètres

const MAIN_TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'staff', label: 'Personnel', icon: Users },
  { id: 'fiche', label: 'Fiche', icon: IdCard },
  { id: 'vacataires', label: 'Vacataires', icon: UserCheck },
  { id: 'cnss', label: 'CNSS', icon: ShieldCheck },
  { id: 'irpp', label: 'IRPP', icon: Percent },
  { id: 'vps', label: 'VPS', icon: FileBarChart },
  { id: 'aib', label: 'AIB', icon: Receipt },
  { id: 'financial', label: 'États financiers', icon: FileText },
  { id: 'declarations', label: 'Toutes déclarations', icon: Landmark },
  { id: 'settings', label: 'Paramètres', icon: Settings },
] as const;

// Sous-navigation pour "Gestion du personnel"
const STAFF_SUBTABS = [
  { id: 'annuaire', label: 'Annuaire fiscal', icon: Users },
  { id: 'payroll', label: 'États de paiement', icon: Receipt },
] as const;

// Sous-navigation pour "États financiers"
const FINANCIAL_SUBTABS = [
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
      description="Gestion fiscale complète : états financiers SYSCOHADA, déclarations IST/IRPP/VPS/AIB/CNSS, paie et fiches de renseignements."
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
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#1A2BA6] text-[#1A2BA6]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label}</span>
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

      {/* ─── 3. FICHE (Page de garde + R1-R4) ─── */}
      {activeTab === 'fiche' && <ReportHeader initialSection="garde" />}

      {/* ─── 4. VACATAIRES ─── */}
      {activeTab === 'vacataires' && <VacatairesView />}

      {/* ─── 5. CNSS (Déclaration trimestrielle) ─── */}
      {activeTab === 'cnss' && <CnssDeclarationView />}

      {/* ─── 6. IRPP ─── */}
      {activeTab === 'irpp' && <IrppDeclarationView />}

      {/* ─── 7. VPS ─── */}
      {activeTab === 'vps' && <VpsDeclarationView />}

      {/* ─── 8. AIB ─── */}
      {activeTab === 'aib' && <AibDeclarationView />}

      {/* ─── 9. ÉTATS FINANCIERS ─── */}
      {activeTab === 'financial' && (
        <div>
          {renderSubTabs(FINANCIAL_SUBTABS, financialSubtab, setFinancialSubtab)}
          {financialSubtab === 'statements' && <FinancialStatements />}
          {financialSubtab === 'notes' && <FinancialNotes />}
        </div>
      )}

      {/* ─── 10. TOUTES DÉCLARATIONS (vue combinée) ─── */}
      {activeTab === 'declarations' && <TaxDeclarations />}

      {/* ─── 11. PARAMÈTRES ─── */}
      {activeTab === 'settings' && <TaxSettingsPanel />}
    </HRShell>
  );
}
