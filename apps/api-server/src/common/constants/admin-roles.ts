/**
 * ============================================================================
 * ADMIN ROLES — Rôles administratifs académia Helm
 * ============================================================================
 *
 * Source unique de vérité pour tous les rôles administratifs d'une école.
 * Utilisé par :
 *   - staff-admin-assignment.service.ts (affectations par niveau)
 *   - stamps-signatures.service.ts (génération de signatures/cachets)
 *   - positions.service.ts (référentiel de postes)
 *   - school-directors.service.ts (rétro-compatibilité)
 *
 * Organisation par niveau scolaire typique :
 *   Maternelle  : Directeur, Surveillant, Secrétaire
 *   Primaire    : Directeur, Surveillant, Secrétaire, Comptable, Secrétaire-Comptable
 *   Secondaire  : Proviseur, Censeur, Surveillant Général, Intendant, Économe,
 *                 Secrétaire, Comptable, Secrétaire-Comptable,
 *                 Conseiller Pédagogique, Directeur des Études,
 *                 Responsable Scolarité, Responsable Orientations
 *
 * Mode bilingue : chaque poste existe en piste FR et piste EN (indépendant).
 * Mode FUSED_MATERNELLE_PRIMAIRE : les postes Maternelle+Primaire sont fusionnés
 *   (schoolLevelCode = 'MAT_PRI').
 * ============================================================================
 */

export const ADMIN_ROLES = [
  // ── Promoteur (propriétaire de l'école) ──
  'PROMOTEUR',              // Promoteur / Fondateur

  // ── Direction ──
  'DIRECTEUR',              // Directeur/Directrice (Maternelle, Primaire)
  'DIRECTEUR_GENERAL',      // Directeur Général (tous niveaux)
  'DIRECTEUR_ADJOINT',      // Directeur Adjoint
  'PROVISEUR',              // Proviseur (Secondaire — cycle 2, lycée)
  'DIRECTEUR_DES_ETUDES',   // Directeur des Études (Secondaire)

  // ── Surveillance / Discipline ──
  'SURVEILLANT_GENERAL',    // Surveillant Général (Secondaire)
  'SURVEILLANT',            // Surveillant de niveau (tous niveaux)

  // ── Censeur ──
  'CENSEUR',                // Censeur (Secondaire — gestion pédagogique)

  // ── Secrétariat ──
  'SECRETAIRE',             // Secrétaire
  'SECRETAIRE_COMPTABLE',   // Secrétaire-Comptable (fusion des deux fonctions)

  // ── Comptabilité / Économat ──
  'COMPTABLE',              // Comptable
  'ECONOME',                // Économe (gestion matérielle)
  'INTENDANT',              // Intendant (Secondaire — alternative à économe)

  // ── Scolarité ──
  'RESP_SCOLARITE',         // Responsable de la Scolarité

  // ── Pédagogie ──
  'CONSEILLER_PEDAGOGIQUE', // Conseiller Pédagogique (Secondaire)

  // ── Orientation ──
  'RESPONSABLE_ORIENTATIONS', // Responsable des Orientations (Secondaire)

  // ── Autre ──
  'AUTRE',                  // Autre poste (libre)
] as const;

export type AdminRole = typeof ADMIN_ROLES[number];

/**
 * Vérifie si un rôle est valide.
 */
export function isValidAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Libellés affichables pour l'UI (français).
 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  PROMOTEUR: 'Promoteur / Fondateur',
  DIRECTEUR: 'Directeur / Directrice',
  DIRECTEUR_GENERAL: 'Directeur Général',
  DIRECTEUR_ADJOINT: 'Directeur Adjoint',
  PROVISEUR: 'Proviseur',
  DIRECTEUR_DES_ETUDES: 'Directeur des Études',
  SURVEILLANT_GENERAL: 'Surveillant Général',
  SURVEILLANT: 'Surveillant',
  CENSEUR: 'Censeur',
  SECRETAIRE: 'Secrétaire',
  SECRETAIRE_COMPTABLE: 'Secrétaire-Comptable',
  COMPTABLE: 'Comptable',
  ECONOME: 'Économe',
  INTENDANT: 'Intendant',
  RESP_SCOLARITE: 'Responsable Scolarité',
  CONSEILLER_PEDAGOGIQUE: 'Conseiller Pédagogique',
  RESPONSABLE_ORIENTATIONS: 'Responsable Orientations',
  AUTRE: 'Autre',
};

/**
 * Rôles typiquement disponibles par niveau scolaire.
 * Utilisé par l'UI pour filtrer les postes proposés selon le niveau sélectionné.
 */
