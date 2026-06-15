/**
 * ============================================================================
 * REQUIRED PERMISSION DECORATOR
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '../enums/permission-action.enum';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * Décorateur pour spécifier l'action de permission requise
 * Utilisé avec @RequiredModule
 */
export const RequiredPermission = (action: PermissionAction) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, action);
