/**
 * ============================================================================
 * LAYOUT MODULE FINANCE & ÉCONOMAT
 * ============================================================================
 *
 * Layout centralisé pour le module Finance — pattern identique à
 * Communication, Students, HR, Pedagogy, Settings.
 *
 * Ce layout affiche :
 *   - Le ModuleHeader (titre, description, KPIs optionnels, actions)
 *   - La SubModuleNavigation (onglets horizontaux)
 *
 * Les pages enfants (fees, accounts, payments, etc.) n'ont plus besoin
 * d'inclure leur propre ModuleHeader ni SubModuleNavigation — elles ne
 * fournissent que le contenu métier (table, forms, etc.).
 *
 * Avantage : plus de duplication des onglets, design cohérent, maintenance
 * centralisée.
 *
 * ============================================================================
 */

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  CreditCard,
  AlertCircle,
  TrendingDown,
  Wallet,
  Coins,
  BarChart3,
  ShieldCheck,
  Settings,
  UserCog,
  ClipboardList,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
// ⭐ P4-final : onglets et en-tête bilingues (piste EN → anglais)
import { useL } from '@/lib/i18n/bilingual';
// ⭐ Onglet « Frais des examens » — visible dès qu'un examen national est
//    éligible pour l'école (niveaux activés + classes à examen) ou que des
//    frais d'examen existent (cf. useExamFeesTab).
import { useModuleContext } from '@/hooks/useModuleContext';
import { useExamFeesTab } from '@/hooks/useExamFeesTab';

const FINANCE_TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', labelEn: 'Dashboard', path: '/app/finance', icon: LayoutDashboard },
  { id: 'fees', label: 'Configuration des frais', labelEn: 'Fee Configuration', path: '/app/finance/fees', icon: DollarSign },
  { id: 'overrides', label: 'Personnalisations', labelEn: 'Overrides', path: '/app/finance/overrides', icon: UserCog },
  { id: 'accounts', label: 'Comptes élèves', labelEn: 'Student Accounts', path: '/app/finance/accounts', icon: Users },
  // ⭐ Frais généraux — listing par élève (dus / payé / solde) + déduction auto
  //    après encaissement. Positionné JUSTE APRÈS Comptes élèves (exigence sept. 2026).
  { id: 'general-fees', label: 'Frais généraux', labelEn: 'General Fees', path: '/app/finance/general-fees', icon: Layers },
  // ⭐ Frais des examens — suivi dédié par examen national (CEP/BEPC/BAC/CAP),
  //    même pattern que Frais généraux ; sous-onglets dynamiques selon les
  //    niveaux activés (Paramètres > Structure) — exigence promoteur oct. 2026.
  { id: 'exam-fees', label: 'Frais des examens', labelEn: 'Exam Fees', path: '/app/finance/exam-fees', icon: GraduationCap },
  { id: 'cash-registers', label: 'Multi-caisses', labelEn: 'Cash Registers', path: '/app/finance/cash-registers', icon: Coins },
  { id: 'payments', label: 'Encaissements', labelEn: 'Collections', path: '/app/finance/payments', icon: CreditCard },
  { id: 'collection-summary', label: 'Bilan des encaissements', labelEn: 'Collection Summary', path: '/app/finance/collection-summary', icon: ClipboardList },
  { id: 'collection', label: 'Recouvrement & Arriérés', labelEn: 'Recovery & Arrears', path: '/app/finance/collection', icon: AlertCircle },
  { id: 'expenses', label: 'Dépenses', labelEn: 'Expenses', path: '/app/finance/expenses', icon: TrendingDown },
  { id: 'treasury', label: 'Clôture & Trésorerie', labelEn: 'Closing & Treasury', path: '/app/finance/treasury', icon: Wallet },
  { id: 'reports', label: 'Rapports financiers', labelEn: 'Financial Reports', path: '/app/finance/reports', icon: BarChart3 },
  { id: 'audit', label: "Contrôle & Audit", labelEn: 'Control & Audit', path: '/app/finance/audit', icon: ShieldCheck },
  { id: 'settings', label: 'Paramétrage', labelEn: 'Settings', path: '/app/finance/settings', icon: Settings },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  // ⭐ Onglet « Frais des examens » dynamique : visible si l'école a un examen
  //    national éligible (niveau activé + classe à examen) ou des frais
  //    d'examen paramétrés. Une école purement maternelle ne le voit pas.
  const { academicYear } = useModuleContext();
  const showExamFeesTab = useExamFeesTab(academicYear?.id);
  const tabs = FINANCE_TABS
    .filter((tab) => tab.id !== 'exam-fees' || showExamFeesTab)
    .map((tab) => ({ ...tab, label: L(tab.label, tab.labelEn) }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={L("Finances & Économat", "Finance & Store")}
        description={L(
          "Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage.",
          "Financial steering: fees, student accounts, collections, recovery, expenses, closing, reports and settings.",
        )}
        icon="finance"
        // Pas de KPIs codés en dur ici — le dashboard affiche ses propres stats réelles
      />
      <SubModuleNavigation tabs={tabs} currentPath={pathname} />
      <div className="min-h-[600px]">{children}</div>
    </div>
  );
}
