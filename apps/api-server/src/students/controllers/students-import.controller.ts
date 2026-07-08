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
   * GET /students/import/template
   * Télécharge le template Excel vierge avec en-têtes et exemples.
   */
  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    await this.importService.downloadTemplate(res);
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
