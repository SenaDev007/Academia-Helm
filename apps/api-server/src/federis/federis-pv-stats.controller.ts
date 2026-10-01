/**
 * FederisPvStatsController — Procès-verbal & Statistiques (module Rapports)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ T46 (2026-10-01) — Reproduction du pattern Helm
 * (PvStatsPromotionPdfController — POST payload + branding backend) :
 *
 *   POST /federis/exams/:examId/reports/proces-verbal
 *        Procès-verbal d'examen — A4 paysage : tableau principal
 *        (Matricule | Nom | Matières + Coef | Total | Coef | Moyenne | Rang)
 *        + Trois premiers / Trois derniers.
 *   POST /federis/exams/:examId/reports/statistiques
 *        Statistiques — A4 paysage : taux de réussite (+ graphique),
 *        intervalle des notes / moyennes ou Top N selon le sous-onglet.
 *
 * Le FRONT calcule les tableaux (il a déjà chargé le registre des notes —
 * données officielles du module Notes et Moyennes) et envoie le payload ;
 * le BACKEND vérifie que l'examen appartient au patronat du tenant, résout
 * le branding (patronat organisateur + logo + session officielle) et rend
 * le PDF via Chromium headless (StreamableFile + Content-Disposition).
 */

import { Body, Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisPvStatsPdfService,
} from './federis-pv-stats-pdf.service';

@Controller('federis')
export class FederisPvStatsController {
  constructor(private readonly pvStatsPdfService: FederisPvStatsPdfService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  /** Procès-verbal d'examen (PDF A4 paysage). */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/reports/proces-verbal')
  async downloadProcVerbal(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pvStatsPdfService.generateProcVerbalPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
      body ?? {},
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /** Statistiques d'examen (PDF A4 paysage). */
  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/reports/statistiques')
  async downloadStatistiques(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pvStatsPdfService.generateStatsPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
      body ?? {},
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