export const ROLES_BY_LEVEL: Record<string, AdminRole[]> = {
  MATERNELLE: [
    'PROMOTEUR',
    'DIRECTEUR',
    'SURVEILLANT',
    'SECRETAIRE',
    'SECRETAIRE_COMPTABLE',
    'COMPTABLE',
    'AUTRE',
  ],
  PRIMAIRE: [
    'PROMOTEUR',
    'DIRECTEUR',
    'SURVEILLANT',
    'SECRETAIRE',
    'SECRETAIRE_COMPTABLE',
    'COMPTABLE',
    'ECONOME',
    'RESP_SCOLARITE',
    'AUTRE',
  ],
  SECONDAIRE: [
    'PROMOTEUR',
    'PROVISEUR',
    'DIRECTEUR_ADJOINT',
    'CENSEUR',
    'SURVEILLANT_GENERAL',
    'SURVEILLANT',
    'SECRETAIRE',
    'SECRETAIRE_COMPTABLE',
    'COMPTABLE',
    'ECONOME',
    'INTENDANT',
    'DIRECTEUR_DES_ETUDES',
    'CONSEILLER_PEDAGOGIQUE',
    'RESP_SCOLARITE',
    'RESPONSABLE_ORIENTATIONS',
    'AUTRE',
  ],
  MAT_PRI: [
    'PROMOTEUR',
    'DIRECTEUR',
    'SURVEILLANT',
    'SECRETAIRE',
    'SECRETAIRE_COMPTABLE',
    'COMPTABLE',
    'ECONOME',
    'RESP_SCOLARITE',
    'AUTRE',
  ],
  ALL: ADMIN_ROLES as AdminRole[],
};

/**
 * Rôles de direction (pour filtrer les postes de direction).
 */
export const DIRECTOR_ROLES: AdminRole[] = [
  'DIRECTEUR',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_ADJOINT',
  'PROVISEUR',
  'DIRECTEUR_DES_ETUDES',
];

/**
 * ⭐ Mapping AdminRole (staff_admin_assignments) → UserRole (plateforme)
 *    Utilisé par staff-credential.service.ts pour déterminer le rôle du
 *    compte User lors de la création/régénération d'identifiants, et par
 *    staff-admin-assignment.service.ts pour mettre à jour le rôle du User
 *    existant quand une affectation admin est créée.
 *
 *    Prioritaire sur refineUserRole(roleType, position) car l'adminRole
 *    dans staff_admin_assignments est EXACT (pas du texte libre).
 *
 * ⭐⭐ Version niveau-spécifique : la fonction resolveUserRole ci-dessous
 *    prend en paramètre l'adminRole ET le schoolLevelCode de l'affectation
 *    pour produire le UserRole niveau-spécifique correspondant (ex:
 *    SECRETAIRE_COMPTABLE + MAT_PRI → SECRETAIRE_COMPTABLE_MAT_PRI).
 *    Cela garantit que le LevelScopeGuard filtre correctement les données
 *    par niveau (un SECRETAIRE_COMPTABLE_PRIMAIRE ne voit que le Primaire).
 */
export const ADMIN_ROLE_TO_USER_ROLE: Record<string, string> = {
  DIRECTEUR: 'DIRECTEUR',
  DIRECTEUR_GENERAL: 'DIRECTEUR',
  DIRECTEUR_ADJOINT: 'DIRECTEUR',
  PROVISEUR: 'DIRECTEUR',
  DIRECTEUR_DES_ETUDES: 'DIRECTEUR',
  SURVEILLANT_GENERAL: 'SURVEILLANT_GENERAL',
  SURVEILLANT: 'SURVEILLANT',
  CENSEUR: 'CENSEUR',
  SECRETAIRE: 'SECRETAIRE',
  SECRETAIRE_COMPTABLE: 'SECRETAIRE_COMPTABLE',
  COMPTABLE: 'COMPTABLE',
  ECONOME: 'COMPTABLE',
  INTENDANT: 'COMPTABLE',
  RESP_SCOLARITE: 'SECRETAIRE',
  CONSEILLER_PEDAGOGIQUE: 'CENSEUR', // ⭐ Corrigé : était ENSEIGNANT (portail enseignant) → maintenant CENSEUR (portail école)
  RESPONSABLE_ORIENTATIONS: 'SECRETAIRE',
  AUTRE: 'SECRETAIRE',
};

/**
 * ⭐ Résout le UserRole final en tenant compte du niveau scolaire de l'affectation.
 *    Si l'adminRole a une version niveau-spécifique dans ROLE_LEVEL_SCOPES
 *    (ex: SECRETAIRE_COMPTABLE_MAT_PRI), on l'utilise pour que le LevelScopeGuard
 *    filtre les données par niveau.
 *
 * @param adminRole L'adminRole de l'affectation (ex: SECRETAIRE_COMPTABLE)
 * @param schoolLevelCode Le code du niveau (ex: MAT_PRI, SEC, MAT, PRI)
 * @returns Le UserRole niveau-spécifique si disponible, sinon le UserRole générique
 */
export function resolveUserRoleWithLevel(adminRole: string, schoolLevelCode: string): string {
  const baseRole = ADMIN_ROLE_TO_USER_ROLE[adminRole] || 'SECRETAIRE';

  // ⭐ Construire le rôle niveau-spécifique (ex: SECRETAIRE_COMPTABLE_MAT_PRI)
  const levelSpecificRole = `${baseRole}_${schoolLevelCode}`;

  // Vérifier si ce rôle niveau-spécifique existe dans ROLE_LEVEL_SCOPES
  // (défini dans level-scope.guard.ts — on importe la liste des rôles valides)
  const LEVEL_SPECIFIC_SUFFIXES = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'MAT_PRI'];
  if (LEVEL_SPECIFIC_SUFFIXES.includes(schoolLevelCode)) {
    return levelSpecificRole;
  }

  // Fallback : rôle générique
  return baseRole;
}
