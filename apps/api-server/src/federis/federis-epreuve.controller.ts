/**
 * FederisEpreuveController — Épreuves & catalogue (Academia Federis)
 *
 * Module « Épreuves et documents » — deux onglets :
 *
 *   GET    /federis/patronat/epreuves                 — liste (onglet Épreuves)
 *   GET    /federis/patronat/epreuves/catalogue       — arborescence catalogue
 *        (année scolaire → CEP / BEPC / Baccalauréat / CAP → épreuves)
 *   POST   /federis/patronat/epreuves                 — créer une épreuve
 *   GET    /federis/patronat/epreuves/header          — en-tête réutilisable
 *   PUT    /federis/patronat/epreuves/header          — définir l'en-tête
 *   GET    /federis/patronat/epreuves/:id             — détail (édition)
 *   PATCH  /federis/patronat/epreuves/:id             — mise à jour (autosave)
 *   DELETE /federis/patronat/epreuves/:id             — supprimer
 *   GET    /federis/patronat/epreuves/:id/pdf         — PDF (backend Puppeteer)
 *
 * Isolation territoriale : toutes les requêtes passent par le tenant du
 * JWT — le patronat du Borgou ne voit jamais les épreuves de l'Alibori.
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
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisEpreuveService,
  CreateEpreuveDto,
  UpdateEpreuveDto,
  UpdateEpreuveHeaderDto,
} from './federis-epreuve.service';

@Controller('federis')
export class FederisEpreuveController {
  constructor(private readonly epreuveService: FederisEpreuveService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── Onglet « Épreuves » ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('patronat/epreuves')
  async listEpreuves(@Req() req: any, @Query('departmentId') departmentId?: string) {
    // ⭐ 2026-10-02 — Vue par département (patronat national) : liste les
    //    épreuves du département sélectionné sur la grille d'entrée du module.
    return this.epreuveService.listEpreuves(
      req.user.tenantId,
      this.uid(req),
      departmentId || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/epreuves')
  async createEpreuve(@Req() req: any, @Body() dto: CreateEpreuveDto) {
    return this.epreuveService.createEpreuve(req.user.tenantId, this.uid(req), dto);
  }

  // ── En-tête réutilisable du patronat ─────────────────────────────────────
  // (déclaré AVANT les routes paramétrées :id pour ne pas être capturé)

  @UseGuards(JwtAuthGuard)
  @Get('patronat/epreuves/header')
  async getHeader(
    @Req() req: any,
    @Query('departmentId') departmentId?: string,
  ) {
    // ⭐ 2026-10-02 — Vue par département : en-tête réutilisable du département
    //    consulté (patronat national — lecture seule).
    return this.epreuveService.getHeader(
      req.user.tenantId,
      this.uid(req),
      departmentId || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('patronat/epreuves/header')
  async updateHeader(@Req() req: any, @Body() dto: UpdateEpreuveHeaderDto) {
    return this.epreuveService.updateHeader(req.user.tenantId, this.uid(req), dto);
  }

  // ── Catalogue (année scolaire → examen → épreuves) ──────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('patronat/epreuves/catalogue')
  async catalogue(@Req() req: any) {
    return this.epreuveService.catalogue(req.user.tenantId, this.uid(req));
  }

  // ── Épreuve individuelle ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('patronat/epreuves/:id')
  async getEpreuve(@Req() req: any, @Param('id') id: string) {
    return this.epreuveService.getEpreuve(req.user.tenantId, this.uid(req), id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('patronat/epreuves/:id')
  async updateEpreuve(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEpreuveDto,
  ) {
    return this.epreuveService.updateEpreuve(req.user.tenantId, this.uid(req), id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('patronat/epreuves/:id')
  async deleteEpreuve(@Req() req: any, @Param('id') id: string) {
    return this.epreuveService.deleteEpreuve(req.user.tenantId, this.uid(req), id);
  }

  /** PDF de l'épreuve — rendu 100 % backend (Puppeteer), aucune génération frontend. */
  @UseGuards(JwtAuthGuard)
  @Get('patronat/epreuves/:id/pdf')
  async downloadPdf(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.epreuveService.exportPdf(
      req.user.tenantId,
      this.uid(req),
      id,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
