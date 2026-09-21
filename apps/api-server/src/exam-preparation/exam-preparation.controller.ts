/**
 * ============================================================================
 * PRÉPARATION D'EXAMEN — Controller (épreuves d'évaluation)
 * ============================================================================
 *
 * Module enseignant « Préparation d'examen » — pattern exact des fiches
 * pédagogiques, adapté aux épreuves d'évaluation :
 *
 *   GET    /exam-preparation/pending?teacherId&academicYearId
 *          — DÉTECTION : évaluations programmées groupées par session,
 *            matières à préparer + statut de chaque épreuve (signal)
 *   GET    /exam-preparation/blocks?teacherId&academicYearId[&classId]
 *   GET    /exam-preparation/blocks/:id
 *   POST   /exam-preparation/blocks            — get-or-create bloc session
 *   DELETE /exam-preparation/blocks/:id        — DRAFT uniquement
 *   POST   /exam-preparation/blocks/:id/submit — envoi BLOC au directeur
 *   POST   /exam-preparation/blocks/:id/send-to-secretariat
 *   POST   /exam-preparation/sheets            — création épreuve manuelle
 *   GET    /exam-preparation/sheets/:id/export-pdf      — PDF épreuve
 *   GET    /exam-preparation/blocks/:id/export-pdf      — PDF bloc complet
 *   PUT    /exam-preparation/sheets/:id        — AUTOSAVE épreuve
 *   DELETE /exam-preparation/sheets/:id
 *
 *   DIRECTION :
 *   GET    /exam-preparation/director/pending?academicYearId[&status]
 *   GET    /exam-preparation/director/blocks/:id
 *   POST   /exam-preparation/director/validate/:id  {action, validatedBy, ...}
 *
 *   SECRÉTARIAT :
 *   GET    /exam-preparation/secretariat/epreuves?academicYearId
 *          — hiérarchisé classe → trimestre → mois
 *
 *   CATALOGUE :
 *   GET    /exam-preparation/catalogue?academicYearId[&teacherId][&classId]
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, BadRequestException, Res, UseGuards,
} from '@nestjs/common';
import { ExamPreparationService } from './exam-preparation.service';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('exam-preparation')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ExamPreparationController {
  constructor(private readonly service: ExamPreparationService) {}

  // ─── 1. DÉTECTION — évaluations programmées (signal enseignant) ──────────

  @Get('pending')
  async getPending(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getPendingSessions(tenantId, teacherId, academicYearId);
  }

  // ─── BLOCS (routes STATIQUES avant les paramétrées) ───────────────────────

  @Get('blocks')
  async getBlocks(
    @TenantId() tenantId: string,
    @Query('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
  ) {
    if (!teacherId || !academicYearId) {
      throw new BadRequestException('teacherId et academicYearId sont requis');
    }
    return this.service.getBlocks(tenantId, teacherId, academicYearId, classId);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.OK)
  async createBlock(
    @TenantId() tenantId: string,
    @Body() body: {
      teacherId: string; academicYearId: string; classId: string;
      evaluationTypeId?: string; periodId?: string; evaluationIds?: string[]; title?: string;
    },
  ) {
    if (!body?.teacherId || !body?.academicYearId || !body?.classId) {
      throw new BadRequestException('teacherId, academicYearId et classId sont requis');
    }
    return this.service.createBlock(tenantId, body);
  }

  // ─── DIRECTION (statiques avant paramétrées) ──────────────────────────────

  @Get('director/pending')
  async getDirectorPending(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('status') status?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getDirectorPendingBlocks(tenantId, academicYearId, status);
  }

  // ─── SECRÉTARIAT (statique) ───────────────────────────────────────────────

  @Get('secretariat/epreuves')
  async getSecretariatEpreuves(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getSecretariatEpreuves(tenantId, academicYearId);
  }

  // ─── CATALOGUE (statique) ─────────────────────────────────────────────────

  @Get('catalogue')
  async getCatalogue(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
  ) {
    if (!academicYearId) throw new BadRequestException('academicYearId est requis');
    return this.service.getCatalogue(tenantId, academicYearId, teacherId, classId);
  }

  // ─── EXPORTS PDF (statiques imbriquées avant :id) ─────────────────────────

  @Get('blocks/:id/export-pdf')
  async exportBlockPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const buffer = await this.service.exportBlockPdf(tenantId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="epreuves_${id.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('sheets/:id/export-pdf')
  async exportSheetPdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const buffer = await this.service.exportSheetPdf(tenantId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="epreuve_${id.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── BLOCS paramétrés ─────────────────────────────────────────────────────

  @Get('blocks/:id')
  async getBlock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getBlock(tenantId, id);
  }

  @Delete('blocks/:id')
  async deleteBlock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteBlock(tenantId, id);
  }

  @Post('blocks/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitBlock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.submitBlock(tenantId, id);
  }

  @Post('blocks/:id/send-to-secretariat')
  @HttpCode(HttpStatus.OK)
  async sendToSecretariat(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.sendBlockToSecretariat(tenantId, id);
  }

  // ─── DIRECTION : détail + validation ──────────────────────────────────────

  @Get('director/blocks/:id')
  async getDirectorBlock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getBlock(tenantId, id);
  }

  @Post('director/validate/:id')
  @HttpCode(HttpStatus.OK)
  async validateBlock(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { action: 'VALIDATED' | 'REJECTED'; validatedBy?: string; rejectionReason?: string; directorObservation?: string },
  ) {
    if (!body?.action || !['VALIDATED', 'REJECTED'].includes(body.action)) {
      throw new BadRequestException("action doit être 'VALIDATED' ou 'REJECTED'");
    }
    return this.service.validateBlock(
      tenantId, id, body.action, body.validatedBy, body.rejectionReason, body.directorObservation,
    );
  }

  // ─── ÉPREUVES ─────────────────────────────────────────────────────────────

  @Post('sheets')
  @HttpCode(HttpStatus.OK)
  async createSheet(
    @TenantId() tenantId: string,
    @Body() body: {
      teacherId: string; academicYearId: string; blockId: string;
      subjectName?: string; subjectId?: string; epreuveTitle?: string;
      durationLabel?: string; maxScoreLabel?: string; coefficient?: string;
    },
  ) {
    if (!body?.blockId || !body?.academicYearId || !body?.teacherId) {
      throw new BadRequestException('teacherId, academicYearId et blockId sont requis');
    }
    return this.service.createSheet(tenantId, body);
  }

  @Get('sheets/:id')
  async getSheet(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getSheet(tenantId, id);
  }

  /** ⭐ AUTOSAVE — appelé par le hook useAutoSave (source=autosave exclu des
   *    logs d'audit côté front, pattern cahier journal / fiches). */
  @Put('sheets/:id')
  async updateSheet(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateSheet(tenantId, id, body);
  }

  @Delete('sheets/:id')
  async deleteSheet(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteSheet(tenantId, id);
  }
}
