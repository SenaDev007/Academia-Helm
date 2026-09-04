/**
 * ============================================================================
 * ANALYTICS CONTROLLER — Vue stratégique du groupe scolaire (promoteur)
 * ============================================================================
 *
 * GET /analytics/consolidated
 *   KPIs consolidés multi-écoles : périmètre = les établissements du
 *   promoteur (UserTenant ∪ tenant direct) — ou tous les tenants école
 *   pour les rôles plateforme (vue de support).
 *
 * ⚠️ VOLONTAIREMENT sans TenantGuard : cet endpoint est CROSS-TENANT par
 * nature (il agrège plusieurs écoles). Le périmètre est résolu côté service
 * depuis l'identité JWT (défense en profondeur — jamais depuis un header
 * client). Réservé aux rôles stratégiques (promoteur / plateforme).
 * ============================================================================
 */

import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService, isStrategicRole } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('consolidated')
  async getConsolidatedKpis(@CurrentUser() user: any) {
    // Vue stratégique réservée : promoteur multi-écoles + rôles plateforme.
    if (!isStrategicRole(user)) {
      throw new ForbiddenException(
        'La vue stratégique consolidée est réservée aux promoteurs et administrateurs plateforme',
      );
    }

    return this.analyticsService.getConsolidatedKpis({
      sub: user?.sub || user?.id,
      role: user?.role,
      tenantId: user?.tenantId,
      isSuperAdmin: user?.isSuperAdmin,
    });
  }
}
