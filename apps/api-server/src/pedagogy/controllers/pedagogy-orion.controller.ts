/**
 * ============================================================================
 * PEDAGOGY ORION CONTROLLER - MODULE 2
 * ============================================================================
 * 
 * Controller ORION pour le workflow pédagogique
 * 
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { PedagogyOrionService } from '../services/pedagogy-orion.service';

@Controller('pedagogy/orion')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('DIRECTOR', 'ADMIN')
export class PedagogyOrionController {
  constructor(private readonly orionService: PedagogyOrionService) {}

  /**
   * Récupère les KPIs pédagogiques pour ORION
   */
  @Get('kpis')
  async getPedagogicalKPIs(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.getPedagogicalKPIs(tenant.id, academicYearId);
  }

  /**
   * Récupère les alertes ORION pour le workflow pédagogique
   */
  @Get('alerts')
  async getPedagogicalAlerts(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const kpis = await this.orionService.getPedagogicalKPIs(tenant.id, academicYearId);
    return kpis.alerts;
  }
}

