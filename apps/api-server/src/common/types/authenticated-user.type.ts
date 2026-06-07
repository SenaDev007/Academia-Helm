/**
 * Authenticated User Type
 * 
 * Type garantissant que l'utilisateur authentifié contient
 * toutes les propriétés nécessaires pour les guards et services
 */

import { User } from '@prisma/client';

/**
 * Utilisateur authentifié avec propriétés garanties
 */
export interface AuthenticatedUser extends User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isSuperAdmin: boolean;
}
