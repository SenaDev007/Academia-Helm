/**
 * ============================================================================
 * EXAMS DASHBOARD CONTROLLER - MODULE 3
 * ============================================================================
 * 
 * Endpoints pour le pilotage du dashboard académique.
 * Sécurisé par RBAC et Isolation multi-tenant.
 * 
 * ============================================================================
 */

import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ExamsDashboardService } from './services/exams-dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContextValidationGuard } from '../../common/guards/context-validation.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../../common/decorators/school-level-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@Controller('institutional-exams/dashboard')
@UseGuards(
  JwtAuthGuard,
  ContextValidationGuard,
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
export class ExamsDashboardController {
  constructor(private readonly dashboardService: ExamsDashboardService) {}

  @Get('kpi')
  @Permissions('exams.read', 'exams.manage')
  async getKpi(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.dashboardService.getDashboardKpi(tenantId, academicYearId, schoolLevelId);
  }

  @Get('completion-by-class')
  @Permissions('exams.read', 'exams.manage')
  async getCompletionByClass(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.dashboardService.getCompletionByClass(tenantId, academicYearId, schoolLevelId);
  }

  @Get('alerts')
  @Permissions('exams.read', 'exams.manage')
  async getAlerts(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.dashboardService.getPendingAlerts(tenantId, academicYearId, schoolLevelId);
  }

  @Get('orion-insights')
  @Permissions('exams.read', 'exams.manage')
  async getOrionInsights(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.dashboardService.getOrionInsights(tenantId, academicYearId, schoolLevelId);
  }
}
