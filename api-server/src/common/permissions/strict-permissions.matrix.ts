/**
 * ============================================================================
 * STRICT PERMISSIONS MATRIX - MATRICE DE PERMISSIONS STRICTE
 * ============================================================================
 * 
 * ⚠️ MATRICE OFFICIELLE - RÉFÉRENCE ABSOLUE
 * 
 * Actions disponibles :
 * - READ = Lecture seule
 * - WRITE = Création/Écriture
 * - DELETE = Suppression
 * - MANAGE = Gestion complète (lecture + écriture + suppression)
 * 
 * ============================================================================
 */

import { UserRole } from '../enums/user-role.enum';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';

/**
 * Matrice stricte : Module → Action → Rôles autorisés
 */
export const STRICT_PERMISSIONS_MATRIX: Record<
  Module,
  Record<PermissionAction, UserRole[]>
> = {
  // ============================================================================
  // 1. PARAMÈTRES
  // Promoteur: CRUA | Directeur: R | Comptable: R | Secrétaire: R | Autres: X
  // ============================================================================
  [Module.PARAMETRES]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR], // C
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR], // U (modification = suppression puis création)
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR], // A (Approuver/Valider) - Promoteur = super-set
  },

  // ============================================================================
  // 2. ÉLÈVES & SCOLARITÉ
  // ============================================================================
  [Module.ELEVES]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.SECRETAIRE,
      UserRole.COMPTABLE,
      UserRole.ENSEIGNANT,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  // ============================================================================
  // 3. ORGANISATION PÉDAGOGIQUE
  // ============================================================================
  [Module.ORGANISATION_PEDAGOGIQUE]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.CENSEUR,
      UserRole.ENSEIGNANT,
      UserRole.SURVEILLANT,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR, UserRole.ENSEIGNANT],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  // ============================================================================
  // 4. EXAMENS, NOTES & BULLETINS
  // ============================================================================
  [Module.EXAMENS]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.CENSEUR,
      UserRole.ENSEIGNANT,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR, UserRole.ENSEIGNANT],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR],
  },

  // ============================================================================
  // 5. FINANCES & ÉCONOMAT
  // ============================================================================
  [Module.FINANCES]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.COMPTABLE,
      UserRole.SECRETAIRE_COMPTABLE,
      UserRole.DIRECTEUR,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE_COMPTABLE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
  },

  // ============================================================================
  // 6. PERSONNEL, RH & PAIE
  // ============================================================================
  [Module.RH]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.COMPTABLE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  // ============================================================================
  // 7. COMMUNICATION
  // ============================================================================
  [Module.COMMUNICATION]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.SECRETAIRE,
      UserRole.ENSEIGNANT,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  // ============================================================================
  // 8. QHSE, INCIDENTS & CONFORMITÉ
  // ============================================================================
  [Module.QHSE]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.SURVEILLANT,
      UserRole.ENSEIGNANT,
      UserRole.PARENT,
      UserRole.ELEVE,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SURVEILLANT, UserRole.ENSEIGNANT],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  // ============================================================================
  // 9. PILOTAGE DIRECTION & ORION
  // ============================================================================
  [Module.ORION]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR], // ORION = lecture seule
    [PermissionAction.WRITE]: [], // ❌ ORION ne permet jamais d'écrire
    [PermissionAction.DELETE]: [], // ❌ ORION ne permet jamais de supprimer
    [PermissionAction.MANAGE]: [], // ❌ ORION ne permet jamais de gérer
  },

  // Modules supplémentaires
  [Module.INSCRIPTIONS]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE, UserRole.PARENT],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  [Module.MATERIEL_PEDAGOGIQUE]: {
    [PermissionAction.READ]: [
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
      UserRole.SECRETAIRE,
      UserRole.ENSEIGNANT,
    ],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },


  // Modules supplémentaires (si définis)
  [Module.DOCUMENTS_SCOLAIRES]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE, UserRole.ENSEIGNANT, UserRole.PARENT, UserRole.ELEVE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  [Module.BULLETINS]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR, UserRole.ENSEIGNANT, UserRole.PARENT, UserRole.ELEVE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.CENSEUR],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  [Module.RECOUVREMENT]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE_COMPTABLE, UserRole.DIRECTEUR],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE_COMPTABLE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
  },

  [Module.DEPENSES]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE_COMPTABLE, UserRole.DIRECTEUR],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE, UserRole.SECRETAIRE_COMPTABLE],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.COMPTABLE],
  },

  [Module.PAIE]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.COMPTABLE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
  },

  [Module.ANNEES_SCOLAIRES]: {
    [PermissionAction.READ]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR, UserRole.SECRETAIRE],
    [PermissionAction.WRITE]: [UserRole.PROMOTEUR, UserRole.DIRECTEUR],
    [PermissionAction.DELETE]: [UserRole.PROMOTEUR],
    [PermissionAction.MANAGE]: [UserRole.PROMOTEUR],
  },

  // ============================================================================
  // 11. ACADEMIA FEDERIS (PATRONAT & EXAMENS)
  // ============================================================================
  [Module.FEDERIS]: {
    [PermissionAction.READ]: [
      UserRole.FEDERIS_ADMIN,
      UserRole.FEDERIS_CHEF_CENTRE,
      UserRole.FEDERIS_CORRECTEUR,
      UserRole.FEDERIS_SURVEILLANT,
      UserRole.PROMOTEUR,
      UserRole.DIRECTEUR,
    ],
    [PermissionAction.WRITE]: [
      UserRole.FEDERIS_ADMIN,
      UserRole.FEDERIS_CHEF_CENTRE,
      UserRole.FEDERIS_CORRECTEUR,
    ],
    [PermissionAction.DELETE]: [UserRole.FEDERIS_ADMIN],
    [PermissionAction.MANAGE]: [UserRole.FEDERIS_ADMIN],
  },
};

/**
 * Vérifie si un rôle a une permission stricte sur un module
 * 
 * ⚠️ Aucune permission implicite
 * ⚠️ Promoteur = super-set (a toutes les permissions)
 */
export function hasStrictPermission(
  role: UserRole,
  module: Module,
  action: PermissionAction,
): boolean {
  // PLATFORM_OWNER bypass (dev only, géré ailleurs)
  // Promoteur = super-set : a toutes les permissions
  if (role === UserRole.PROMOTEUR) {
    return true; // Promoteur a accès à tout
  }

  // Vérifier dans la matrice stricte
  const modulePermissions = STRICT_PERMISSIONS_MATRIX[module];
  if (!modulePermissions) {
    return false; // Module non défini = interdit
  }

  const allowedRoles = modulePermissions[action];
  if (!allowedRoles || allowedRoles.length === 0) {
    return false; // Action non autorisée pour ce module
  }

  return allowedRoles.includes(role);
}

/**
 * Récupère tous les rôles autorisés pour une action sur un module
 */
export function getAllowedRoles(
  module: Module,
  action: PermissionAction,
): UserRole[] {
  const modulePermissions = STRICT_PERMISSIONS_MATRIX[module];
  if (!modulePermissions) {
    return [];
  }

  const allowedRoles = modulePermissions[action];
  return allowedRoles || [];
}
