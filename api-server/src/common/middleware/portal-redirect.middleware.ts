/**
 * ============================================================================
 * PORTAL REDIRECT MIDDLEWARE - REDIRECTION AUTOMATIQUE PORTAIL
 * ============================================================================
 * 
 * Redirige automatiquement l'utilisateur vers le portail autorisé
 * si il tente d'accéder à un portail non autorisé
 * 
 * ============================================================================
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserRole, Portal, ROLE_PORTAL_MAP } from '../enums/user-role.enum';

@Injectable()
export class PortalRedirectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PortalRedirectMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Ignorer les routes API (pas de redirection)
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // Si l'utilisateur n'est pas authentifié, continuer
    const user = (req as any).user;
    if (!user) {
      return next();
    }

    // Récupérer le rôle de l'utilisateur
    const userRole = this.getUserRole(user);
    if (!userRole) {
      return next();
    }

    // Récupérer le portail autorisé
    const authorizedPortal = ROLE_PORTAL_MAP[userRole];
    if (!authorizedPortal) {
      return next();
    }

    // Détecter le portail demandé depuis l'URL
    const requestedPortal = this.detectPortalFromUrl(req.path);

    // Si le portail demandé ne correspond pas, rediriger
    if (requestedPortal && requestedPortal !== authorizedPortal) {
      this.logger.log(
        `Redirecting user ${user.id} (${userRole}) from ${requestedPortal} to ${authorizedPortal}`,
      );

      const redirectPath = this.getPortalPath(authorizedPortal);
      return res.redirect(redirectPath);
    }

    // Ajouter le portail autorisé à la requête
    (req as any).authorizedPortal = authorizedPortal;
    (req as any).userRole = userRole;

    next();
  }

  /**
   * Récupère le rôle de l'utilisateur
   */
  private getUserRole(user: any): UserRole | null {
    if (user.isSuperAdmin) {
      return UserRole.SUPER_ADMIN;
    }

    if (user.role) {
      const role = user.role.toUpperCase();
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
   * Détecte le portail depuis l'URL
   */
  private detectPortalFromUrl(path: string): Portal | null {
    if (path.includes('/platform/') || path.includes('/admin/')) {
      return Portal.PLATEFORME;
    }
    if (path.includes('/teacher/') || path.includes('/enseignant/')) {
      return Portal.ENSEIGNANT;
    }
    if (path.includes('/parent/') || path.includes('/eleve/') || path.includes('/student/')) {
      return Portal.PARENT_ELEVE;
    }
    if (path.includes('/app/') || path.includes('/ecole/') || path.includes('/school/')) {
      return Portal.ECOLE;
    }
    return null;
  }

  /**
   * Récupère le chemin du portail
   */
  private getPortalPath(portal: Portal): string {
    const portalPaths: Record<Portal, string> = {
      [Portal.PLATEFORME]: '/platform/dashboard',
      [Portal.ECOLE]: '/app/dashboard',
      [Portal.ENSEIGNANT]: '/teacher/dashboard',
      [Portal.PARENT_ELEVE]: '/parent/dashboard',
    };

    return portalPaths[portal] || '/app/dashboard';
  }
}
