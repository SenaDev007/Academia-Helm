/**
 * ============================================================================
 * PLATFORM OWNER SERVICE - RÔLE SYSTÈME (DEV ONLY)
 * ============================================================================
 * 
 * ⚠️ CE RÔLE N'EST PAS UN RÔLE MÉTIER
 * ⚠️ IL N'EXISTE PAS FONCTIONNELLEMENT POUR LES CLIENTS
 * ⚠️ IL EST LIÉ À L'ENVIRONNEMENT DE DÉVELOPPEMENT
 * 
 * Le PLATFORM_OWNER permet au fondateur de travailler librement
 * en environnement development, sans casser le RBAC métier existant.
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlatformOwnerService {
  private readonly logger = new Logger(PlatformOwnerService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Vérifie si l'utilisateur est le PLATFORM_OWNER
   * 
   * Conditions :
   * 1. APP_ENV === 'development'
   * 2. Email correspond à PLATFORM_OWNER_EMAIL
   * 
   * ⚠️ En production, cette fonction retourne TOUJOURS false
   */
  isPlatformOwner(user: any): boolean {
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const platformOwnerEmail = this.configService.get<string>(
      'PLATFORM_OWNER_EMAIL',
    );

    // En production, PLATFORM_OWNER n'existe pas
    if (appEnv !== 'development') {
      return false;
    }

    // Vérifier si l'email correspond
    if (!platformOwnerEmail || !user?.email) {
      return false;
    }

    const isOwner = user.email === platformOwnerEmail;

    if (isOwner) {
      this.logger.warn(
        `🔐 PLATFORM_OWNER detected: ${user.email} (DEV ONLY)`,
      );
    }

    return isOwner;
  }

  /**
   * Vérifie si le PLATFORM_OWNER est activé
   * (uniquement en développement)
   */
  isPlatformOwnerEnabled(): boolean {
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const platformOwnerEmail = this.configService.get<string>(
      'PLATFORM_OWNER_EMAIL',
    );

    return appEnv === 'development' && !!platformOwnerEmail;
  }

  /**
   * Récupère l'email du PLATFORM_OWNER (dev only)
   */
  getPlatformOwnerEmail(): string | null {
    if (!this.isPlatformOwnerEnabled()) {
      return null;
    }

    return this.configService.get<string>('PLATFORM_OWNER_EMAIL', null);
  }
}
