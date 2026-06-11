/**
 * ============================================================================
 * PLATFORM OWNER CONTROLLER - ENDPOINTS DEV (DEV ONLY)
 * ============================================================================
 * 
 * Endpoints pour le PLATFORM_OWNER en développement.
 * 
 * ⚠️ Ces endpoints n'existent pas en production
 * 
 * ============================================================================
 */

import { Controller, Get, UseGuards, Request, Post, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformOwnerGuard } from '../guards/platform-owner.guard';
import { PlatformOwnerService } from '../platform-owner.service';

@Controller('dev/platform-owner')
@UseGuards(JwtAuthGuard, PlatformOwnerGuard)
export class PlatformOwnerController {
  constructor(private readonly platformOwnerService: PlatformOwnerService) {}

  /**
   * Vérifie si l'utilisateur est PLATFORM_OWNER
   * GET /api/dev/platform-owner/status
   */
  @Get('status')
  getStatus(@Request() req: any) {
    const isOwner = this.platformOwnerService.isPlatformOwner(req.user);
    const isEnabled = this.platformOwnerService.isPlatformOwnerEnabled();
    const email = this.platformOwnerService.getPlatformOwnerEmail();

    return {
      isPlatformOwner: isOwner,
      isEnabled,
      platformOwnerEmail: email,
      environment: process.env.APP_ENV || 'production',
      message: isOwner
        ? '🔐 You are PLATFORM_OWNER (DEV ONLY)'
        : 'You are not PLATFORM_OWNER',
    };
  }

  /**
   * Récupère les informations du contexte forcé
   * GET /api/dev/platform-owner/context
   */
  @Get('context')
  getContext(@Request() req: any) {
    return {
      user: {
        id: req.user?.id,
        email: req.user?.email,
        tenantId: req.user?.tenantId,
        academicYearId: req.user?.academicYearId,
        schoolLevelId: req.user?.schoolLevelId,
        classId: req.user?.classId,
      },
      forcedContext: req.forcedContext || null,
      headers: {
        'x-tenant-id': req.headers['x-tenant-id'],
        'x-academic-year-id': req.headers['x-academic-year-id'],
        'x-school-level-id': req.headers['x-school-level-id'],
        'x-class-id': req.headers['x-class-id'],
      },
    };
  }
}
