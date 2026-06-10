/**
 * ============================================================================
 * STUDENTS ORION CONTROLLER - MODULE 1
 * ============================================================================
 * 
 * Controller ORION pour alertes matricule et cartes scolaires
 * 
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { StudentsOrionService } from '../services/students-orion.service';

@Controller('students/orion')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN', 'DIRECTOR')
export class StudentsOrionController {
  constructor(private readonly orionService: StudentsOrionService) {}

  /**
   * Récupère les KPIs ORION pour matricule et cartes
   */
  @Get('kpis')
  async getIdentificationKPIs(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.getStudentIdentificationKPIs(tenant.id, academicYearId);
  }

  /**
   * Récupère les alertes ORION pour matricule et cartes
   */
  @Get('alerts')
  async getAlerts(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.generateAlerts(tenant.id, academicYearId);
  }
}

