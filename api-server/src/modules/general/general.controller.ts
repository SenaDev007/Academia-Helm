/**
 * ============================================================================
 * GENERAL CONTROLLER - MODULE GÉNÉRAL (AGRÉGATIONS CONTRÔLÉES)
 * ============================================================================
 * 
 * Controller pour le Module Général qui permet des agrégations contrôlées
 * entre les niveaux scolaires.
 * 
 * RÈGLES :
 * - Lecture seule
 * - Uniquement agrégations
 * - Provenance documentée
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GeneralService } from './general.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
// UserRole n'existe plus, utiliser le type string directement
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AllowCrossLevel } from '../../common/decorators/allow-cross-level.decorator';

@Controller('general')
@UseGuards(JwtAuthGuard, RolesGuard)
@AllowCrossLevel() // Autoriser cross-level pour ce module uniquement
export class GeneralController {
  constructor(private readonly generalService: GeneralService) {}

  @Get('enrollment')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getTotalEnrollment(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @CurrentUser() user: any,
  ) {
    return this.generalService.getTotalEnrollment(tenantId, academicYearId, user.id);
  }

  @Get('revenue')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getTotalRevenue(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.generalService.getTotalRevenue(
      tenantId,
      academicYearId,
      user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('weighted-average')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getWeightedAverage(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @CurrentUser() user: any,
  ) {
    return this.generalService.getWeightedAverage(tenantId, academicYearId, user.id);
  }

  @Get('consolidated-report')
  @Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN')
  getConsolidatedReport(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @CurrentUser() user: any,
  ) {
    return this.generalService.getConsolidatedReport(tenantId, academicYearId, user.id);
  }
}

