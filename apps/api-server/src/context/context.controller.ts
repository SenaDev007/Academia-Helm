/**
 * ============================================================================
 * CONTEXT CONTROLLER - BOOTSTRAP DU CONTEXTE TENANT
 * ============================================================================
 * 
 * Endpoint unique pour initialiser tout le contexte nécessaire au dashboard
 * après la sélection d'un tenant.
 * 
 * ============================================================================
 */

import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireTenant } from '../common/decorators/require-tenant.decorator';
import { TenantRequiredGuard } from '../common/guards/tenant-required.guard';
import { ContextService } from './context.service';

@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  /**
   * Bootstrap du contexte tenant
   * 
   * Retourne toutes les informations nécessaires pour initialiser le dashboard :
   * - Tenant
   * - User
   * - Role
   * - Academic Year
   * - Permissions
   * - Orion Summary (si applicable)
   * 
   * Guard : AuthGuard + TenantGuard (via @RequireTenant())
   */
  @RequireTenant()
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  @Get('bootstrap')
  async bootstrap(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const tenantId = req.user.tenantId || req['tenantId'];
    const role = req.user.role;

    return this.contextService.bootstrap(userId, tenantId, role);
  }
}
