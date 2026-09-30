/**
 * FederisGradesController — Module « Notes et Moyennes » (Academia Federis)
 *
 * Reproduction du module Examen d'Academia Helm pour les examens nationaux :
 * saisie des notes (grille primaire CEP / secondaire avec coefficients
 * BEPC-BAC-CAP), registre des notes et relevés de notes (PDF backend).
 *
 *   GET    /federis/exams/:examId/subjects              — matières + coeff
 *   POST   /federis/exams/:examId/subjects              — ajouter une matière
 *   POST   /federis/exams/:examId/subjects/init         — jeu officiel du type
 *   PATCH  /federis/exams/:examId/subjects/:subjectId   — modifier (coeff…)
 *   DELETE /federis/exams/:examId/subjects/:subjectId   — supprimer (+ notes)
 *   GET    /federis/exams/:examId/grades/sheet          — grille de saisie
 *   POST   /federis/exams/:examId/grades/bulk           — enregistrer la grille
 *   POST   /federis/exams/:examId/grades/submit         — soumettre (verrou)
 *   POST   /federis/exams/:examId/grades/reopen         — rouvrir (brouillon)
 *   GET    /federis/exams/:examId/grades/registry       — registre des notes
 *   GET    /federis/exams/:examId/grades/releves        — relevés (données)
 *   GET    /federis/exams/:examId/pdf/releve/:candidateId — relevé PDF (1 candidat)
 *   GET    /federis/exams/:examId/pdf/releves           — tous les relevés PDF
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisGradesService,
  CreateSubjectDto,
  UpdateSubjectDto,
  BulkSaveGradesDto,
} from './federis-grades.service';
import { FederisSaisieService } from './federis-saisie.service';

@Controller('federis')
export class FederisGradesController {
  constructor(
    private readonly gradesService: FederisGradesService,
    private readonly saisieService: FederisSaisieService,
  ) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── Matières / épreuves ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/subjects')
  async listSubjects(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.listSubjects(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/subjects')
  async createSubject(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.gradesService.createSubject(req.user.tenantId, this.uid(req), examId, dto);
  }

  /** Initialise les matières officielles du type (CEP/BEPC/BAC/CAP). */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/subjects/init')
  async initDefaultSubjects(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.initDefaultSubjects(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('exams/:examId/subjects/:subjectId')
  async updateSubject(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.gradesService.updateSubject(
      req.user.tenantId,
      this.uid(req),
      examId,
      subjectId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('exams/:examId/subjects/:subjectId')
  async deleteSubject(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.gradesService.deleteSubject(
      req.user.tenantId,
      this.uid(req),
      examId,
      subjectId,
    );
  }

  // ── ⭐ 2026-10-01 — RÈGLE ÉPREUVE PRÉPARÉE : marquage manuel ────────────
  // L'épreuve a été produite hors application → le patronat la marque
  // « déjà préparée » pour débloquer la saisie des notes de la matière.

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/subjects/:subjectId/mark-prepared')
  async markSubjectPrepared(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.gradesService.markSubjectPrepared(
      req.user.tenantId,
      this.uid(req),
      examId,
      subjectId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/subjects/:subjectId/unmark-prepared')
  async unmarkSubjectPrepared(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.gradesService.unmarkSubjectPrepared(
      req.user.tenantId,
      this.uid(req),
      examId,
      subjectId,
    );
  }

  // ── Grille de saisie ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/grades/sheet')
  async getGradingSheet(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.getGradingSheet(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/grades/bulk')
  async bulkSaveGrades(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: BulkSaveGradesDto,
  ) {
    return this.gradesService.bulkSaveGrades(req.user.tenantId, this.uid(req), examId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/grades/submit')
  async submitGrades(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.submitGrades(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/grades/reopen')
  async reopenGrades(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.reopenGrades(req.user.tenantId, this.uid(req), examId);
  }

  // ── Registre des notes ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/grades/registry')
  async getRegistry(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.getRegistry(req.user.tenantId, this.uid(req), examId);
  }

  // ── Relevés de notes (données — le PDF vit dans FederisPdfController) ─────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/grades/releves')
  async getReleves(@Req() req: any, @Param('examId') examId: string) {
    return this.gradesService.getReleves(req.user.tenantId, this.uid(req), examId);
  }

  // ── ⭐ 2026-10-01 — Suivi TEMPS RÉEL de la saisie (secrétaires) ──────────
  // Progression par secrétaire (centre + salle), statut, dernière activité
  // + activité récente nominative — consommé par l'onglet « Suivi temps réel »
  // du module Notes et moyennes (rafraîchissement automatique).

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/grades/live')
  async getLive(@Req() req: any, @Param('examId') examId: string) {
    return this.saisieService.getLive(req.user.tenantId, this.uid(req), examId);
  }
}
