/**
 * ============================================================================
 * ANNUAL PLAN CONTROLLER — Planification pédagogique annuelle
 * ============================================================================
 * 
 * Endpoints :
 *   GET  /pedagogy/annual-plans?academicYearId=Y&classLevel=CI&trimester=1
 *   GET  /pedagogy/annual-plans/classes?academicYearId=Y
 *   PUT  /pedagogy/annual-plans/:id  (body: { content })
 *   POST /pedagogy/annual-plans/seed (body: { academicYearId, schoolLevelId })
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { AnnualPlanService } from './annual-plan.service';

@Controller('pedagogy/annual-plans')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnnualPlanController {
  private readonly logger = new Logger(AnnualPlanController.name);

  constructor(private readonly annualPlanService: AnnualPlanService) {}

  /**
   * GET /pedagogy/annual-plans?academicYearId=Y&classLevel=CI&trimester=1
   * Récupère la planification pour une classe et optionnellement un trimestre.
   */
  @Get()
  async getPlans(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Query('trimester') trimester?: string,
  ) {
    if (!academicYearId || !classLevel) {
      return [];
    }
    const tri = trimester ? parseInt(trimester, 10) : undefined;
    return this.annualPlanService.getPlans(tenantId, academicYearId, classLevel, tri);
  }

  /**
   * GET /pedagogy/annual-plans/classes?academicYearId=Y
   * Liste les classes disponibles dans la planification.
   */
  @Get('classes')
  async getAvailableClasses(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.annualPlanService.getAvailableClasses(tenantId, academicYearId);
  }

  /**
   * PUT /pedagogy/annual-plans/:id
   * Met à jour le contenu d'une cellule (isCustom = true).
   */
  @Put(':id')
  async updatePlan(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { content?: string },
  ) {
    return this.annualPlanService.updatePlan(id, tenantId, body);
  }

  /**
   * POST /pedagogy/annual-plans/seed
   * Seed la planification officielle pour ce tenant + année.
   * Idempotent — ne réinsère pas si déjà fait.
   */
  @Post('seed')
  async seedPlans(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; schoolLevelId: string },
  ) {
    if (!body.academicYearId || !body.schoolLevelId) {
      return { error: 'academicYearId and schoolLevelId required' };
    }
    return this.annualPlanService.seedForTenant(
      tenantId,
      body.academicYearId,
      body.schoolLevelId,
    );
  }
}
