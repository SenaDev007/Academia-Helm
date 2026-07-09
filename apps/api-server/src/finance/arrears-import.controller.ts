/**
 * ARREARS IMPORT CONTROLLER — Import en masse d'arriérés via Excel
 *
 * Endpoints :
 *   GET  /finance/arrears-import/template — Télécharge le template Excel
 *   POST /finance/arrears-import/preview  — Valide le fichier sans créer
 *   POST /finance/arrears-import/run      — Importe réellement les arriérés
 */
import {
  Controller, Get, Post, Body, Res, UseGuards, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ArrearsImportService } from './arrears-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance/arrears-import')
@UseGuards(JwtAuthGuard)
export class ArrearsImportController {
  constructor(private readonly importService: ArrearsImportService) {}

  /**
   * GET /finance/arrears-import/template
   * Télécharge le template Excel multi-feuilles : une feuille par classe physique
   * configurée dans le système (pour le tenant courant).
   *
   * Chaque feuille est nommée d'après la classe (ex: "Maternelle 1", "CP", "6ème")
   * et contient la liste des élèves déjà inscrits dans cette classe (pré-remplis)
   * avec les colonnes montant vides à remplir.
   */
  @Get('template')
  async downloadTemplate(
    @TenantId() tenantId: string,
    @Res() res: Response,
  ) {
    await this.importService.downloadTemplate(tenantId, res);
  }

  @Post('preview')
  async preview(
    @TenantId() tenantId: string,
    @Body() body: { fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis');
    }
    return this.importService.previewImport(tenantId, body.fileDataUrl);
  }

  @Post('run')
  async run(
    @TenantId() tenantId: string,
    @Body() body: { fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis');
    }
    return this.importService.runImport(tenantId, body.fileDataUrl);
  }
}
