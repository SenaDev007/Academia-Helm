/**
 * FederisSchoolExamsController — Examens nationaux côté établissement Helm
 *
 * Onglet « Examens nationaux » du module Examen (sous-onglets CEP / BEPC /
 * Baccalauréat — affichage dynamique selon les niveaux activés et les classes
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
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
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
}
