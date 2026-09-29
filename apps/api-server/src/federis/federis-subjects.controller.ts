/**
 * FederisSubjectsController — Module « Matières » (Academia Federis)
 *
 * Catalogue des matières d'examen par type (CEP | BEPC | BAC | CAP) et par
 * série (BAC : A1, A2, C, D… / CAP : filières) — reproduction du CRUD du
 * module Pédagogie Helm (SubjectsPrismaController), contextualisée Federis.
 * Le catalogue alimente le lancement des examens (attachement automatique),
 * le module Épreuves (signal « épreuves à préparer ») et le module Notes et
 * Moyennes (matières de la grille de saisie).
 *
 *   GET    /federis/subjects                 — catalogue (année active)
 *   POST   /federis/subjects                 — créer (upsert par code)
 *   POST   /federis/subjects/bulk            — création en lot (suggestions)
 *   POST   /federis/subjects/init            — jeu officiel du type/série
 *   PATCH  /federis/subjects/:id             — modifier (coeff, barème…)
 *   DELETE /federis/subjects/:id             — supprimer (épreuves détachées)
 *   GET    /federis/subjects/readiness       — signal épreuves (orange/vert)
 *   POST   /federis/exams/:examId/subjects/sync — catalogue → examen lancé
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisSubjectsService,
  CreateSubjectDto,
  UpdateSubjectDto,
  BulkCreateSubjectsDto,
  InitSubjectsDto,
} from './federis-subjects.service';

@Controller('federis')
export class FederisSubjectsController {
  constructor(private readonly subjectsService: FederisSubjectsService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  /** Catalogue des matières (filtres : type, recherche). */
  @UseGuards(JwtAuthGuard)
  @Get('subjects')
  async listSubjects(
    @Req() req: any,
    @Query('examType') examType?: string,
    @Query('search') search?: string,
  ) {
    return this.subjectsService.listSubjects(req.user.tenantId, this.uid(req), {
      examType: examType || undefined,
      search: search || undefined,
    });
  }

  /** ⭐ Signal « épreuves à préparer » — module Épreuves + page Matières. */
  @UseGuards(JwtAuthGuard)
  @Get('subjects/readiness')
  async getReadiness(@Req() req: any) {
    return this.subjectsService.getReadiness(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('subjects')
  async createSubject(@Req() req: any, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.createSubject(req.user.tenantId, this.uid(req), dto);
  }

  /** Création en lot (panneau de suggestions du jeu officiel). */
  @UseGuards(JwtAuthGuard)
  @Post('subjects/bulk')
  async bulkCreate(@Req() req: any, @Body() dto: BulkCreateSubjectsDto) {
    return this.subjectsService.bulkCreate(req.user.tenantId, this.uid(req), dto);
  }

  /** Initialise le jeu officiel du type (et de la série pour le BAC). */
  @UseGuards(JwtAuthGuard)
  @Post('subjects/init')
  async initOfficialSubjects(@Req() req: any, @Body() dto: InitSubjectsDto) {
    return this.subjectsService.initOfficialSubjects(req.user.tenantId, this.uid(req), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('subjects/:id')
  async updateSubject(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.updateSubject(req.user.tenantId, this.uid(req), id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subjects/:id')
  async deleteSubject(@Req() req: any, @Param('id') id: string) {
    return this.subjectsService.deleteSubject(req.user.tenantId, this.uid(req), id);
  }

  /**
   * ⭐ Synchronisation catalogue → examen : attache les matières du catalogue
   * du type aux matières de la campagne (codes manquants uniquement).
   * Exécutée automatiquement au lancement d'une campagne (updateExam →
   * REGISTRATION_OPEN / IN_PROGRESS) et disponible manuellement.
   */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/subjects/sync')
  async syncCatalogToExam(@Req() req: any, @Param('examId') examId: string) {
    return this.subjectsService.syncCatalogToExam(req.user.tenantId, this.uid(req), examId);
  }
}
