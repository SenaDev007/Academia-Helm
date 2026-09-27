/**
 * Guards de Permissions Patronat — Academia Federis
 *
 * Rôles (cahier des charges §11) :
 *   - PATRONAT_ADMIN     : tous les modules de son périmètre
 *   - PATRONAT_OPERATOR  : examens, candidats et centres
 *   - EXAM_SUPERVISOR    : lecture seule élargie
 *   - EXAM_VIEWER        : lecture seule (inspecteur)
 *
 * Les routes /patronat/* (domaine principal) et /federis/* (sous-domaine
 * academiafederis.academiahelm.com, réécrit par le middleware) partagent la
 * même table de permissions.
 */

export type PatronatRole =
  | 'PATRONAT_ADMIN'
  | 'PATRONAT_OPERATOR'
  | 'EXAM_SUPERVISOR'
  | 'EXAM_VIEWER';

export interface Permission {
  resource: string;
  action: string;
}

const ROLE_PERMISSIONS: Record<PatronatRole, Permission[]> = {
  PATRONAT_ADMIN: [
    { resource: '*', action: '*' }, // Accès total du périmètre
  ],
  PATRONAT_OPERATOR: [
    { resource: 'exams', action: 'create' },
    { resource: 'exams', action: 'update' },
    { resource: 'candidates', action: '*' },
    { resource: 'centers', action: '*' },
    { resource: 'documents', action: 'generate' },
    { resource: 'question_bank', action: 'upload' },
    { resource: 'schools', action: 'view' },
  ],
  EXAM_SUPERVISOR: [
    { resource: 'exams', action: 'view' },
    { resource: 'candidates', action: 'view' },
    { resource: 'centers', action: 'view' },
    { resource: 'documents', action: 'view' },
    { resource: 'reports', action: 'view' },
  ],
  EXAM_VIEWER: [
    { resource: 'exams', action: 'view' },
    { resource: 'candidates', action: 'view' },
    { resource: 'reports', action: 'view' },
  ],
};

/**
 * Vérifie si un rôle a une permission
 */
export function hasPermission(
  role: PatronatRole,
  resource: string,
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];

  return permissions.some((perm) => {
    if (perm.resource === '*' && perm.action === '*') return true;
    if (perm.resource === '*' && perm.action === action) return true;
    if (perm.resource === resource && perm.action === '*') return true;
    if (perm.resource === resource && perm.action === action) return true;
    return false;
  });
}

/**
 * Normalise un chemin /patronat/* ou /federis/* vers la clé de route canonique.
 * Exemples : /federis/dashboard → /dashboard ; /patronat/schools/x → /schools
 */
function normalizeRoute(route: string): string {
  let p = route.split('?')[0];
  p = p.replace(/^\/(patronat|federis)/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  // Réduit à la première section (ex: /schools/xyz → /schools)
  const segments = p.split('/').filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : '/';
}

/**
 * Vérifie si un rôle peut accéder à une route
 */
export function canAccessRoute(role: PatronatRole, route: string): boolean {
  const routePermissions: Record<string, PatronatRole[]> = {
    '/dashboard': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR', 'EXAM_VIEWER'],
    // §8.2 : réservé aux rôles nationaux — le niveau NATIONAL est vérifié côté API
    '/patronats': ['PATRONAT_ADMIN'],
    '/schools': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/bureau': ['PATRONAT_ADMIN'],
    '/exams': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/candidates': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/centers': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/documents': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/question-bank': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/deliberations': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/reports': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR', 'EXAM_VIEWER'],
    '/orion': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/conflicts': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/settings': ['PATRONAT_ADMIN'],
  };

  const normalized = normalizeRoute(route);
  const allowedRoles = routePermissions[normalized];
  if (!allowedRoles) {
    // Route inconnue : autorisée (les pages gèrent leur propre protection)
    return true;
  }
  return allowedRoles.includes(role);
}

/**
 * Hook pour vérifier les permissions dans les composants
 */
export function usePatronatPermissions(role: PatronatRole) {
  return {
    can: (resource: string, action: string) => hasPermission(role, resource, action),
    canAccess: (route: string) => canAccessRoute(role, route),
  };
}
