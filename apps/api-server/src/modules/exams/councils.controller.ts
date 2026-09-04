import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, Headers, Res } from '@nestjs/common';
import { CouncilsService } from './services/councils.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Response } from 'express';

@Controller('institutional-exams/councils')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CouncilsController {
  constructor(private readonly councilsService: CouncilsService) {}

  @Get()
  @Permissions('exams.read')
  async getCouncils(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @AcademicYearId() academicYearId: string,
    @Query('quarterId') quarterId: string,
    @Query('periodId') periodId: string, // alias legacy (map vers quarterId)
    @Query('classId') classId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    const qid = quarterId || periodId; // ⭐ rétro-compat : periodId → quarterId
    return this.councilsService.getCouncils(resolvedTenantId, academicYearId, qid, classId, schoolLevelId, language);
  }

  @Post()
  @Permissions('exams.manage')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() data: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    // ⭐ Si schoolLevelId est fourni mais pas classId → création GLOBALE
    // pour toutes les classes du niveau scolaire.
    if (data.schoolLevelId && !data.classId) {
      return this.councilsService.createGlobalCouncils(resolvedTenantId, data);
    }
    return this.councilsService.createCouncil(resolvedTenantId, data);
  }

  @Get(':id')
  @Permissions('exams.read')
  async getOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.councilsService.getCouncilDetails(id, resolvedTenantId);
  }

  @Post(':id/start')
  @Permissions('exams.manage')
  async start(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.councilsService.startCouncil(id, resolvedTenantId);
  }

  @Post(':id/decisions/:studentId')
  @Permissions('exams.manage')
  async saveDecision(
    @Param('id') councilId: string,
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @UserId() userId: string,
    @Body() data: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.councilsService.saveDecision(resolvedTenantId, councilId, studentId, { ...data, userId });
  }

  @Patch(':id/complete')
  @Permissions('exams.manage')
  async complete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.councilsService.closeCouncil(id, resolvedTenantId);
  }

  /**
   * ⭐ GET /institutional-exams/councils/:id/ai-analysis
   * Analyse IA (ORION) : performances + assiduité + recommandations par élève
   */
  @Get(':id/ai-analysis')
  @Permissions('exams.read')
  async getAIAnalysis(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.councilsService.getAIAnalysis(id, resolvedTenantId);
  }

  /**
   * ⭐ GET /institutional-exams/councils/:id/minutes
   * Génère le PV (procès-verbal) du conseil de classe en PDF
   * Backend Puppeteer — même en-tête officiel que le module Élèves
   */
  @Get(':id/minutes')
  @Permissions('exams.read')
  async getMinutes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    const result = await this.councilsService.generatePV(id, resolvedTenantId);
    const buffer = Buffer.isBuffer(result.pdf) ? result.pdf : Buffer.from(result.pdf);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename || `pv_conseil_${id.substring(0, 8)}.pdf`}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}

