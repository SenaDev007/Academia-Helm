/**
 * ============================================================================
 * EDUC MASTER IMPORT CONTROLLER — Importation des notes vers Educ Master
 * ============================================================================
 *
 * Endpoints :
 *   POST /api/exams/educ-master/parse
 *     Body: multipart/form-data with file=Excel + classId + academicYearId
 *     Response: { format, sheets, students, warnings }
 *
 *   POST /api/exams/educ-master/match
 *     Body: { classId, academicYearId, excelStudents: [...] }
 *     Response: { matches, ourStudents, unmatchedExcel, unmatchedOur }
 *
 *   POST /api/exams/educ-master/fill
 *     Body: multipart/form-data with file=Excel + classId + academicYearId +
 *           periodId + level + studentMapping
 *     Response: PDF binaire (Excel rempli)
 *
 * ⭐ Niveau maternelle NON supporté — l'endpoint renvoie 400 si level=maternelle
 * ============================================================================
 */

import {
  Controller, Post, Body, UseGuards, Res, Headers, Logger, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { EducMasterService } from './educ-master.service';
import type { ExcelStudent, FillOptions } from './educ-master.service';

@Controller('exams/educ-master')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EducMasterController {
  private readonly logger = new Logger(EducMasterController.name);

  constructor(private readonly educMasterService: EducMasterService) {}

  /**
   * POST /api/exams/educ-master/parse
   *    Body: multipart/form-data with `file` (Excel) + `classId` + `academicYearId`
   *    Response: { format, sheets, students, warnings }
   */
  @Post('parse')
  @Permissions('exams.read')
  async parse(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { fileBase64, fileName, classId, academicYearId } = body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 (base64 du fichier Excel) est requis' });
    }
    if (!classId || !academicYearId) {
      return res.status(400).json({ error: 'classId et academicYearId sont requis' });
    }

    try {
      // Decode base64 → buffer (handle data URI prefix)
      const base64Data = fileBase64.replace(/^data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,/, '')
        .replace(/^data:application\/octet-stream;base64,/, '')
        .replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const parseResult = await this.educMasterService.parseExcel(buffer);
      return res.json(parseResult);
    } catch (err: any) {
      this.logger.error('Erreur parse Excel:', err);
      return res.status(500).json({ error: err.message || 'Erreur lors du parsing' });
    }
  }

  /**
   * POST /api/exams/educ-master/match
   *    Body: { classId, academicYearId, excelStudents: [...] }
   *    Response: { matches, ourStudents, unmatchedExcel, unmatchedOur }
   */
  @Post('match')
  @Permissions('exams.read')
  async match(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { classId, academicYearId, excelStudents } = body;

    if (!classId || !academicYearId) {
      return res.status(400).json({ error: 'classId et academicYearId sont requis' });
    }
    if (!Array.isArray(excelStudents)) {
      return res.status(400).json({ error: 'excelStudents (array) est requis' });
    }

    try {
      const result = await this.educMasterService.matchStudents(
        resolvedTenantId, academicYearId, classId, excelStudents as ExcelStudent[],
      );
      return res.json(result);
    } catch (err: any) {
      this.logger.error('Erreur match students:', err);
      return res.status(500).json({ error: err.message || 'Erreur lors du matching' });
    }
  }

  /**
   * POST /api/exams/educ-master/fill
   *    Body: { fileBase64, fileName, classId, academicYearId, periodId, level, studentMapping }
   *    Response: Excel binaire rempli (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
   */
  @Post('fill')
  @Permissions('exams.read')
  async fill(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { fileBase64, fileName, classId, academicYearId, periodId, level, studentMapping } = body;

    if (!fileBase64 || !classId || !academicYearId || !periodId || !level) {
      return res.status(400).json({ error: 'fileBase64, classId, academicYearId, periodId et level sont requis' });
    }
    if (level === 'MATERNELLE') {
      return res.status(400).json({ error: 'L\'importation Educ Master n\'est pas disponible pour la maternelle' });
    }
    if (!studentMapping || typeof studentMapping !== 'object') {
      return res.status(400).json({ error: 'studentMapping (object { excelMatricule: ourStudentId }) est requis' });
    }

    try {
      // Decode base64 → buffer
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const options: FillOptions = {
        tenantId: resolvedTenantId,
        academicYearId,
        classId,
        periodId,
        level: level === 'SECONDAIRE' ? 'SECONDAIRE' : 'PRIMAIRE',
        studentMapping,
      };

      const filledBuffer = await this.educMasterService.fillExcel(buffer, options);

      // Generate download filename
      const safeName = (fileName || 'educ_master_rempli').replace(/\.xlsx$/i, '').replace(/[^\w\-]/g, '_');
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}_rempli.xlsx"`,
        'Content-Length': filledBuffer.length,
      });
      res.end(filledBuffer);
    } catch (err: any) {
      this.logger.error('Erreur fill Excel:', err);
      return res.status(500).json({ error: err.message || 'Erreur lors du remplissage' });
    }
  }
}
