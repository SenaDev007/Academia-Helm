/**
 * ============================================================================
 * PORTAL TYPE GUARD - VÉRIFICATION DU TYPE DE PORTAIL
 * ============================================================================
 * 
 * Guard pour vérifier que l'utilisateur accède au bon portail
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PORTAL_TYPE_KEY } from '../decorators/portal-type.decorator';

@Injectable()
export class PortalTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPortalType = this.reflector.getAllAndOverride<string>(
      PORTAL_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPortalType) {
      // Aucun type de portail requis, autoriser l'accès
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Vérifier le type de portail depuis le token JWT
    const userPortalType = user.portalType;

    if (userPortalType !== requiredPortalType) {
      throw new ForbiddenException(
        `Access denied. This endpoint is only accessible from ${requiredPortalType} portal.`,
      );
    }

    return true;
  }
}

