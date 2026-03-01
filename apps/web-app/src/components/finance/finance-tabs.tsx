/**
 * Onglets du module Finance & Économat — 8 sous-modules (spec Academia Helm)
 */
import {
  DollarSign,
  Users,
  CreditCard,
  AlertCircle,
  TrendingDown,
  Wallet,
  BarChart3,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export const FINANCE_SUBMODULE_TABS = [
  { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees', icon: DollarSign },
  { id: 'accounts', label: 'Comptes élèves', path: '/app/finance/accounts', icon: Users },
  { id: 'payments', label: 'Encaissements', path: '/app/finance/payments', icon: CreditCard },
  { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection', icon: AlertCircle },
  { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses', icon: TrendingDown },
  { id: 'treasury', label: 'Clôture & Trésorerie', path: '/app/finance/treasury', icon: Wallet },
  { id: 'reports', label: 'Rapports financiers', path: '/app/finance/reports', icon: BarChart3 },
  { id: 'audit', label: 'Contrôle & Audit', path: '/app/finance/audit', icon: ShieldCheck },
  { id: 'settings', label: 'Paramétrage & Audit', path: '/app/finance/settings', icon: Settings },
];
