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

import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
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
    @Query('language') language?: string,
  ) {
    return this.dashboardService.getDashboardKpi(tenantId, academicYearId, schoolLevelId, language);
  }

  @Get('completion-by-class')
  @Permissions('exams.read', 'exams.manage')
  async getCompletionByClass(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    return this.dashboardService.getCompletionByClass(tenantId, academicYearId, schoolLevelId, language);
  }

  @Get('alerts')
  @Permissions('exams.read', 'exams.manage')
  async getAlerts(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    return this.dashboardService.getPendingAlerts(tenantId, academicYearId, schoolLevelId, language);
  }

  /**
   * ⭐ V1 audit — GET /institutional-exams/dashboard/performance-by-level
   * Statistiques de performance (moyenne, taux de réussite, élèves à risque)
   * par niveau scolaire — données réelles StudentPeriodAverage + Evaluation.
   * Remplace l'appel cassé /api/exams/dashboard de l'onglet Statistiques.
   */
  @Get('performance-by-level')
  @Permissions('exams.read', 'exams.manage')
  async getPerformanceByLevel(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query('language') language?: string,
  ) {
    return this.dashboardService.getPerformanceByLevel(tenantId, academicYearId, language);
  }

  @Get('orion-insights')
  @Permissions('exams.read', 'exams.manage')
  async getOrionInsights(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    return this.dashboardService.getOrionInsights(tenantId, academicYearId, schoolLevelId, language);
  }
}
