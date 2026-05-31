/**
 * ============================================================================
 * HR MODULE — Navigation Tabs (centralisé)
 * Même pattern que pedagogy-tabs.tsx
 * ============================================================================
 */

import {
  UserCheck,
  Users,
  FileText,
  Clock,
  CalendarDays,
  DollarSign,
  CreditCard,
  Shield,
  BarChart3,
  Settings,
} from 'lucide-react';

export const HR_SUBMODULE_TABS = [
  {
    id: 'overview',
    label: "Vue d'ensemble",
    path: '/app/hr',
    icon: UserCheck,
    exact: true,
  },
  {
    id: 'staff',
    label: 'Personnel',
    path: '/app/hr/staff',
    icon: Users,
  },
  {
    id: 'contracts',
    label: 'Contrats',
    path: '/app/hr/contracts',
    icon: FileText,
  },
  {
    id: 'leaves',
    label: 'Congés & Absences',
    path: '/app/hr/leaves',
    icon: Clock,
  },
  {
    id: 'planning',
    label: 'Planning',
    path: '/app/hr/planning',
    icon: CalendarDays,
  },
  {
    id: 'allowances',
    label: 'Indemnités',
    path: '/app/hr/allowances',
    icon: DollarSign,
  },
  {
    id: 'payroll',
    label: 'Paie',
    path: '/app/hr/payroll',
    icon: CreditCard,
  },
  {
    id: 'cnss',
    label: 'CNSS',
    path: '/app/hr/cnss',
    icon: Shield,
  },
  {
    id: 'reporting',
    label: 'Rapports',
    path: '/app/hr/reporting',
    icon: BarChart3,
  },
  {
    id: 'settings',
    label: 'Paramètres',
    path: '/app/hr/settings',
    icon: Settings,
  },
] as const;
