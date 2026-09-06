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
  GraduationCap,
} from 'lucide-react';

export const HR_SUBMODULE_TABS = [
  {
    id: 'overview',
    label: 'Tableau de bord',
    labelEn: 'Dashboard',
    path: '/app/hr',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    id: 'recruiter-settings',
    label: 'Recruteur',
    labelEn: 'Recruiter',
    path: '/app/hr/recruitment/settings',
    icon: UserCog,
  },
  {
    id: 'administration',
    label: 'Administration',
    labelEn: 'Administration',
    path: '/app/hr/administration',
    icon: UserCog,
  },
  {
    id: 'recruitment',
    label: 'Recrutement',
    labelEn: 'Recruitment',
    path: '/app/hr/recruitment',
    icon: Briefcase,
  },
  {
    id: 'collaborators',
    label: 'Collaborateurs',
    labelEn: 'Staff Members',
    path: '/app/hr/collaborators',
    icon: Users,
  },
  {
    id: 'internships',
    label: 'Stagiaires',
    labelEn: 'Interns',
    path: '/app/hr/internships',
    icon: GraduationCap,
  },
  {
    id: 'ia',
    label: 'IA RH',
    labelEn: 'HR AI',
    path: '/app/hr/ia',
    icon: Brain,
  },
  {
    id: 'leaves',
    label: 'Congés & Absences',
    labelEn: 'Leaves & Absences',
    path: '/app/hr/leaves',
    icon: Clock,
  },
  {
    id: 'attendance',
    label: 'Présences',
    labelEn: 'Attendance',
    path: '/app/hr/attendance',
    icon: CalendarDays,
  },
  {
    id: 'planning',
    label: 'Planning',
    labelEn: 'Planning',
    path: '/app/hr/planning',
    icon: Calendar,
  },
  {
    id: 'allowances',
    label: 'Indemnités',
    labelEn: 'Allowances',
    path: '/app/hr/allowances',
    icon: DollarSign,
  },
  {
    id: 'payroll',
    label: 'Paie',
    labelEn: 'Payroll',
    path: '/app/hr/payroll',
    icon: CreditCard,
  },
  {
    id: 'cnss',
    label: 'CNSS & Cotisations',
    labelEn: 'CNSS & Contributions',
    path: '/app/hr/cnss',
    icon: Landmark,
  },
  {
    id: 'reporting',
    label: 'Rapports',
    labelEn: 'Reports',
    path: '/app/hr/reporting',
    icon: BarChart3,
  },
  {
    id: 'settings',
    label: 'Paramètres',
    labelEn: 'Settings',
    path: '/app/hr/settings',
    icon: Settings,
  },
] as const;
