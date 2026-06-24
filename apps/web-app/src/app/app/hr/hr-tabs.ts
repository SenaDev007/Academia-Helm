/**
 * ============================================================================
 * HR MODULE — Navigation Tabs (centralisé)
 * Même pattern que pedagogy-tabs.tsx
 * ============================================================================
 */

import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCircle,
  UserCog,
  FileCheck,
  Brain,
  Clock,
  CalendarDays,
  Calendar,
  DollarSign,
  CreditCard,
  Shield,
  BarChart3,
  Settings,
  FileEdit,
  Landmark,
  UserPlus,
} from 'lucide-react';

export const HR_SUBMODULE_TABS = [
  {
    id: 'overview',
    label: 'Tableau de bord',
    path: '/app/hr',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    id: 'recruiter-settings',
    label: 'Recruteur',
    path: '/app/hr/recruitment/settings',
    icon: UserCog,
  },
  {
    id: 'recruitment',
    label: 'Recrutement',
    path: '/app/hr/recruitment',
    icon: Briefcase,
  },
  {
    id: 'embauche',
    label: 'Embauche',
    path: '/app/hr/embauche',
    icon: UserPlus,
  },
  {
    id: 'staff',
    label: 'Personnel',
    path: '/app/hr/staff',
    icon: UserCircle,
  },
  {
    id: 'contract-config',
    label: 'Config. Contrats',
    path: '/app/hr/contracts/document-config',
    icon: FileEdit,
  },
  {
    id: 'contracts',
    label: 'Contrats',
    path: '/app/hr/contracts',
    icon: FileCheck,
  },
  {
    id: 'collaborators',
    label: 'Collaborateurs',
    path: '/app/hr/collaborators',
    icon: Users,
  },
  {
    id: 'ia',
    label: 'IA RH',
    path: '/app/hr/ia',
    icon: Brain,
  },
  {
    id: 'leaves',
    label: 'Congés & Absences',
    path: '/app/hr/leaves',
    icon: Clock,
  },
  {
    id: 'attendance',
    label: 'Présences',
    path: '/app/hr/attendance',
    icon: CalendarDays,
  },
  {
    id: 'planning',
    label: 'Planning',
    path: '/app/hr/planning',
    icon: Calendar,
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
    label: 'Impôts & État Financier',
    path: '/app/hr/cnss',
    icon: Landmark,
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

