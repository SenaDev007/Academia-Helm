/**
 * ============================================================================
 * DASHBOARD CONTROLLER - DASHBOARDS PERSONNALISÉS PAR RÔLE
 * ============================================================================
 */

import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortalAccessGuard } from '../guards/portal-access.guard';
import { DashboardService } from '../services/dashboard.service';
import { UserRole } from '../enums/user-role.enum';

@Controller('common/dashboard')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Récupère les données du dashboard selon le rôle de l'utilisateur
   */
  @Get()
  async getDashboard(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const userRole = req.userRole as UserRole;
    const tenantId = req.user?.tenantId;

    if (!userRole || !tenantId) {
      return {
        error: 'User role or tenant ID not found',
      };
    }

    return this.dashboardService.getDashboardData(userRole, tenantId, academicYearId);
  }
}
