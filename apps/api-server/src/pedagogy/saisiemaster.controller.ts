/**
 * ============================================================================
 * SAISIEMASTER — Controller dédié (saissiemaster.academiahelm.com)
 * ============================================================================
 *
 * Endpoints pour le module SaisieMaster :
 *   - CRUD des évaluations (EF1, ES1, ES2, ES3)
 *   - Saisie des notes par élève
 *   - Calcul automatique des statistiques
 *   - Export PDF individuel
 *   - Export ZIP groupé (4 PDFs pour une classe × matière)
 *   - Validation direction (valider/rejeter)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, BadRequestException, Logger, Res, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SaisieMasterService } from './saisiemaster.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('saisiemaster')
// ⭐ FIX 2026-09-06 (F9) : fin du @Public() — ce contrôleur DOUBLON celui de
//    src/saisiemaster/ (même chemin) et c'était lui qui répondait en prod.
//    Le CRUD d'évaluations et la saisie de notes exigent désormais le JWT.
@UseGuards(JwtAuthGuard)
export class SaisieMasterController {
  private readonly logger = new Logger(SaisieMasterController.name);

  constructor(private readonly service: SaisieMasterService) {}

  // ─── MÉTADONNÉES ───────────────────────────────────────────────────────

  @Get('evaluation-types')
  async getEvaluationTypes() {
    return this.service.getEvaluationTypes();
  }

  @Get('dashboard')
  async getDirectorDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getDirectorDashboard(tenantId, academicYearId);
  }

  // ─── CRUD ÉVALUATIONS ──────────────────────────────────────────────────

  @Get('evaluations')
  async getEvaluations(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    @Query('evaluationType') evaluationType?: string,
    @Query('trimester') trimester?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getEvaluations(
      tenantId, teacherId, academicYearId,
      classId, evaluationType, trimester ? parseInt(trimester) : undefined,
    );
  }

  @Get('evaluations/:id')
  async getEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getEvaluation(tenantId, id);
  }

  @Post('evaluations')
  async getOrCreateEvaluation(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    return this.service.getOrCreateEvaluation(
      tenantId, body.academicYearId, body.teacherId, body,
    );
  }

  @Put('evaluations/:id')
  async updateEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateEvaluation(tenantId, id, body);
  }

  @Delete('evaluations/:id')
  async deleteEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteEvaluation(tenantId, id);
  }

  @Post('evaluations/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitEvaluation(tenantId, id);
  }

  @Post('evaluations/:id/init-students')
  @HttpCode(HttpStatus.OK)
  async initStudents(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.initStudents(tenantId, id);
  }

  // ─── EXPORT PDF / ZIP ──────────────────────────────────────────────────

  @Get('evaluations/:id/pdf')
  async exportEvaluationPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    try {
      const pdfBuffer = await this.service.generateEvaluationPdf(tenantId, id);
      const eval_ = await this.service.getEvaluation(tenantId, id);
      const className = (eval_.classNameResolved || 'Classe').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${eval_.evaluationType}_${className}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (e: any) {
      this.logger.error(`Erreur export PDF: ${e.message}`, e.stack);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF', details: e.message });
    }
  }

  @Get('evaluations/export-zip')
  async exportEvaluationsZip(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('trimester') trimester?: string,
    @Res() res: any,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont requis');
    }
    try {
      const zipBuffer = await this.service.generateEvaluationsZip(
        tenantId, academicYearId, classId,
        subjectId || null,
        trimester ? parseInt(trimester) : undefined,
      );
      const classes: any = await this.service.getEvaluationsForClassSubject(
        tenantId, academicYearId, classId, subjectId || null,
      );
      const className = (classes[0]?.classNameResolved || 'Classe').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Evaluations_SaisieMaster_${className}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(zipBuffer);
    } catch (e: any) {
      this.logger.error(`Erreur export ZIP: ${e.message}`, e.stack);
      res.status(500).json({ error: 'Erreur lors de la génération du ZIP', details: e.message });
    }
  }

  @Get('evaluations/by-class-subject')
  async getEvaluationsForClassSubject(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('trimester') trimester?: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont requis');
    }
    return this.service.getEvaluationsForClassSubject(
      tenantId, academicYearId, classId,
      subjectId || null,
      trimester ? parseInt(trimester) : undefined,
    );
  }

  // ─── VALIDATION DIRECTION ──────────────────────────────────────────────

  @Get('director/pending')
  async getPendingEvaluations(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getPendingEvaluations(tenantId, academicYearId);
  }

  @Get('director/:id')
  async getEvaluationDetail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getEvaluationDetail(tenantId, id);
  }

  @Post('director/validate/:id')
  @HttpCode(HttpStatus.OK)
  async validateEvaluation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      action: 'VALIDATED' | 'REJECTED';
      validatedBy: string;
      rejectionReason?: string;
    },
  ) {
    return this.service.validateEvaluation(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason,
    );
  }
}
