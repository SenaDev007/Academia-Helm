/**
 * ============================================================================
 * RÔLES UTILISATEUR — Constantes partagées
 * ============================================================================
 *
 * Le PROMOTEUR est le propriétaire de l'école (tenant). Il a les mêmes
 * droits que PLATFORM_OWNER sur son tenant — il ne peut JAMAIS être bloqué.
 *
 * Hiérarchie :
 *   1. PLATFORM_OWNER / PLATFORM_SUPER_ADMIN / SUPER_ADMIN (niveau plateforme)
 *   2. PROMOTEUR / PROMOTER (propriétaire de l'école)
 *   3. SUPER_DIRECTOR / DIRECTOR_GENERAL / DIRECTEUR (direction)
 *   4. ADMIN / SCHOOL_ADMIN (administration)
 *   5. ACCOUNTANT (comptable)
 *   6. TEACHER (enseignant)
 *   7. PARENT / STUDENT (consultation)
 * ============================================================================
 */

/**
 * Tous les rôles d'administration qui peuvent modifier les paramètres
 * et effectuer des opérations de gestion dans l'école.
 *
 * Le PROMOTEUR est inclus car c'est le propriétaire de l'école.
 */
export const ALL_ADMIN_ROLES = [
  'PLATFORM_OWNER',
  'PLATFORM_SUPER_ADMIN',
  'SUPER_ADMIN',
  'PROMOTEUR',
  'PROMOTER',
  'SUPER_DIRECTOR',
  'DIRECTOR',
  'DIRECTOR_GENERAL',
  'DIRECTEUR',
  'DIRECTEUR_GENERAL',
  'ADMIN',
  'SCHOOL_ADMIN',
  'SCHOOL_OWNER',
] as const;

/**
 * Rôles qui peuvent consulter les données financières (lecture seule).
 */
export const ALL_READ_ROLES = [
  ...ALL_ADMIN_ROLES,
  'ACCOUNTANT',
  'TEACHER',
  'PARENT',
  'STUDENT',
] as const;

/**
 * Rôles qui peuvent encaisser des paiements (caisse).
 */
export const CASHIER_ROLES = [
  ...ALL_ADMIN_ROLES,
  'ACCOUNTANT',
] as const;
