/**
 * ============================================================================
 * CONTEXT FORCER SERVICE - FORÇAGE CONTEXTE (PLATFORM_OWNER ONLY)
 * ============================================================================
 * 
 * Permet au PLATFORM_OWNER de forcer le contexte (tenant, academic_year)
 * via les headers HTTP en développement.
 * 
 * ⚠️ Uniquement pour PLATFORM_OWNER en development
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PlatformOwnerService } from '../platform-owner.service';

export interface ForcedContext {
  tenantId?: string;
  academicYearId?: string;
  schoolLevelId?: string;
  classId?: string;
}

@Injectable()
export class ContextForcerService {
  private readonly logger = new Logger(ContextForcerService.name);

  constructor(private readonly platformOwnerService: PlatformOwnerService) {}

  /**
   * Résout le contexte depuis les headers (si PLATFORM_OWNER)
   * Sinon, retourne le contexte normal de l'utilisateur
   */
  resolveContext(user: any, headers: any): ForcedContext | null {
    // Seul le PLATFORM_OWNER peut forcer le contexte
    if (!this.platformOwnerService.isPlatformOwner(user)) {
      return null;
    }

    const forcedContext: ForcedContext = {};

    // Forcer tenant_id depuis header
    if (headers['x-tenant-id']) {
      forcedContext.tenantId = headers['x-tenant-id'];
      this.logger.debug(`🔐 PLATFORM_OWNER forcing tenant: ${forcedContext.tenantId}`);
    }

    // Forcer academic_year_id depuis header
    if (headers['x-academic-year-id']) {
      forcedContext.academicYearId = headers['x-academic-year-id'];
      this.logger.debug(
        `🔐 PLATFORM_OWNER forcing academic year: ${forcedContext.academicYearId}`,
      );
    }

    // Forcer school_level_id depuis header
    if (headers['x-school-level-id']) {
      forcedContext.schoolLevelId = headers['x-school-level-id'];
      this.logger.debug(
        `🔐 PLATFORM_OWNER forcing school level: ${forcedContext.schoolLevelId}`,
      );
    }

    // Forcer class_id depuis header
    if (headers['x-class-id']) {
      forcedContext.classId = headers['x-class-id'];
      this.logger.debug(`🔐 PLATFORM_OWNER forcing class: ${forcedContext.classId}`);
    }

    return Object.keys(forcedContext).length > 0 ? forcedContext : null;
  }

  /**
   * Vérifie si le contexte peut être forcé
   */
  canForceContext(user: any): boolean {
    return this.platformOwnerService.isPlatformOwner(user);
  }
}
