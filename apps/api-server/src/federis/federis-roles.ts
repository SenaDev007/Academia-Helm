/**
 * federis-roles.ts — Rôles & fonctions patronat (Academia Federis)
 *
 * Structure des utilisateurs d'un patronat (cahier des charges §11 + décisions
 * produit 2026-09) — chaque patronat dispose à la base de :
 *   - COORDONNATEUR  : responsable du patronat — accès à TOUTE l'application
 *                      + création des comptes des autres membres
 *   - SECRETAIRE     : secrétariat — registres, candidats, documents, PV
 *   - TRESORIER      : finances — abonnement, factures, quotas
 *   - ORGANISATEUR   : organisation matérielle — examens, centres, salles,
 *                      affectation des candidats et numéros de table
 *   - CHARGE_MISSION : suivi & reporting — consultation, rapports, ORION
 *
 * Convention de stockage :
 *   - User.role          = rôle préfixé « PATRONAT_ » (mapping portail login) :
 *     PATRONAT_COORDONNATEUR, PATRONAT_SECRETAIRE, PATRONAT_TRESORIER,
 *     PATRONAT_ORGANISATEUR, PATRONAT_CHARGE_MISSION
 *   - PatronatUser.role  = clé de fonction courte : COORDONNATEUR, SECRETAIRE…
 *
 * Compatibilité legacy :
 *   - PATRONAT_ADMIN (User.role & PatronatUser.role) = alias COORDONNATEUR
 *     (comptes créés par /federis/public/register avant cette version)
 *   - PATRONAT_OPERATOR  ≈ ORGANISATEUR
 *   - EXAM_SUPERVISOR / EXAM_VIEWER = lecture seule
 */

/** Fonctions normalisées d'un patronat. */
export type PatronatFunction =
  | 'COORDONNATEUR'
  | 'SECRETAIRE'
  | 'TRESORIER'
  | 'ORGANISATEUR'
  | 'CHARGE_MISSION'
  /** legacy PATRONAT_OPERATOR (organisation des examens) */
  | 'OPERATOR'
  /** lecture seule élargie (EXAM_SUPERVISOR / EXAM_VIEWER / inconnu) */
  | 'VIEWER';

/** Catalogue des fonctions créables par le coordonnateur (UI + validation). */
export const PATRONAT_FUNCTIONS = {
  COORDONNATEUR: {
    key: 'COORDONNATEUR',
    label: 'Coordonnateur',
    description: "Responsable du patronat — accès complet à l'application et gestion des comptes",
    userRole: 'PATRONAT_COORDONNATEUR',
  },
  SECRETAIRE: {
    key: 'SECRETAIRE',
    label: 'Secrétaire',
    description: 'Secrétariat — registres, candidats, documents et procès-verbaux',
    userRole: 'PATRONAT_SECRETAIRE',
  },
  TRESORIER: {
    key: 'TRESORIER',
    label: 'Trésorier',
    description: 'Finances — abonnement, factures et suivi des quotas',
    userRole: 'PATRONAT_TRESORIER',
  },
  ORGANISATEUR: {
    key: 'ORGANISATEUR',
    label: 'Organisateur',
    description: 'Organisation des examens — centres, salles, candidats et numéros de table',
    userRole: 'PATRONAT_ORGANISATEUR',
  },
  CHARGE_MISSION: {
    key: 'CHARGE_MISSION',
    label: 'Chargé de mission',
    description: 'Suivi et reporting — consultation, rapports et alertes ORION',
    userRole: 'PATRONAT_CHARGE_MISSION',
  },
} as const;

export type PatronatFunctionKey = keyof typeof PATRONAT_FUNCTIONS;

/** Clés acceptées à la création / modification d'un compte membre. */
export const CREATABLE_FUNCTIONS = Object.keys(PATRONAT_FUNCTIONS) as PatronatFunctionKey[];

/**
 * Normalise n'importe quelle valeur de rôle (User.role préfixé, clé de
 * fonction PatronatUser, ou legacy) vers la fonction canonique.
 * PLATFORM_OWNER / SUPER_ADMIN = accès universel (chemin owner Helm).
 */
export function normalizePatronatFunction(role?: string | null): PatronatFunction {
  switch (role) {
    case 'PLATFORM_OWNER':
    case 'PLATFORM_SUPER_ADMIN':
    case 'SUPER_ADMIN':
      return 'COORDONNATEUR';
    case 'PATRONAT_ADMIN':
    case 'PATRONAT_COORDONNATEUR':
    case 'COORDONNATEUR':
      return 'COORDONNATEUR';
    case 'PATRONAT_SECRETAIRE':
    case 'SECRETAIRE':
      return 'SECRETAIRE';
    case 'PATRONAT_TRESORIER':
    case 'TRESORIER':
      return 'TRESORIER';
    case 'PATRONAT_ORGANISATEUR':
    case 'ORGANISATEUR':
    case 'PATRONAT_OPERATOR':
      return 'ORGANISATEUR';
    case 'PATRONAT_CHARGE_MISSION':
    case 'CHARGE_MISSION':
      return 'CHARGE_MISSION';
    case 'EXAM_SUPERVISOR':
      return 'OPERATOR';
    default:
      return 'VIEWER';
  }
}

/** Libellé lisible d'une fonction (réponses API). */
export function patronatFunctionLabel(fn: PatronatFunction): string {
  if (fn === 'OPERATOR') return 'Superviseur';
  if (fn === 'VIEWER') return 'Observateur';
  return PATRONAT_FUNCTIONS[fn].label;
}

// ── Matrice de permissions backend (routes /federis/**) ─────────────────────

/** Tous les rôles patronat légitimes (lecture de base). */
export const ALL_PATRONAT_FUNCTIONS: PatronatFunction[] = [
  'COORDONNATEUR',
  'SECRETAIRE',
  'TRESORIER',
  'ORGANISATEUR',
  'CHARGE_MISSION',
  'OPERATOR',
  'VIEWER',
];

/** Création / modification : examens, centres, salles, affectations. */
export const WRITE_EXAM_ORG: PatronatFunction[] = ['COORDONNATEUR', 'ORGANISATEUR'];
/** Candidats : ajout, import Excel, correction des registres. */
export const WRITE_CANDIDATES: PatronatFunction[] = ['COORDONNATEUR', 'ORGANISATEUR', 'SECRETAIRE'];
/** Gestion des comptes membres (réservée au coordonnateur). */
export const MANAGE_USERS: PatronatFunction[] = ['COORDONNATEUR'];
/** Abonnement & facturation (checkout). */
export const MANAGE_BILLING: PatronatFunction[] = ['COORDONNATEUR', 'TRESORIER'];

export function hasFunction(fn: PatronatFunction, allowed: PatronatFunction[]): boolean {
  return allowed.includes(fn);
}
