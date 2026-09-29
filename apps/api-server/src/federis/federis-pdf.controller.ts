/**
 * FederisPdfController — Documents officiels PDF des examens (backend only)
 *
 *   GET /federis/exams/:examId/pdf/bordereaux?centerId=&roomId=
 *        Bordereaux d'émargement — une page par salle, table des candidats
 *        avec émargement, signatures surveillant / chef de centre.
 *   GET /federis/exams/:examId/pdf/palmares
 *        Palmarès officiel — résultats PUBLIÉS uniquement : classement,
 *        moyennes, mentions, statistiques, signatures officielles.
 *
 * Même pattern que les PDF Helm (contracts-prisma.controller.ts) :
 * le PDF est rendu côté backend (Chromium headless) et renvoyé en
 * StreamableFile avec Content-Disposition attachment — le frontend ne
 * fait qu'ouvrir l'URL, aucune génération côté client.
 */

import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FederisPdfService } from './federis-pdf.service';

@Controller('federis')
export class FederisPdfController {
  constructor(private readonly pdfService: FederisPdfService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  /** Bordereaux d'émargement (filtrables par centre / salle). */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/bordereaux')
  async downloadBordereaux(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('centerId') centerId?: string,
    @Query('roomId') roomId?: string,
  ) {
    const { buffer, filename } = await this.pdfService.generateBordereauxPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
      { centerId: centerId || undefined, roomId: roomId || undefined },
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /** Palmarès officiel (résultats publiés uniquement). */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/palmares')
  async downloadPalmares(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generatePalmaresPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /**
   * ⭐ Liste officielle de délibération (module Délibérations — 2026-09-30) :
   * admissibles + ajournés avec décision du jury. Générable dès la phase
   * DÉLIBERATED (bandeau provisoire) — liste définitive après publication.
   */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/deliberation')
  async downloadDeliberationList(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generateDeliberationPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  /** ⭐ Liste officielle des candidats (module Candidats — 2026-09-29). */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/candidats')
  async downloadCandidatesList(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generateCandidatesListPdf(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }

  // ── Relevés de notes (module « Notes et Moyennes » — 2026-09-29) ─────────
  //    Modèle PRIMAIRE (sans coefficients) pour le CEP, modèle SECONDAIRE
  //    (avec coefficients) pour le BEPC / BAC / CAP — A4 paysage, rendu
  //    100 % backend (pattern bulletins Helm).

  /** Relevé de notes d'UN candidat. */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/releve/:candidateId')
  async downloadReleve(
    @Req() req: any,
    @Param('examId') examId: string,
    @Param('candidateId') candidateId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generateRelevePdf(
      req.user.tenantId,
      this.uid(req),
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

  /** Relevés de notes de TOUS les candidats (un relevé par page). */
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/pdf/releves')
  async downloadAllReleves(
    @Req() req: any,
    @Param('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generateRelevePdf(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
