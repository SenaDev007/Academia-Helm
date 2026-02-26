import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Décorateur pour exiger une permission (module + action) sur une route.
 * À utiliser avec PermissionGuard.
 *
 * Ordre de vérification du guard : JWT → tenant → rôle → permission → feature flag.
 *
 * @param moduleKey Ressource/module (ex: FINANCES, ELEVES, EXAMENS)
 * @param actionKey Action (ex: read, write, delete, validate)
 */
export const RequirePermission = (moduleKey: string, actionKey: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { moduleKey, actionKey });
