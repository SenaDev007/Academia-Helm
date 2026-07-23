import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { ExamsConfigService } from './services/exams-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

/**
 * ============================================================================
 * EXAMS CONFIG CONTROLLER - MODULE 3
 * ============================================================================
 *
 * Gestion de la configuration pédagogique : Types d'évaluations + barèmes.
 *
 * Endpoints :
 *   GET    /evaluation-types            — liste (option: ?schoolLevelId=...)
 *   POST   /evaluation-types            — créer un type
 *   PATCH  /evaluation-types/:id        — modifier un type
 *   DELETE /evaluation-types/:id        — supprimer un type (si non utilisé)
 *   GET    /grade-scales                — liste des barèmes
 *   POST   /grade-scales                — créer un barème
 * ============================================================================
 */
@Controller('institutional-exams/config')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamsConfigController {
  constructor(private readonly configService: ExamsConfigService) {}

  // ─── Types d'évaluation ────────────────────────────────────────────────────
  @Get('evaluation-types')
  @Permissions('settings.read')
  async getTypes(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.configService.getEvaluationTypes(tenantId, schoolLevelId);
  }

  @Post('evaluation-types')
  @Permissions('settings.manage')
  async createType(@TenantId() tenantId: string, @Body() data: any) {
    return this.configService.createEvaluationType(tenantId, data);
  }

  @Patch('evaluation-types/:id')
  @Permissions('settings.manage')
  async updateType(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.configService.updateEvaluationType(tenantId, id, data);
  }

  @Delete('evaluation-types/:id')
  @Permissions('settings.manage')
  async deleteType(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.configService.deleteEvaluationType(tenantId, id);
  }

  // ─── Barèmes ───────────────────────────────────────────────────────────────
  @Get('grade-scales')
  @Permissions('settings.read')
  async getScales(@TenantId() tenantId: string) {
    return this.configService.getGradeScales(tenantId);
  }

  @Post('grade-scales')
  @Permissions('settings.manage')
  async createScale(@TenantId() tenantId: string, @Body() data: any) {
    return this.configService.createGradeScale(tenantId, data);
  }
}
