/**
 * ============================================================================
 * ROLE PERMISSIONS MATRIX - MATRICE OFFICIELLE
 * ============================================================================
 * 
 * Définit les permissions exactes par rôle et par module
 * 
 * ============================================================================
 */

import { UserRole } from '../enums/user-role.enum';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';

export type PermissionMatrix = Record<Module, PermissionAction | null>;

/**
 * Matrice de permissions par rôle
 * null = pas d'accès (menu invisible)
 */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionMatrix> = {
  // 🟥 SUPER ADMIN (Plateforme)
  [UserRole.SUPER_ADMIN]: {
    [Module.ELEVES]: PermissionAction.READ,
    [Module.INSCRIPTIONS]: PermissionAction.READ,
    [Module.DOCUMENTS_SCOLAIRES]: PermissionAction.READ,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.READ,
    [Module.MATERIEL_PEDAGOGIQUE]: PermissionAction.READ,
    [Module.EXAMENS]: PermissionAction.READ,
    [Module.BULLETINS]: PermissionAction.READ,
    [Module.FINANCES]: PermissionAction.READ,
    [Module.RECOUVREMENT]: PermissionAction.READ,
    [Module.DEPENSES]: PermissionAction.READ,
    [Module.RH]: PermissionAction.READ,
    [Module.PAIE]: PermissionAction.READ,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: PermissionAction.MANAGE, // Création école, suspension
    [Module.ANNEES_SCOLAIRES]: PermissionAction.READ,
    [Module.ORION]: PermissionAction.MANAGE, // ORION plateforme
    [Module.QHSE]: PermissionAction.READ,
  },

  // 🟠 PROMOTEUR (École)
  [UserRole.PROMOTEUR]: {
    [Module.ELEVES]: PermissionAction.READ,
    [Module.INSCRIPTIONS]: PermissionAction.READ,
    [Module.DOCUMENTS_SCOLAIRES]: PermissionAction.READ,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.READ,
    [Module.MATERIEL_PEDAGOGIQUE]: PermissionAction.READ,
    [Module.EXAMENS]: PermissionAction.READ,
    [Module.BULLETINS]: PermissionAction.READ,
    [Module.FINANCES]: PermissionAction.MANAGE, // Décisions financières
    [Module.RECOUVREMENT]: PermissionAction.MANAGE,
    [Module.DEPENSES]: PermissionAction.MANAGE,
    [Module.RH]: PermissionAction.READ,
    [Module.PAIE]: PermissionAction.READ,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: PermissionAction.MANAGE, // Accès total
    [Module.ANNEES_SCOLAIRES]: PermissionAction.READ, // + clôture
    [Module.ORION]: PermissionAction.MANAGE, // ORION complet
    [Module.QHSE]: PermissionAction.READ,
  },

  // 🟡 DIRECTEUR
  [UserRole.DIRECTEUR]: {
    [Module.ELEVES]: PermissionAction.MANAGE,
    [Module.INSCRIPTIONS]: PermissionAction.MANAGE,
    [Module.DOCUMENTS_SCOLAIRES]: PermissionAction.MANAGE,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.MANAGE,
    [Module.MATERIEL_PEDAGOGIQUE]: PermissionAction.MANAGE,
    [Module.EXAMENS]: PermissionAction.MANAGE,
    [Module.BULLETINS]: PermissionAction.MANAGE,
    [Module.FINANCES]: PermissionAction.READ, // Lecture uniquement
    [Module.RECOUVREMENT]: PermissionAction.READ,
    [Module.DEPENSES]: PermissionAction.READ,
    [Module.RH]: PermissionAction.READ,
    [Module.PAIE]: PermissionAction.READ,
    [Module.COMMUNICATION]: PermissionAction.MANAGE,
    [Module.PARAMETRES]: PermissionAction.READ, // Hors finance
    [Module.ANNEES_SCOLAIRES]: PermissionAction.READ,
    [Module.ORION]: PermissionAction.MANAGE, // ORION opérationnel
    [Module.QHSE]: PermissionAction.READ,
  },

  // 🟢 SECRÉTAIRE
  [UserRole.SECRETAIRE]: {
    [Module.ELEVES]: PermissionAction.MANAGE,
    [Module.INSCRIPTIONS]: PermissionAction.MANAGE,
    [Module.DOCUMENTS_SCOLAIRES]: PermissionAction.MANAGE,
    [Module.ORGANISATION_PEDAGOGIQUE]: null,
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: null,
    [Module.BULLETINS]: null,
    [Module.FINANCES]: null,
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🟢 COMPTABLE
  [UserRole.COMPTABLE]: {
    [Module.ELEVES]: PermissionAction.READ,
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: null,
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: null,
    [Module.BULLETINS]: null,
    [Module.FINANCES]: PermissionAction.MANAGE,
    [Module.RECOUVREMENT]: PermissionAction.MANAGE,
    [Module.DEPENSES]: PermissionAction.MANAGE,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: null,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🟢 SECRÉTAIRE–COMPTABLE
  [UserRole.SECRETAIRE_COMPTABLE]: {
    [Module.ELEVES]: PermissionAction.MANAGE,
    [Module.INSCRIPTIONS]: PermissionAction.MANAGE,
    [Module.DOCUMENTS_SCOLAIRES]: PermissionAction.MANAGE,
    [Module.ORGANISATION_PEDAGOGIQUE]: null,
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: null,
    [Module.BULLETINS]: null,
    [Module.FINANCES]: PermissionAction.MANAGE,
    [Module.RECOUVREMENT]: PermissionAction.MANAGE,
    [Module.DEPENSES]: PermissionAction.MANAGE,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🔵 CENSEUR (Secondaire)
  [UserRole.CENSEUR]: {
    [Module.ELEVES]: PermissionAction.READ,
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.MANAGE, // Organisation secondaire
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: PermissionAction.READ,
    [Module.BULLETINS]: null,
    [Module.FINANCES]: null,
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: null,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🔵 SURVEILLANT(E)
  [UserRole.SURVEILLANT]: {
    [Module.ELEVES]: PermissionAction.READ,
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.MANAGE, // Absences, retards
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: PermissionAction.READ, // Surveillance examens
    [Module.BULLETINS]: null,
    [Module.FINANCES]: null,
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: null,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🟡 ENSEIGNANT / INSTITUTEUR / PROFESSEUR
  [UserRole.ENSEIGNANT]: {
    [Module.ELEVES]: PermissionAction.READ, // Classes assignées uniquement
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.MANAGE, // Fiches pédagogiques, cahier journal
    [Module.MATERIEL_PEDAGOGIQUE]: PermissionAction.READ, // Consultation matériel assigné
    [Module.EXAMENS]: PermissionAction.MANAGE, // Saisie notes
    [Module.BULLETINS]: PermissionAction.READ,
    [Module.FINANCES]: null,
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🟢 PARENT
  [UserRole.PARENT]: {
    [Module.ELEVES]: PermissionAction.READ, // Enfants uniquement
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: null,
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: null,
    [Module.BULLETINS]: PermissionAction.READ,
    [Module.FINANCES]: PermissionAction.MANAGE, // Paiements (Fedapay)
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },

  // 🟢 ÉLÈVE
  [UserRole.ELEVE]: {
    [Module.ELEVES]: PermissionAction.READ, // Soi-même uniquement
    [Module.INSCRIPTIONS]: null,
    [Module.DOCUMENTS_SCOLAIRES]: null,
    [Module.ORGANISATION_PEDAGOGIQUE]: PermissionAction.READ, // Emploi du temps, devoirs
    [Module.MATERIEL_PEDAGOGIQUE]: null,
    [Module.EXAMENS]: PermissionAction.READ, // Consultation notes
    [Module.BULLETINS]: PermissionAction.READ,
    [Module.FINANCES]: null,
    [Module.RECOUVREMENT]: null,
    [Module.DEPENSES]: null,
    [Module.RH]: null,
    [Module.PAIE]: null,
    [Module.COMMUNICATION]: PermissionAction.READ,
    [Module.PARAMETRES]: null,
    [Module.ANNEES_SCOLAIRES]: null,
    [Module.ORION]: null,
    [Module.QHSE]: null,
  },
};

/**
 * Vérifie si un rôle a une permission sur un module
 */
export function hasPermission(role: UserRole, module: Module, action?: PermissionAction): boolean {
  const permission = ROLE_PERMISSIONS[role]?.[module];
  
  if (!permission) {
    return false; // Pas d'accès
  }

  if (!action) {
    return true; // A au moins un accès
  }

  // Vérifier le niveau d'action
  switch (action) {
    case PermissionAction.READ:
      return permission !== null; // Toute permission inclut la lecture
    case PermissionAction.WRITE:
      return permission === PermissionAction.WRITE || permission === PermissionAction.MANAGE;
    case PermissionAction.DELETE:
      return permission === PermissionAction.DELETE || permission === PermissionAction.MANAGE;
    case PermissionAction.MANAGE:
      return permission === PermissionAction.MANAGE;
    default:
      return false;
  }
}

/**
 * Récupère toutes les permissions d'un rôle
 */
export function getRolePermissions(role: UserRole): PermissionMatrix {
  return ROLE_PERMISSIONS[role] || ({} as PermissionMatrix);
}
