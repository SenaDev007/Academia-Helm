/**
 * ============================================================================
 * EXAMS MODULE - SUB-MODULES CONFIGURATION
 * ============================================================================
 */

import { 
  LayoutDashboard, 
  Settings, 
  FileEdit, 
  CheckSquare, 
  Calculator, 
  Users, 
  FileText, 
  BarChart3, 
  History,
  Calendar,
  SlidersHorizontal
} from 'lucide-react';

export const EXAMS_SUB_MODULES = [
  { 
    id: 'dashboard', 
    label: 'Tableau de bord', 
    href: '/app/exams', 
    icon: LayoutDashboard 
  },
  { 
    id: 'config', 
    label: 'Paramétrage', 
    href: '/app/exams/config', 
    icon: Settings 
  },
  { 
    id: 'evaluations', 
    label: 'Évaluations', 
    href: '/app/exams/evaluations', 
    icon: Calendar 
  },
  { 
    id: 'grades', 
    label: 'Saisie des notes', 
    href: '/app/exams/grades', 
    icon: FileEdit 
  },
  { 
    id: 'validation', 
    label: 'Validation', 
    href: '/app/exams/validation', 
    icon: CheckSquare 
  },
  { 
    id: 'averages', 
    label: 'Moyennes', 
    href: '/app/exams/averages', 
    icon: Calculator 
  },
  { 
    id: 'councils', 
    label: 'Conseils de classe', 
    href: '/app/exams/councils', 
    icon: Users 
  },
  { 
    id: 'bulletins', 
    label: 'Bulletins', 
    href: '/app/exams/bulletins', 
    icon: FileText 
  },
  { 
    id: 'analytics', 
    label: 'Statistiques', 
    href: '/app/exams/analytics', 
    icon: BarChart3 
  },
  { 
    id: 'audit', 
    label: 'Audit', 
    href: '/app/exams/audit', 
    icon: History 
  },
  { 
    id: 'settings', 
    label: 'Paramètres', 
    href: '/app/exams/settings', 
    icon: SlidersHorizontal 
  },
];
