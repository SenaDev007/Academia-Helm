/**
 * ============================================================================
 * COMPTA EXPORT CONTROLLER — Endpoints d'export comptable
 * ============================================================================
 *
 * Endpoints :
 *   GET /finance/exports/compta/fec     — Fichier d'Écritures Comptables (France)
 *   GET /finance/exports/compta/ohada   — CSV OHADA (Bénin / Afrique)
 *   GET /finance/exports/compta/csv     — CSV universel (Sage, QuickBooks, etc.)
 *
 * Query params :
 *   - dateFrom (YYYY-MM-DD) — date de début (incluse)
 *   - dateTo   (YYYY-MM-DD) — date de fin (incluse)
 *   - academicYearId        — filtrer par année scolaire
 *
 * Réponse : fichier texte/CSV téléchargeable (Content-Disposition: attachment).
 * ============================================================================
 */
import { Controller, Get, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ComptaExportService, ComptaExportFilters } from './compta-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance/exports/compta')
@UseGuards(JwtAuthGuard)
export class ComptaExportController {
  constructor(private readonly comptaExportService: ComptaExportService) {}

  /**
   * GET /finance/exports/compta/fec?dateFrom=2026-01-01&dateTo=2026-01-31
   * Télécharge un fichier FEC conforme à la norme française (18 colonnes |).
   * Compatible : Sage 100, Ciel, EBP, QuickBooks, Pennylane, Yooz, Dex, Odoo.
   */
  @Get('fec')
  async exportFec(
    @TenantId() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('academicYearId') academicYearId?: string,
    @Res() res?: Response,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('Les paramètres dateFrom et dateTo sont obligatoires (format YYYY-MM-DD).');
    }
    const filters: ComptaExportFilters = { dateFrom, dateTo, academicYearId };
    const ecritures = await this.comptaExportService.getAllEcritures(tenantId, filters);
    const content = this.comptaExportService.generateFecContent(ecritures);
    const fileName = this.comptaExportService.generateFileName('fec', filters);

    res!.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res!.send(content);
  }

  /**
   * GET /finance/exports/compta/ohada?dateFrom=2026-01-01&dateTo=2026-01-31
   * Télécharge un fichier CSV OHADA (séparateur ;).
   * Compatible : Sage OHADA, Compta Bénin, EBP OHADA, Odoo (module ohada_account).
   */
  @Get('ohada')
  async exportOhada(
    @TenantId() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('academicYearId') academicYearId?: string,
    @Res() res?: Response,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('Les paramètres dateFrom et dateTo sont obligatoires (format YYYY-MM-DD).');
    }
    const filters: ComptaExportFilters = { dateFrom, dateTo, academicYearId };
    const ecritures = await this.comptaExportService.getAllEcritures(tenantId, filters);
    const content = this.comptaExportService.generateOhadaCsvContent(ecritures);
    const fileName = this.comptaExportService.generateFileName('ohada', filters);

    // BOM UTF-8 pour Excel français (sinon les accents sont mal décodés)
    const bom = '\uFEFF';
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res!.send(bom + content);
  }

  /**
   * GET /finance/exports/compta/csv?dateFrom=2026-01-01&dateTo=2026-01-31
   * Télécharge un CSV universel (séparateur ,) mappable dans n'importe quel logiciel.
   * Compatible : Sage, QuickBooks, Xero, Free Acomba, etc.
   */
  @Get('csv')
  async exportCsv(
    @TenantId() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('academicYearId') academicYearId?: string,
    @Res() res?: Response,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('Les paramètres dateFrom et dateTo sont obligatoires (format YYYY-MM-DD).');
    }
    const filters: ComptaExportFilters = { dateFrom, dateTo, academicYearId };
    const ecritures = await this.comptaExportService.getAllEcritures(tenantId, filters);
    const content = this.comptaExportService.generateUniversalCsvContent(ecritures);
    const fileName = this.comptaExportService.generateFileName('csv', filters);

    const bom = '\uFEFF';
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res!.send(bom + content);
  }
}
