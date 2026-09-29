/**
 * Guards de Permissions Patronat — Academia Federis
 *
 * UI Shells par fonction (pattern Academia Helm — admin-portal-map) :
 *   - COORDONNATEUR  : le responsable — TOUTE l'application + gestion des comptes
 *   - SECRETAIRE     : secrétariat — registres, candidats, documents, PV, conflits
 *   - TRESORIER      : finances — abonnement, factures, quotas
 *   - ORGANISATEUR   : organisation — examens, centres, salles, candidats, ORION
 *   - CHARGE_MISSION : suivi & reporting — consultation, rapports, ORION
 *
 * Rôles techniques (stockés en base) :
 *   - User.role          : PATRONAT_COORDONNATEUR, PATRONAT_SECRETAIRE, …
 *   - PatronatUser.role  : COORDONNATEUR, SECRETAIRE, … (fonction courte)
 *   - Legacy : PATRONAT_ADMIN (= coordonnateur, comptes /register),
 *     PATRONAT_OPERATOR (= organisateur), EXAM_SUPERVISOR / EXAM_VIEWER (lecture)
 *
 * Les routes /patronat/* (domaine principal) et /federis/* (sous-domaine
 * academiafederis.academiahelm.com, réécrit par le middleware) partagent la
 * même table de permissions.
 */

export type PatronatRole =
  // Fonctions (création de comptes par le coordonnateur)
  | 'PATRONAT_COORDONNATEUR'
  | 'PATRONAT_SECRETAIRE'
  | 'PATRONAT_TRESORIER'
  | 'PATRONAT_ORGANISATEUR'
  | 'PATRONAT_CHARGE_MISSION'
  // Legacy
  | 'PATRONAT_ADMIN'
  | 'PATRONAT_OPERATOR'
  | 'PATRONAT_USER'
  | 'EXAM_SUPERVISOR'
  | 'EXAM_VIEWER';

/** Fonction normalisée (pilote l'UI Shell). */
export type PatronatFunctionKey =
  | 'COORDONNATEUR'
  | 'SECRETAIRE'
  | 'TRESORIER'
  | 'ORGANISATEUR'
  | 'CHARGE_MISSION'
  | 'OPERATOR' // legacy PATRONAT_OPERATOR / EXAM_SUPERVISOR
  | 'VIEWER'; // EXAM_VIEWER / inconnu

/** Libellés métier des fonctions. */
export const PATRONAT_FUNCTION_LABELS: Record<PatronatFunctionKey, string> = {
  COORDONNATEUR: 'Coordonnateur',
  SECRETAIRE: 'Secrétaire',
  TRESORIER: 'Trésorier',
  ORGANISATEUR: 'Organisateur',
  CHARGE_MISSION: 'Chargé de mission',
  OPERATOR: 'Superviseur',
  VIEWER: 'Observateur',
};

/** Descriptions courtes (page Équipe & Comptes). */
export const PATRONAT_FUNCTION_DESCRIPTIONS: Partial<Record<PatronatFunctionKey, string>> = {
  COORDONNATEUR: "Responsable du patronat — accès complet à l'application et gestion des comptes",
  SECRETAIRE: 'Secrétariat — registres, candidats, documents et procès-verbaux',
  TRESORIER: 'Finances — abonnement, factures et suivi des quotas',
  ORGANISATEUR: 'Organisation des examens — centres, salles, candidats et numéros de table',
  CHARGE_MISSION: 'Suivi et reporting — consultation, rapports et alertes ORION',
};

/** Fonctions créables par le coordonnateur. */
export const CREATABLE_FUNCTIONS: PatronatFunctionKey[] = [
  'COORDONNATEUR',
  'SECRETAIRE',
  'TRESORIER',
  'ORGANISATEUR',
  'CHARGE_MISSION',
];

/**
 * Normalise un rôle technique (User.role préfixé, PatronatUser.role court ou
 * legacy) vers la fonction canonique qui pilote l'UI Shell.
 * PLATFORM_OWNER / SUPER_ADMIN = accès universel (chemin owner Helm).
 */
