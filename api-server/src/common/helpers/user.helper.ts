/**
 * User Helper
 * 
 * Helpers pour typer et valider les utilisateurs authentifiés
 */

import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Type guard pour vérifier qu'un user est authentifié
 */
export function isAuthenticatedUser(user: any): user is AuthenticatedUser {
  return (
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.tenantId === 'string' &&
    typeof user.email === 'string'
  );
}

/**
 * Assertion pour garantir qu'un user est authentifié
 * @throws Error si le user n'est pas authentifié
 */
export function assertAuthenticatedUser(user: any): asserts user is AuthenticatedUser {
  if (!isAuthenticatedUser(user)) {
    throw new Error('User is not authenticated or missing required properties');
  }
}
