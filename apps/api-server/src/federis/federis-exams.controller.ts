/**
 * FederisExamsController — Workflow examens nationaux (Academia Federis)
 *
 *   GET    /federis/exams                              — examens du patronat
 *   POST   /federis/exams                              — créer un examen
 *   PATCH  /federis/exams/:examId                      — statut / infos examen
 *   GET    /federis/exams/:examId/centers              — centres + salles
 *   POST   /federis/exams/:examId/centers              — créer un centre
 *   PATCH  /federis/centers/:centerId                  — modifier / archiver un centre
 *   POST   /federis/centers/:centerId/rooms            — créer une salle
 *   PATCH  /federis/rooms/:roomId                      — modifier une salle
 *   GET    /federis/exams/:examId/candidates           — candidats (recherche)
 *   GET    /federis/exams/:examId/school-lists         — listes officielles par école
 *   POST   /federis/exams/:examId/candidates           — ajout manuel
 *   POST   /federis/exams/:examId/candidates/import    — import par lot (Excel)
 *   POST   /federis/exams/:examId/candidates/assign-center — affectation MANUELLE
 *          sélection → centre (phase préalable aux numéros de table)
 *   POST   /federis/exams/:examId/candidates/purge-duplicates — purge des doublons
 *   POST   /federis/exams/:examId/assign-tables        — numéros de table {SALLE}-{n°}
 *   POST   /federis/exams/:examId/anonymats/generate   — anonymats (2026-09-29)
 *   GET    /federis/exams/:examId/excel/candidats      — export Excel (2026-09-29)
 *   GET    /federis/exams/:examId/excel/centres        — export Excel (2026-09-30)
 *   GET    /federis/exams/:examId/excel/surveillants   — export Excel (2026-09-30)
 *   GET    /federis/settings/matricule                 — format matricule (Paramètres)
 *   PUT    /federis/settings/matricule                 — enregistrer le format
 *   GET    /federis/settings/grading-rules             — règles de calcul (2026-09-30)
 *   PUT    /federis/settings/grading-rules/:examType   — définir (source de vérité)
 *   DELETE /federis/settings/grading-rules/:examType   — réinitialiser (défauts)
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  FederisExamsService,
  CreateExamDto,
  UpdateExamDto,
  CreateCenterDto,
  UpdateCenterDto,
  CreateRoomDto,
  UpdateRoomDto,
  ImportCandidatesDto,
  AddCandidateDto,
  AssignTablesDto,
  AssignCandidatesToCenterDto,
  GenerateAnonymatsDto,
  UpdateMatriculeFormatDto,
} from './federis-exams.service';
import { FederisCandidatesExportService } from './federis-candidates-export.service';
// ⭐ 2026-09-30 — exports Excel du module « Centres, salles & Surveillants »
import { FederisLogisticsExportService } from './federis-logistics-export.service';
import { FederisGradingRulesService, UpdateGradingRuleDto } from './federis-grading-rules.service';

@Controller('federis')
export class FederisExamsController {
  constructor(
    private readonly examsService: FederisExamsService,
    private readonly candidatesExport: FederisCandidatesExportService,
    private readonly logisticsExport: FederisLogisticsExportService,
    private readonly gradingRulesService: FederisGradingRulesService,
  ) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── Examens ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams')
  async listExams(@Req() req: any, @Query('departmentId') departmentId?: string) {
    // ⭐ 2026-10-01 — Agrégation nationale : departmentId filtre la vue sur
    //    UN département du réseau (patronat national connecté).
    return this.examsService.listExams(
      req.user.tenantId,
      this.uid(req),
      departmentId || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams')
  async createExam(@Req() req: any, @Body() dto: CreateExamDto) {
    return this.examsService.createExam(req.user.tenantId, this.uid(req), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('exams/:examId')
  async updateExam(@Req() req: any, @Param('examId') examId: string, @Body() dto: UpdateExamDto) {
    return this.examsService.updateExam(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Centres & salles ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/centers')
  async listCenters(@Req() req: any, @Param('examId') examId: string) {
    return this.examsService.listCenters(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/centers')
  async createCenter(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: CreateCenterDto,
  ) {
    return this.examsService.createCenter(req.user.tenantId, this.uid(req), examId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('centers/:centerId')
  async updateCenter(
    @Req() req: any,
    @Param('centerId') centerId: string,
    @Body() dto: UpdateCenterDto,
  ) {
    return this.examsService.updateCenter(req.user.tenantId, this.uid(req), centerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('centers/:centerId/rooms')
  async createRoom(
    @Req() req: any,
    @Param('centerId') centerId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.examsService.createRoom(req.user.tenantId, this.uid(req), centerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('rooms/:roomId')
  async updateRoom(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: UpdateRoomDto) {
    return this.examsService.updateRoom(req.user.tenantId, this.uid(req), roomId, dto);
  }

  // ── Candidats ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/candidates')
  async listCandidates(
    @Req() req: any,
    @Param('examId') examId: string,
    @Query('q') q?: string,
  ) {
    return this.examsService.listCandidates(req.user.tenantId, this.uid(req), examId, q);
  }

  // ⭐ Listes officielles transmises par les écoles rattachées (2026-09-29) —
  //    candidats de la campagne regroupés PAR ÉCOLE + informations de
  //    l'établissement (ville, département, contact).
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/school-lists')
  async listSchoolLists(@Req() req: any, @Param('examId') examId: string) {
    return this.examsService.listSchoolLists(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates')
  async addCandidate(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: AddCandidateDto,
  ) {
    return this.examsService.addCandidate(req.user.tenantId, this.uid(req), examId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates/import')
  async importCandidates(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: ImportCandidatesDto,
  ) {
    return this.examsService.importCandidates(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Affectation manuelle aux centres (2026-09-30 — refonte) ───────────────
  //
  // Le patronat sélectionne des candidats et les oriente vers UN centre.
  // body : { candidateIds: string[], centerId?: string | null }
  //   • centerId renseigné → affectation à ce centre (réaffectation = reset
  //     salle / n° de table de l'ancien centre)
  //   • centerId absent/null → retrait de l'affectation
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates/assign-center')
  async assignCandidatesToCenter(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: AssignCandidatesToCenterDto,
  ) {
    return this.examsService.assignCandidatesToCenter(
      req.user.tenantId,
      this.uid(req),
      examId,
      dto,
    );
  }

  /** Purge des doublons d'identité (une ligne conservée par personne). */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates/purge-duplicates')
  async purgeDuplicateCandidates(
    @Req() req: any,
    @Param('examId') examId: string,
  ) {
    return this.examsService.purgeDuplicateCandidates(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
  }

  // ── Numéros de table ─────────────────────────────────────────────────────

  /**
   * Génération des numéros de table — UNIQUEMENT pour les candidats déjà
   * affectés à un centre ; numéro aligné sur la salle : S01-001, S01-002…
   */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/assign-tables')
  async assignTables(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: AssignTablesDto,
  ) {
    return this.examsService.assignTableNumbers(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Anonymats (post-composition — 2026-09-29) ──────────────────────────

  /** Génère (ou régénère) les codes d'anonymat des candidats de l'examen. */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/anonymats/generate')
  async generateAnonymats(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: GenerateAnonymatsDto,
  ) {
    return this.examsService.generateAnonymats(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Export Excel de la liste officielle (2026-09-29) ────────────────────

  /** Liste officielle des candidats — classeur Excel (Synthèse + 1 feuille/centre). */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/excel/candidats')
  async exportCandidatesExcel(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.candidatesExport.generateCandidatesExcel(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  // ── Exports Excel « Centres, salles & Surveillants » (2026-09-30) ───────

  /** Liste officielle des centres et des salles — classeur Excel
   *  (Synthèse + Centres + Salles). Sous-onglet « Centres et salles ». */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/excel/centres')
  async exportCentersExcel(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.logisticsExport.generateCentersExcel(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /** Liste officielle du personnel d'examen — classeur Excel, un poste à la
   *  fois (?post=SURVEILLANCE | SECRETARIAT | CORRECTION ; sans = complet).
   *  Sous-onglet « Gestion des surveillants ». */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/excel/surveillants')
  async exportSupervisorsExcel(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('post') post?: string,
  ) {
    const { buffer, filename } = await this.logisticsExport.generateSupervisorsExcel(
      req.user.tenantId,
      this.uid(req),
      examId,
      post,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  // ── Format de matricule (module Paramètres — 2026-09-29) ────────────────

  @UseGuards(JwtAuthGuard)
  @Get('settings/matricule')
  async getMatriculeSettings(@Req() req: any) {
    return this.examsService.getMatriculeSettings(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings/matricule')
  async updateMatriculeSettings(@Req() req: any, @Body() dto: UpdateMatriculeFormatDto) {
    return this.examsService.updateMatriculeSettings(req.user.tenantId, this.uid(req), dto);
  }

  // ── Règles de calcul (module Paramètres — 2026-09-30) ──────────────────
  //    Défauts du backend affichés tant qu'aucune surcharge n'existe ;
  //    dès qu'une règle est définie, elle devient la source de vérité.

  @UseGuards(JwtAuthGuard)
  @Get('settings/grading-rules')
  async getGradingRules(@Req() req: any) {
    return this.gradingRulesService.getGradingRulesConfig(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings/grading-rules/:examType')
  async updateGradingRule(
    @Req() req: any,
    @Param('examType') examType: string,
    @Body() dto: UpdateGradingRuleDto,
  ) {
    return this.gradingRulesService.upsertGradingRule(
      req.user.tenantId,
      this.uid(req),
      examType,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('settings/grading-rules/:examType')
  async resetGradingRule(@Req() req: any, @Param('examType') examType: string) {
    return this.gradingRulesService.resetGradingRule(
      req.user.tenantId,
      this.uid(req),
      examType,
    );
  }
}
