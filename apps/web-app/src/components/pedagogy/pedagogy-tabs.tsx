'use client';

import {
  LayoutDashboard,
  Layers,
  BookOpen,
  Users,
  ClipboardList,
  Calendar,
  FileText,
  ShieldCheck,
  BarChart3,
  Package,
  Book,
  CalendarDays,
  NotebookPen,
  Sparkles,
  CalendarClock,
  BookMarked,
} from 'lucide-react';

/**
 * ============================================================================
 * PEDAGOGY SUBMODULE TABS — Configuration centrale + helper de filtrage rôles
 * ============================================================================
 *
 * Le filtrage par rôle est volontairement PERMISSIF :
 *   1. Comparaison case-insensitive (TEACHER == teacher == Teacher)
 *   2. Aliases canoniques (PROMOTER ≡ SCHOOL_OWNER, etc.)
 *   3. Fail-open : si le rôle utilisateur n'est pas reconnu dans la liste
 *      canonique des rôles Academia Helm, on AFFICHE l'onglet par défaut
 *      (mieux vaut trop montrer que cacher l'application à un utilisateur
 *      authentifié dont le rôle a été ajouté côté backend mais pas encore
 *      mis dans la liste ci-dessous).
 *   4. Si userRole est vide/undefined → on affiche tout (l'utilisateur est
 *      déjà authentifié puisqu'il a atteint cette page).
 *
 * Ce helper est partagé par `app/app/pedagogy/page.tsx` (navigation tabs) et
 * `components/pedagogy/PedagogyModuleDashboard.tsx` (shortcuts sur le dashboard).
 * ============================================================================
 */

/**
 * Rôles "direction" (accès complet à tous les onglets pédagogie).
 * Inclut les aliases courants et les variantes FR/EN.
 */
const DIRECTION_ROLES = new Set([
  // Rôles plateforme
  'PLATFORM_OWNER',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  // Rôles école — gouvernance
  'PROMOTER',
  'SCHOOL_OWNER',
  'BOARD_PRESIDENT',
  'DIRECTOR_GENERAL',
  'DIRECTEUR_GENERAL',
  'SCHOOL_DIRECTOR',
  'DIRECTEUR_ETABLISSEMENT',
  'DEPUTY_DIRECTOR',
  'SUPER_DIRECTOR',
  'SUPER_ADMIN',
  // Rôles école — administration
  'SCHOOL_ADMIN',
  'ADMIN_AGENT',
  // Rôles legacy (minuscules)
  'admin',
  'director',
]);

/**
 * Rôles "pédagogie" (accès structure académique, matières, EDT, etc.).
 */
const PEDAGOGIC_ROLES = new Set([
  ...DIRECTION_ROLES,
  'CENSEUR',
  'CENSOR',
  'RESP_SECONDAIRE',
  'RESP_PRIMAIRE',
  'RESP_MATERNELLE',
  'RESP_SCOLARITE',
  'SCOLARITE',
  'PEDAGOGIC_DIRECTOR',
  'PEDAGOGIC_COORDINATOR',
  'PEDAGOGUE',
]);

/**
 * Rôles "enseignant" (accès espace pédagogie, travaux, matériel).
 */
const TEACHER_ROLES = new Set([
  'TEACHER',
  'TEACHER_RESP',
  'TEACHER_ASSISTANT',
  ...PEDAGOGIC_ROLES,
]);

/**
 * Rôles "parent/élève" (consultation bibliothèque uniquement).
 */
const FAMILY_ROLES = new Set(['PARENT', 'STUDENT', 'GUARDIAN']);

/**
 * Tous les rôles canoniques connus. Si userRole n'appartient PAS à cet
 * ensemble, on considère qu'il s'agit d'un rôle non-répertorié et on
 * fail-open (afficher tout).
 */
const ALL_KNOWN_ROLES = new Set<string>([
  ...DIRECTION_ROLES,
  ...TEACHER_ROLES,
  ...FAMILY_ROLES,
  // Portail plateforme (suite)
  'BILLING_MANAGER',
  'SUPPORT_AGENT',
  'TECHNICAL_OPERATOR',
  'PLATFORM_AUDITOR',
  'PLATFORM_BILLING',
  'PLATFORM_SUPPORT',
  'PLATFORM_DEVOPS',
  'PLATFORM_AUDITOR',
  // Portail école (suite)
  'CAISSIER',
  'CASHIER',
  'COMPTABLE',
  'ACCOUNTANT',
  'ECONOME',
  'CFO',
  'FINANCE_MANAGER',
  'RECOVERY_MANAGER',
  'HR_MANAGER',
  'PAYROLL_MANAGER',
  'IT_MANAGER',
  'SETTINGS_MANAGER',
  'COMMUNICATION_MANAGER',
  'COMMUNICATION_AGENT',
  'SCHOOL_LIFE_MANAGER',
  'EXAM_MANAGER',
  // Portail public
  'PUBLIC',
  'GUEST',
  // Legacy / variants
  'secretary',
  'accountant',
  'teacher',
  'parent',
  'student',
  'user',
]);

export interface PedagogySubmoduleTab {
  id: string;
  label: string;
  path: string;
  icon: any;
  /** Roles explicitly allowed to see this tab. If undefined, visible to all. */
  roles?: readonly string[];
}

