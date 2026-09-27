/**
 * FederisDeliberationController — Workflow délibération → publication
 *
 *   GET  /federis/exams/:examId/deliberation            — état de préparation
 *   POST /federis/exams/:examId/results/bulk            — saisie des notes
 *   POST /federis/exams/:examId/deliberation/simulate   — simulation (lecture)
 *   POST /federis/exams/:examId/deliberation            — délibérer (jury)
 *   POST /federis/deliberations/:id/cases/:caseId       — trancher un cas
 *   POST /federis/deliberations/:id/close               — clôturer
 *   POST /federis/deliberations/:id/publish             — publier + notifs parents
 *   GET  /federis/exams/:examId/results                 — résultats détaillés
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisDeliberationService,
  BulkResultsDto,
  SimulateDeliberationDto,
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
  @Get('exams/:examId/deliberation')
  async getDeliberationState(@Req() req: any, @Param('examId') examId: string) {
    return this.deliberationService.getDeliberationState(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/results/bulk')
  async bulkUpsertResults(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: BulkResultsDto,
  ) {
    return this.deliberationService.bulkUpsertResults(
      req.user.tenantId,
      this.uid(req),
      examId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/deliberation/simulate')
  async simulate(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: SimulateDeliberationDto,
  ) {
    return this.deliberationService.simulate(req.user.tenantId, this.uid(req), examId, dto);
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

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/results')
  async listResults(@Req() req: any, @Param('examId') examId: string) {
    return this.deliberationService.listResults(req.user.tenantId, this.uid(req), examId);
  }
}
