/**
 * ============================================================================
 * ADMIN ROLES — Rôles administratifs Academia Helm (FRONTEND COPY)
 * ============================================================================
 *
 * ⚠️  COPIE EXACTE de apps/api-server/src/common/constants/admin-roles.ts
 *     Maintenir les deux fichiers synchronisés en cas de modification.
 *
 * Source unique de vérité pour tous les rôles administratifs d'une école.
 * Utilisé par :
 *   - UnifiedAdministrationWorkspace.tsx (affectations par niveau — point d'entrée centralisé)
 *   - StampDesigner.tsx (génération de signatures/cachets)
 *   - Tout composant frontend qui a besoin de filtrer les postes admin par niveau
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
 *
 * ⭐ Les clés MAT / PRI / SEC / MAT_PRI correspondent aux `unit` du AdminStructureService
 *    (groupes administratifs). On utilise MAT_PRI pour le mode FUSED_MATERNELLE_PRIMAIRE.
 */
export const ROLES_BY_LEVEL: Record<string, AdminRole[]> = {
  MATERNELLE: [
    'DIRECTEUR',
    'SURVEILLANT',
    'SECRETAIRE',
    'SECRETAIRE_COMPTABLE',
    'COMPTABLE',
    'AUTRE',
  ],
  PRIMAIRE: [
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
 * Alias pour compatibilité avec les `unit` du AdminStructureService.
 * Permet de faire `ROLES_BY_UNIT[unit]` où unit ∈ {MAT, PRI, SEC, MAT_PRI, ALL}.
 */
export const ROLES_BY_UNIT: Record<string, AdminRole[]> = {
  MAT: ROLES_BY_LEVEL.MATERNELLE,
  PRI: ROLES_BY_LEVEL.PRIMAIRE,
  SEC: ROLES_BY_LEVEL.SECONDAIRE,
  MAT_PRI: ROLES_BY_LEVEL.MAT_PRI,
  ALL: ROLES_BY_LEVEL.ALL,
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
 * Mapping entre les codes de niveaux (MATERNELLE/PRIMAIRE/SECONDAIRE) et les
 * codes d'unités administratives (MAT/PRI/SEC/MAT_PRI) utilisés par le backend.
 * Permet de faire le lien entre /api/school-levels et /api/admin-structure/groups.
 *
 * ⚠️ Les codes de niveaux sont en français (alignés sur l'enum SchoolLevelType
 *    du Prisma schema). Ne pas utiliser 'PRIMARY'/'SECONDARY' (anglais).
 */
export const LEVEL_CODE_TO_UNIT: Record<string, string> = {
  MATERNELLE: 'MAT',
  PRIMAIRE: 'PRI',
  SECONDAIRE: 'SEC',
};

/**
 * Libellés affichables pour les unités administratives.
 */
export const ADMIN_UNIT_LABELS: Record<string, string> = {
  MAT: 'Maternelle',
  PRI: 'Primaire',
  SEC: 'Secondaire',
  MAT_PRI: 'Maternelle + Primaire',
  ALL: 'Tous les niveaux',
};