export const PEDAGOGY_SUBMODULE_TABS: readonly PedagogySubmoduleTab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/app/pedagogy',
    icon: LayoutDashboard,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'director', 'admin', 'TEACHER', 'TEACHER_RESP',
      'PROMOTER', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'academic-structure',
    label: 'Structure académique',
    path: '/app/pedagogy/academic-structure',
    icon: Layers,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'PROMOTER', 'director', 'admin',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'subjects',
    label: 'Matières & programmes',
    path: '/app/pedagogy/subjects',
    icon: BookOpen,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'PROMOTER', 'director', 'admin',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'teachers-academic',
    label: 'Enseignants & Affectations',
    path: '/app/pedagogy/teachers',
    icon: Users,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'PROMOTER', 'director', 'admin',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'timetables',
    label: 'Emploi du temps',
    path: '/app/pedagogy/timetables',
    icon: CalendarDays,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'director', 'admin', 'TEACHER', 'TEACHER_RESP',
      'PROMOTER', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'teacher-space',
    label: 'Espace Pédagogie',
    path: '/app/pedagogy/production',
    icon: NotebookPen,
    roles: [
      'TEACHER', 'TEACHER_RESP',
      'SUPER_DIRECTOR', 'director', 'admin',
      'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR',
      'CENSEUR', 'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'materials',
    label: 'Matériel pédagogique',
    path: '/app/pedagogy/pedagogical-materials',
    icon: Package,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'director', 'admin', 'TEACHER', 'TEACHER_RESP',
      'PROMOTER', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'director-space',
    label: 'Validation Direction',
    path: '/app/pedagogy/control',
    icon: ShieldCheck,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'director', 'admin',
      'PROMOTER', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'orion-pedagogy',
    label: 'Analytique ORION',
    path: '/app/pedagogy/orion',
    icon: BarChart3,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'PROMOTER', 'director', 'admin',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'aggregation',
    label: 'Agrégation & Bilan Global',
    path: '/app/pedagogy/aggregation',
    icon: BarChart3,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'PROMOTER', 'director', 'admin',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'global-library',
    label: 'Bibliothèque virtuelle',
    path: '/app/pedagogy/global-library',
    icon: Book,
    roles: [
      'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'director', 'admin', 'TEACHER', 'TEACHER_RESP', 'PARENT', 'STUDENT',
      'PROMOTER', 'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR', 'GUARDIAN',
    ],
  },
  {
    id: 'teacher-tasks',
    label: 'Travaux & Suivi',
    path: '/app/pedagogy/tasks',
    icon: ClipboardList,
    roles: [
      'TEACHER', 'TEACHER_RESP',
      'SUPER_DIRECTOR', 'director', 'admin',
      'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'CENSEUR', 'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'sara-compose',
    label: 'Sarah Compose (IA)',
    path: '/app/pedagogy/sara-compose',
    icon: Sparkles,
    roles: [
      'TEACHER', 'TEACHER_RESP',
      'SUPER_DIRECTOR', 'director', 'admin',
      'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'CENSEUR', 'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'semainier',
    label: 'Cahier du semainier',
    path: '/app/pedagogy/semainier',
    icon: CalendarClock,
    roles: [
      'TEACHER', 'TEACHER_RESP',
      'SUPER_DIRECTOR', 'director', 'admin',
      'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
  {
    id: 'class-diaries',
    label: 'Cahiers de textes',
    path: '/app/pedagogy/class-diaries',
    icon: BookMarked,
    roles: [
      'TEACHER', 'TEACHER_RESP',
      'SUPER_DIRECTOR', 'director', 'admin',
      'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      'CENSEUR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE', 'RESP_MATERNELLE',
      'PEDAGOGIC_DIRECTOR', 'PEDAGOGIC_COORDINATOR',
    ],
  },
];

/**
 * Vérifie si un utilisateur avec le rôle donné peut voir l'onglet spécifié.
 *
 * RÈGLES :
 *   1. Si tab.roles est vide/undefined → visible par tous.
 *   2. Comparaison case-insensitive.
 *   3. Si userRole est vide → visible (utilisateur authentifié, fail-open).
 *   4. Si userRole n'appartient pas à ALL_KNOWN_ROLES → visible (rôle
 *      non-répertorié, fail-open pour éviter de cacher l'app).
 *   5. Sinon, vérifie l'inclusion case-insensitive.
 */
export function tabMatchesRole(tab: PedagogySubmoduleTab, userRole: string | undefined | null): boolean {
  if (!tab.roles || tab.roles.length === 0) return true;
  if (!userRole) return true; // Fail-open : utilisateur authentifié sans rôle explicite.

  const normalized = userRole.trim();
  if (!normalized) return true;

  // Si le rôle n'est pas dans notre liste canonique, fail-open.
  if (!ALL_KNOWN_ROLES.has(normalized)) return true;

  // Comparaison case-insensitive.
  const upper = normalized.toUpperCase();
  const lower = normalized.toLowerCase();
  return tab.roles.some((r) => r === upper || r === lower || r.toUpperCase() === upper);
}

/**
 * Filtre la liste des onglets visibles pour un rôle donné.
 * Utilisé par la page pédagogie et par le dashboard (shortcuts).
 */
export function getVisiblePedagogyTabs(userRole: string | undefined | null): PedagogySubmoduleTab[] {
  return PEDAGOGY_SUBMODULE_TABS.filter((tab) => tabMatchesRole(tab, userRole));
}
