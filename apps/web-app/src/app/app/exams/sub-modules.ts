/**
 * ============================================================================
 * EXAMS MODULE - SUB-MODULES CONFIGURATION
 * ============================================================================
 *
 * Les onglets sont affichés APRÈS sélection du niveau scolaire.
 * Depuis la V10 (miroirs bilingues), la piste linguistique est DÉDUITE du
 * niveau : Nursery/Primary → EN, Maternelle/Primaire/Secondaire → FR.
 * L'onglet "Agrégation & Stats Globales" a été supprimé.
 * L'onglet "Paramétrage" a été renommé en "Paramètres" et refondu.
 * L'onglet "Conseils de classe" a été supprimé (plus utilisé, tous niveaux).
 * ============================================================================
 */

import {
  LayoutDashboard,
  FileEdit,
  CheckSquare,
  Calculator,
  FileText,
  BarChart3,
  History,
  Calendar,
  ClipboardList,
  SlidersHorizontal,
  Lock,
  Landmark
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
    label: 'Déverrouillage',
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
    // ⭐ V10g — Récapitulatif trimestriel (piste anglophone uniquement) :
    // First CA + Second CA + Examination = /100 par matière.
    // Onglet masqué pour les niveaux francophones (useExamSubModules).
    id: 'term-recap',
    label: 'Récapitulatif trimestriel',
    href: '/app/exams/recap',
    icon: Calculator
  },
  {
    id: 'bulletins',
    label: 'Bulletins',
    href: '/app/exams/bulletins',
    icon: FileText
  },
  {
    // ⭐ Examens nationaux (CEP / BEPC / Baccalauréat) — candidats présentés
    //    par l'école aux patronats (Academia Federis). Onglet dynamique :
    //    sous-onglets CEP/BEPC/Bac selon les classes CM2/3ème/Terminale.
    //    Masqué pour Maternelle et les pistes anglophones (useExamSubModules).
    id: 'national-exams',
    label: 'Examens nationaux',
    href: '/app/exams/national-exams',
    icon: Landmark
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
