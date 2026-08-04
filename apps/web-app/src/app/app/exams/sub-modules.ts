/**
 * ============================================================================
 * EXAMS MODULE - SUB-MODULES CONFIGURATION
 * ============================================================================
 *
 * Les onglets sont affichés APRÈS sélection du niveau scolaire + piste linguistique.
 * L'onglet "Agrégation & Stats Globales" a été supprimé.
 * L'onglet "Paramétrage" a été renommé en "Paramètres" et refondu.
 * ============================================================================
 */

import {
  LayoutDashboard,
  FileEdit,
  CheckSquare,
  Calculator,
  Users,
  FileText,
  BarChart3,
  History,
  Calendar,
  ClipboardList,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';

export const EXAMS_SUB_MODULES = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/app/exams',
    icon: LayoutDashboard
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
    id: 'unlock-requests',
    label: 'Déverrouillages',
    href: '/app/exams/unlock-requests',
    icon: Lock
  },
  {
    id: 'registre',
    label: 'Registre des notes',
    href: '/app/exams/registre',
    icon: ClipboardList
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
