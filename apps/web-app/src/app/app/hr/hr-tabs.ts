/**
 * ============================================================================
 * HR MODULE — Navigation Tabs (centralisé)
 * Même pattern que pedagogy-tabs.tsx
 * ============================================================================
 *
 * Onglets supprimés suite à la centralisation :
 *   - 'embauche' (alias de RecruitmentWorkspace initialTab="embauches") :
 *     supprimé car c'était le même composant que 'recruitment' avec un
 *     sous-tab différent. L'utilisateur accède aux embauches via l'onglet
 *     'recruitment' → sous-tab 'Embauches'.
 *   - 'staff' et 'contracts' : supprimés car ils sont déjà exposés comme
 *     sous-tabs dans l'onglet 'collaborators' (Personnel / Contrats /
 *     Historique / Organigramme). L'onglet 'collaborators' devient le
 *     point d'entrée unique pour la gestion du personnel et des contrats.
 *   - 'cnss' renommé en 'CNSS & Cotisations' (label honnête sur le
 *     périmètre réel — il n'y a que la CNSS, pas d'impôts ni d'état
 *     financier pour l'instant).
 * ============================================================================
 */

import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCog,
  Brain,
  Clock,
  CalendarDays,
  Calendar,
  DollarSign,
  CreditCard,
  BarChart3,
  Settings,
  Landmark,
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
    id: 'administration',
    label: 'Administration',
    path: '/app/hr/administration',
    icon: UserCog,
  },
  {
    id: 'recruitment',
    label: 'Recrutement',
    path: '/app/hr/recruitment',
    icon: Briefcase,
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
    label: 'CNSS & Cotisations',
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
