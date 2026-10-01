/**
 * FederisArchiveController — Module Archives (Academia Federis)
 *
 *   GET /federis/archives          — dossiers d'années scolaires (compteurs)
 *   GET /federis/archives/:yearId  — détail module par module (lecture seule)
 *
 * ⭐ 2026-10-01 — Archivage de fin d'année : consultation de toutes les
 *    données des années passées, organisées par année puis par module.
 *    Consultation pure (aucune écriture) : toutes les fonctions patronat.
 */

import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { FederisArchiveService } from './federis-archive.service';

@Controller('federis')
export class FederisArchiveController {
  constructor(private readonly archiveService: FederisArchiveService) {}

  /** Dossiers d'années (du plus récent au plus ancien). */
  @UseGuards(JwtAuthGuard)
  @Get('archives')
  async listYears(@Req() req: any, @Query('departmentId') _departmentId?: string) {
    return this.archiveService.listYears(req.user.tenantId, req.user.id || req.user.sub);
  }

  /** Détail d'une année : vue module par module (lecture seule). */
  @UseGuards(JwtAuthGuard)
  @Get('archives/:yearId')
  async getYearDetail(@Req() req: any, @Param('yearId') yearId: string) {
    return this.archiveService.getYearDetail(
      req.user.tenantId,
      req.user.id || req.user.sub,
      yearId,
    );
  }
}
