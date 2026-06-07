/**
 * ============================================================================
 * PORTAL ACCESS GUARD - VÉRIFICATION PORTAIL AUTORISÉ
 * ============================================================================
 * 
 * Vérifie que l'utilisateur tente d'accéder au portail autorisé pour son rôle
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, Portal, ROLE_PORTAL_MAP, canAccessPortal } from '../enums/user-role.enum';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { PlatformOwnerService } from '../../security/platform-owner.service';

@Injectable()
export class PortalAccessGuard implements CanActivate {
  private readonly logger = new Logger(PortalAccessGuard.name);

  constructor(
    private reflector: Reflector,
    private platformOwnerService: PlatformOwnerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // BYPASS si PLATFORM_OWNER (dev only)
    if (this.platformOwnerService.isPlatformOwner(user)) {
      this.logger.debug(`🔐 PLATFORM_OWNER bypassing portal check`);
      return true;
    }

    // Récupérer le rôle de l'utilisateur
    const userRole = this.getUserRole(user);
    if (!userRole) {
      throw new ForbiddenException('User role not defined');
    }

    // Récupérer le portail demandé depuis l'en-tête ou l'URL
    const requestedPortal = this.getRequestedPortal(request);

    // Vérifier si le rôle peut accéder à ce portail
    const authorizedPortal = ROLE_PORTAL_MAP[userRole];
    
    if (!canAccessPortal(userRole, requestedPortal)) {
      this.logger.warn(
        `Portal access denied: User ${user.id} with role ${userRole} attempted to access ${requestedPortal} (authorized: ${authorizedPortal})`,
      );
      throw new ForbiddenException(
        `Access denied: Role ${userRole} cannot access portal ${requestedPortal}. Authorized portal: ${authorizedPortal}`,
      );
    }

    // Ajouter le portail autorisé à la requête
    request.authorizedPortal = authorizedPortal;
    request.userRole = userRole;

    return true;
  }

  /**
   * Récupère le rôle de l'utilisateur
   */
  private getUserRole(user: any): UserRole | null {
    // Vérifier isSuperAdmin en premier
    if (user.isSuperAdmin) {
      return UserRole.SUPER_ADMIN;
    }

    // Récupérer le rôle depuis user.role
    if (user.role) {
      const role = user.role.toUpperCase();
      // Normaliser les variations de noms
      const roleMap: Record<string, UserRole> = {
        'SUPER_ADMIN': UserRole.SUPER_ADMIN,
        'PROMOTEUR': UserRole.PROMOTEUR,
        'PROMOTER': UserRole.PROMOTEUR,
        'DIRECTEUR': UserRole.DIRECTEUR,
        'DIRECTOR': UserRole.DIRECTEUR,
        'SECRETAIRE': UserRole.SECRETAIRE,
        'SECRETARY': UserRole.SECRETAIRE,
        'COMPTABLE': UserRole.COMPTABLE,
        'ACCOUNTANT': UserRole.COMPTABLE,
        'SECRETAIRE_COMPTABLE': UserRole.SECRETAIRE_COMPTABLE,
        'SECRETARY_ACCOUNTANT': UserRole.SECRETAIRE_COMPTABLE,
        'CENSEUR': UserRole.CENSEUR,
        'SURVEILLANT': UserRole.SURVEILLANT,
        'ENSEIGNANT': UserRole.ENSEIGNANT,
        'TEACHER': UserRole.ENSEIGNANT,
        'PARENT': UserRole.PARENT,
        'ELEVE': UserRole.ELEVE,
        'STUDENT': UserRole.ELEVE,
      };

      return roleMap[role] || null;
    }

    return null;
  }

  /**
   * Récupère le portail demandé depuis la requête
   */
  private getRequestedPortal(request: any): Portal {
    // Vérifier l'en-tête X-Portal
    const portalHeader = request.headers['x-portal']?.toUpperCase();
    if (portalHeader) {
      const portalMap: Record<string, Portal> = {
        'PLATEFORME': Portal.PLATEFORME,
        'ECOLE': Portal.ECOLE,
        'ENSEIGNANT': Portal.ENSEIGNANT,
        'PARENT_ELEVE': Portal.PARENT_ELEVE,
        'PARENT': Portal.PARENT_ELEVE,
        'ELEVE': Portal.PARENT_ELEVE,
      };
      if (portalMap[portalHeader]) {
        return portalMap[portalHeader];
      }
    }

    // Détecter depuis l'URL
    const url = request.url || '';
    if (url.includes('/platform/') || url.includes('/admin/')) {
      return Portal.PLATEFORME;
    }
    if (url.includes('/teacher/') || url.includes('/enseignant/')) {
      return Portal.ENSEIGNANT;
    }
    if (url.includes('/parent/') || url.includes('/eleve/') || url.includes('/student/')) {
      return Portal.PARENT_ELEVE;
    }

    // Par défaut : Portail École
    return Portal.ECOLE;
  }
}
