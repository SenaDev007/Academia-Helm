/**
 * FederisDeliberationController — Délibération du jury & publication
 *
 * ⭐ REFONTE 2026-09-30 : plus NI saisie des notes NI simulation de seuils —
 *    la saisie vit dans « Notes et Moyennes », les seuils dans « Paramètres —
 *    Règles de calcul ». Le module = délibération et publication officielle.
 *
 *   GET  /federis/exams/:examId/deliberation/board   — tableau de délibération
 *        (admissibles / ajournés, moyennes, décision du jury, dispatch)
 *   POST /federis/exams/:examId/deliberation         — délibérer (jury)
 *   POST /federis/deliberations/:id/cases/:caseId    — trancher un cas
 *   POST /federis/deliberations/:id/close            — clôturer
 *   POST /federis/deliberations/:id/publish          — publier + notifs parents
 *   POST /federis/exams/:examId/releves/dispatch     — envoyer les relevés
 *        de notes aux écoles (distribution intelligente par candidat)
 *   GET  /federis/exams/:examId/results              — résultats détaillés
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisDeliberationService,
  RunDeliberationDto,
  DecideCaseDto,
} from './federis-deliberation.service';

@Controller('federis')
export class FederisDeliberationController {
  constructor(private readonly deliberationService: FederisDeliberationService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/deliberation/board')
  async getDeliberationBoard(@Req() req: any, @Param('examId') examId: string) {
    return this.deliberationService.getDeliberationBoard(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/deliberation')
  async runDeliberation(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: RunDeliberationDto,
  ) {
    return this.deliberationService.runDeliberation(
      req.user.tenantId,
      this.uid(req),
      examId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('deliberations/:deliberationId/cases/:caseId')
  async decideCase(
    @Req() req: any,
    @Param('deliberationId') deliberationId: string,
    @Param('caseId') caseId: string,
    @Body() dto: DecideCaseDto,
  ) {
    return this.deliberationService.decideCase(
      req.user.tenantId,
      this.uid(req),
      deliberationId,
      caseId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('deliberations/:deliberationId/close')
  async closeDeliberation(
    @Req() req: any,
    @Param('deliberationId') deliberationId: string,
  ) {
    return this.deliberationService.closeDeliberation(
      req.user.tenantId,
      this.uid(req),
      deliberationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('deliberations/:deliberationId/publish')
  async publishResults(
    @Req() req: any,
    @Param('deliberationId') deliberationId: string,
  ) {
    return this.deliberationService.publishResults(
      req.user.tenantId,
      this.uid(req),
      deliberationId,
    );
  }

  /** Distribution des relevés de notes aux écoles (délibération + notes). */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/releves/dispatch')
  async dispatchReleves(@Req() req: any, @Param('examId') examId: string) {
    return this.deliberationService.dispatchReleves(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/results')
  async listResults(@Req() req: any, @Param('examId') examId: string) {
    return this.deliberationService.listResults(req.user.tenantId, this.uid(req), examId);
  }
}
