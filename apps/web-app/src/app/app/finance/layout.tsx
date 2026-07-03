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
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';

const FINANCE_TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', path: '/app/finance', icon: LayoutDashboard },
  { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees', icon: DollarSign },
  { id: 'accounts', label: 'Comptes élèves', path: '/app/finance/accounts', icon: Users },
  { id: 'overrides', label: 'Personnalisations', path: '/app/finance/overrides', icon: UserCog },
  { id: 'payments', label: 'Encaissements', path: '/app/finance/payments', icon: CreditCard },
  { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection', icon: AlertCircle },
  { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses', icon: TrendingDown },
  { id: 'treasury', label: 'Clôture & Trésorerie', path: '/app/finance/treasury', icon: Wallet },
  { id: 'cash-registers', label: 'Multi-caisses', path: '/app/finance/cash-registers', icon: Coins },
  { id: 'reports', label: 'Rapports financiers', path: '/app/finance/reports', icon: BarChart3 },
  { id: 'audit', label: "Contrôle & Audit", path: '/app/finance/audit', icon: ShieldCheck },
  { id: 'settings', label: 'Paramétrage', path: '/app/finance/settings', icon: Settings },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Finances & Économat"
        description="Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage."
        icon="finance"
        // Pas de KPIs codés en dur ici — le dashboard affiche ses propres stats réelles
      />
      <SubModuleNavigation tabs={FINANCE_TABS} currentPath={pathname} />
      <div className="min-h-[600px]">{children}</div>
    </div>
  );
}
