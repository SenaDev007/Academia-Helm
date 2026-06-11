/**
 * Guards de Permissions Patronat
 * 
 * Vérification des permissions par rôle
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
    { resource: '*', action: '*' }, // Accès total
  ],
  PATRONAT_OPERATOR: [
    { resource: 'exams', action: 'create' },
    { resource: 'exams', action: 'update' },
    { resource: 'candidates', action: '*' },
    { resource: 'centers', action: '*' },
    { resource: 'documents', action: 'generate' },
    { resource: 'question_bank', action: 'upload' },
  ],
  EXAM_SUPERVISOR: [
    { resource: 'exams', action: 'view' },
    { resource: 'candidates', action: 'view' },
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
 * Vérifie si un rôle peut accéder à une route
 */
export function canAccessRoute(role: PatronatRole, route: string): boolean {
  const routePermissions: Record<string, PatronatRole[]> = {
    '/patronat/dashboard': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR', 'EXAM_VIEWER'],
    '/patronat/schools': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/patronat/exams': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/patronat/candidates': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/patronat/centers': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/patronat/documents': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_SUPERVISOR'],
    '/patronat/question-bank': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/patronat/reports': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'EXAM_VIEWER'],
    '/patronat/orion': ['PATRONAT_ADMIN', 'PATRONAT_OPERATOR'],
    '/patronat/settings': ['PATRONAT_ADMIN'],
  };

  const allowedRoles = routePermissions[route] || [];
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

