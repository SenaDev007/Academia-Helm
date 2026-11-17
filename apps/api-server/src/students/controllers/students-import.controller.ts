/**
 * ============================================================================
 * STUDENTS IMPORT CONTROLLER — Import en masse d'élèves via Excel
 * ============================================================================
 *
 * Endpoints :
 *   GET  /students/import/template  — Télécharge le template Excel vierge
 *   POST /students/import/preview   — Valide le fichier sans créer d'élèves
 *   POST /students/import/run       — Importe réellement les élèves
 *
 * Format : le fichier Excel est envoyé en base64 data URL dans le body JSON.
 * Pattern identique à upload-photo et upload-document du codebase.
 * ============================================================================
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { StudentsImportService } from '../services/students-import.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('students/import')
@UseGuards(JwtAuthGuard)
export class StudentsImportController {
  constructor(private readonly importService: StudentsImportService) {}

  /**
   * GET /students/import/classes?academicYearId=...
   * ⭐ 2026-11-17 — Liste les classes physiques disponibles pour le template
   * d'import (année cible si fournie, sinon année ACTIVE). Nourrit le
   * sélecteur de classes : l'école choisit les classes pour lesquelles elle
   * veut faire l'importation de masse, le template est généré en conséquence.
   */
  @Get('classes')
  async listClasses(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.importService.listTemplateClasses(tenantId, academicYearId || undefined);
  }

  /**
   * GET /students/import/template?classIds=...&academicYearId=...
   * Télécharge le template Excel multi-feuilles : une feuille par classe physique
   * configurée dans le système (pour le tenant courant).
   *
   * ⭐ 2026-11-17 — SÉLECTION DE CLASSES : `classIds` (répété ou séparé par des
   * virgules) restreint le template aux classes choisies par l'utilisateur.
   * Sans `classIds` : toutes les classes de l'année cible (comportement historique).
   * `academicYearId` (optionnel) cible l'année du template — cohérent avec
   * l'année utilisée ensuite pour le preview/run de l'import.
   *
   * Chaque feuille est nommée "MATERNELLE 1", "CP", "6ème", etc.
   * Les colonnes "Niveau scolaire" et "Classe" sont pré-remplies (readonly)
   * pour chaque feuille — l'école ne saisit que les informations élève.
   */
  @Get('template')
  async downloadTemplate(
    @TenantId() tenantId: string,
    @Query('classIds') classIds?: string | string[],
    @Query('academicYearId') academicYearId?: string,
    @Res() res: Response,
  ) {
    // ⭐ classIds : accepté répété (?classIds=a&classIds=b) OU en liste CSV
    // (?classIds=a,b,c) — les IDs sont des cuid/uuid (jamais de virgule interne).
    const flat = Array.isArray(classIds) ? classIds : (classIds ? [classIds] : []);
    const ids = flat
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    await this.importService.downloadTemplate(
      tenantId,
      res,
      ids.length > 0 ? ids : undefined,
      academicYearId || undefined,
    );
  }

  /**
   * POST /students/import/preview
   * Valide le fichier Excel sans créer d'élèves.
   * Body : { fileDataUrl, academicYearId }
   * Retourne : { totalRows, validRows, invalidRows, rows[], summary }
   */
  @Post('preview')
  async preview(
    @TenantId() tenantId: string,
    @Body() body: { fileDataUrl: string; academicYearId: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.importService.previewImport(tenantId, body.academicYearId, body.fileDataUrl);
  }

  /**
   * POST /students/import/run
   * Importe réellement les élèves du fichier Excel.
   * Body : { fileDataUrl, academicYearId }
   * Retourne : { totalRows, succeeded, failed, results[] }
   */
  @Post('run')
  async run(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { fileDataUrl: string; academicYearId: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.importService.runImport(tenantId, body.academicYearId, body.fileDataUrl, user?.id);
  }
}
