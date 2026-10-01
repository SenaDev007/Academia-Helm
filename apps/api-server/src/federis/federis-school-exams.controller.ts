/**
 * FederisSchoolExamsController — Examens nationaux côté établissement Helm
 *
 * Onglet « Examens nationaux » du module Examen (sous-onglets CEP / BEPC /
 * Baccalauréat / CAP — affichage dynamique selon les niveaux activés et les classes
 * réelles de l'école).
 *
 *   GET  /federis/school/national-exams
 *        → éligibilité (CM2 / 3ème / Terminale), effectifs, état des envois
 *   GET  /federis/school/national-exams/:examType/candidates
 *        → élèves éligibles (Bac : catégorisés par série A1, C, D…)
 *   POST /federis/school/national-exams/:examType/selection
 *        → sélection officielle (direction / secrétariat)
 *   POST /federis/school/national-exams/:examType/submit
 *        → envoi temps réel au(x) patronat(s) rattaché(s) + notifications
 *
 *   ⭐ Délibération et relevés de notes (2026-09-30) :
 *   GET  /federis/school/national-exams/:examType/results
 *        → décisions du jury pour les candidats de l'école + relevés distribués
 *   GET  /federis/school/national-exams/:examType/releve/:candidateId?examId=
 *        → relevé de notes structuré (visualisation dans l'interface)
 *   GET  /federis/school/national-exams/:examType/releve/:candidateId/pdf?examId=
 *        → PDF officiel du relevé (généré par le backend)
 *
 *   ⭐ T27 (2026-10-01) — Actions en bloc sur les relevés distribués :
 *   GET  /federis/school/national-exams/:examType/releves/zip?examId=&scope=admissibles|ajournes
 *        → téléchargement EN BLOC (archive ZIP, un PDF par candidat)
 *   POST /federis/school/national-exams/:examType/releves/send-to-parents
 *        → envoi aux parents (email + Helm Connect + cloche) — comme les bulletins
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import {
  FederisSchoolExamsService,
  SaveSelectionDto,
  SubmitSelectionDto,
} from './federis-school-exams.service';

@Controller('federis/school/national-exams')
export class FederisSchoolExamsController {
  constructor(private readonly schoolExamsService: FederisSchoolExamsService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getEligibility(@Req() req: any) {
    return this.schoolExamsService.getEligibility(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':examType/candidates')
  async getCandidates(@Req() req: any, @Param('examType') examType: string) {
    return this.schoolExamsService.getCandidates(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':examType/selection')
  async saveSelection(
    @Req() req: any,
    @Param('examType') examType: string,
    @Body() dto: SaveSelectionDto,
  ) {
    return this.schoolExamsService.saveSelection(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':examType/submit')
  async submitSelection(
    @Req() req: any,
    @Param('examType') examType: string,
    @Body() dto: SubmitSelectionDto,
  ) {
    return this.schoolExamsService.submitSelection(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      dto,
    );
  }

  // ── Délibération et relevés de notes (réception — 2026-09-30) ───────────

  /** Décisions du jury + relevés distribués pour les candidats de l'école. */
  @UseGuards(JwtAuthGuard)
  @Get(':examType/results')
  async getDeliberationResults(
    @Req() req: any,
    @Param('examType') examType: string,
  ) {
    return this.schoolExamsService.getDeliberationResults(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
    );
  }

  /** Relevé de notes structuré (visualisation dans l'interface école). */
  @UseGuards(JwtAuthGuard)
  @Get(':examType/releve/:candidateId')
  async getSchoolReleve(
    @Req() req: any,
    @Param('examType') examType: string,
    @Param('candidateId') candidateId: string,
    @Query('examId') examId: string,
  ) {
    if (!examId) {
      throw new BadRequestException('Paramètre examId requis.');
    }
    return this.schoolExamsService.getSchoolReleve(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      examId,
      candidateId,
    );
  }

  /** PDF officiel du relevé de notes (généré par le backend). */
  @UseGuards(JwtAuthGuard)
  @Get(':examType/releve/:candidateId/pdf')
  async downloadSchoolReleve(
    @Req() req: any,
    @Param('examType') examType: string,
    @Param('candidateId') candidateId: string,
    @Query('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!examId) {
      throw new BadRequestException('Paramètre examId requis.');
    }
    const { buffer, filename } = await this.schoolExamsService.getSchoolRelevePdf(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      examId,
      candidateId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  // ── ⭐ T27 (2026-10-01) — Actions en bloc sur les relevés distribués ──────

  /**
   * Téléchargement EN BLOC des relevés de notes (archive ZIP, un PDF par
   * candidat) — scope « admissibles » ou « ajournes ».
   */
  @UseGuards(JwtAuthGuard)
  @Get(':examType/releves/zip')
  async downloadSchoolRelevesZip(
    @Req() req: any,
    @Param('examType') examType: string,
    @Query('examId') examId: string,
    @Query('scope') scope: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!examId) {
      throw new BadRequestException('Paramètre examId requis.');
    }
    const normalizedScope = scope === 'ajournes' ? 'ajournes' : scope === 'admissibles' ? 'admissibles' : null;
    if (!normalizedScope) {
      throw new BadRequestException("Paramètre scope requis (admissibles | ajournes).");
    }
    const { buffer, filename } = await this.schoolExamsService.getSchoolRelevesBulkZip(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      examId,
      normalizedScope as 'admissibles' | 'ajournes',
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /**
   * Envoi des relevés de notes aux PARENTS (email avec PDF en pièce jointe +
   * message Helm Connect + notification cloche) — comme les bulletins.
   * Body : { examId, scope?: 'admissibles' | 'ajournes' | 'all' (défaut all) }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':examType/releves/send-to-parents')
  async sendRelevesToParents(
    @Req() req: any,
    @Param('examType') examType: string,
    @Body() body: { examId: string; scope?: 'admissibles' | 'ajournes' | 'all' },
  ) {
    if (!body?.examId) {
      throw new BadRequestException('Champ examId requis.');
    }
    const scope =
      body.scope === 'admissibles' || body.scope === 'ajournes' ? body.scope : 'all';
    return this.schoolExamsService.sendRelevesToParents(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      examType,
      body.examId,
      scope,
    );
  }
}