export function normalizePatronatRole(role?: string | null): PatronatFunctionKey {
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

/** Libellé lisible d'un rôle technique quelconque. */
export function patronatRoleLabel(role?: string | null): string {
  return PATRONAT_FUNCTION_LABELS[normalizePatronatRole(role)];
}

// ── Matrice routes ↔ fonctions (UI Shells) ──────────────────────────────────
// Le coordonnateur voit TOUT ; les autres fonctions voient leur périmètre.
// « Patronats territoriaux » est en plus soumis à orgLevel NATIONAL côté API.

type RouteRoles = Record<string, PatronatFunctionKey[]>;

const ROUTE_PERMISSIONS: RouteRoles = {
  '/dashboard': ['COORDONNATEUR', 'SECRETAIRE', 'TRESORIER', 'ORGANISATEUR', 'CHARGE_MISSION', 'OPERATOR', 'VIEWER'],
  // §8.2 : réservé aux rôles nationaux — le niveau NATIONAL est vérifié côté API
  '/patronats': ['COORDONNATEUR'],
  '/bureau': ['COORDONNATEUR', 'SECRETAIRE'],
  '/schools': ['COORDONNATEUR', 'SECRETAIRE', 'TRESORIER', 'ORGANISATEUR', 'CHARGE_MISSION', 'OPERATOR'],
  '/exams': ['COORDONNATEUR', 'ORGANISATEUR'],
  '/centers': ['COORDONNATEUR', 'ORGANISATEUR'],
  '/candidates': ['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR', 'CHARGE_MISSION', 'OPERATOR'],
  // ⭐ Notes et Moyennes (2026-09-29) — même chaîne que la délibération :
  //    saisie des notes (grille CEP primaire / BEPC-BAC-CAP coefficients),
  //    registre et relevés
  '/grades': ['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR'],
  '/deliberations': ['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR'],
  '/documents': ['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR', 'CHARGE_MISSION', 'OPERATOR'],
  '/question-bank': ['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR'],
  '/reports': ['COORDONNATEUR', 'SECRETAIRE', 'TRESORIER', 'ORGANISATEUR', 'CHARGE_MISSION', 'OPERATOR', 'VIEWER'],
  '/orion': ['COORDONNATEUR', 'ORGANISATEUR', 'CHARGE_MISSION'],
  '/conflicts': ['COORDONNATEUR', 'SECRETAIRE'],
  '/settings': ['COORDONNATEUR', 'TRESORIER'],
  '/checkout': ['COORDONNATEUR', 'TRESORIER'],
  // ⭐ Équipe & Comptes — création des users par le coordonnateur uniquement
  '/team': ['COORDONNATEUR'],
};

/**
 * Normalise un chemin /patronat/* ou /federis/* vers la clé de route canonique.
 * Exemples : /federis/dashboard → /dashboard ; /patronat/schools/x → /schools
 * ⚠️ Le préfixe n'est retiré que s'il forme un segment complet : '/patronats'
 *    (page Patronats territoriaux) ne doit PAS être confondu avec '/patronat/…'.
 */
function normalizeRoute(route: string): string {
  let p = route.split('?')[0];
  p = p.replace(/^\/(patronat|federis)(?=\/|$)/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  // Réduit à la première section (ex: /schools/xyz → /schools)
  const segments = p.split('/').filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : '/';
}

/**
 * Vérifie si une fonction peut accéder à une route.
 * @param role rôle technique (User.role ou PatronatUser.role) — normalisé ici
 */
export function canAccessRoute(role: PatronatRole | string | null | undefined, route: string): boolean {
  const fn = normalizePatronatRole(role);
  const normalized = normalizeRoute(route);
  const allowed = ROUTE_PERMISSIONS[normalized];
  if (!allowed) {
    // Route inconnue : autorisée (les pages gèrent leur propre protection)
    return true;
  }
  return allowed.includes(fn);
}

/** Vérifie si la fonction peut écrire (boutons d'action) selon le domaine. */
export function canWrite(
  role: PatronatRole | string | null | undefined,
  domain: 'exam_org' | 'candidates' | 'users' | 'billing',
): boolean {
  const fn = normalizePatronatRole(role);
  switch (domain) {
    case 'exam_org': // examens, centres, salles, affectations
      return fn === 'COORDONNATEUR' || fn === 'ORGANISATEUR';
    case 'candidates': // candidats + import Excel
      return fn === 'COORDONNATEUR' || fn === 'ORGANISATEUR' || fn === 'SECRETAIRE';
    case 'users': // gestion des comptes
      return fn === 'COORDONNATEUR';
    case 'billing': // abonnement / checkout
      return fn === 'COORDONNATEUR' || fn === 'TRESORIER';
    default:
      return false;
  }
}

/**
 * Hook pour vérifier les permissions dans les composants.
 * @param role rôle technique (User.role de la session ou PatronatUser.role du profil)
 */
export function usePatronatPermissions(role: PatronatRole | string | null | undefined) {
  return {
    function: normalizePatronatRole(role),
    label: patronatRoleLabel(role),
    canAccess: (route: string) => canAccessRoute(role, route),
    canWrite,
    isCoordinator: normalizePatronatRole(role) === 'COORDONNATEUR',
  };
}
