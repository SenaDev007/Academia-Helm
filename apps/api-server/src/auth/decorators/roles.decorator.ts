/**
 * Roles Decorator
 * 
 * Décorateur pour spécifier les rôles requis
 */

import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
