/**
 * ============================================================================
 * PAYROLL DOCUMENTS CONTROLLER — FP / EP (RH Bénin)
 * ============================================================================
 *
 * Endpoints documents de paie officiels (fiches FP / états de paiement EP) :
 *
 *   POST /hr/payroll/documents/preview/:payrollItemId  → snapshot + HTML (non émis)
 *   POST /hr/payroll/documents/issue/:payrollItemId    → émission immuable (numéro + SHA-256)
 *   GET  /hr/payroll/documents?tenantId=&periodYear=…  → registre
 *   GET  /hr/payroll/documents/:id                     → détail
 *   GET  /hr/payroll/documents/:id/download            → PDF archivé (+ contrôle hash)
 *
 * Le type de document N'EST JAMAIS un paramètre : il découle du statut
 * contractuel du personnel (salarié déclaré/non déclaré → fiche ; prestataire
 * → état de paiement). Les montants proviennent de la ligne de paie calculée.
 * ============================================================================
 */

import {
  Controller, Get, Post, Param, Query, UseGuards, Res, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollDocumentsService } from './services/payroll-documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('hr/payroll/documents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PayrollDocumentsController {
  constructor(private readonly documentsService: PayrollDocumentsService) {}

  /** Prévisualisation — même construction que l'émission, sans numéro ni hash. */
  @Post('preview/:payrollItemId')
  async preview(
    @GetTenant() tenant: any,
    @Param('payrollItemId') payrollItemId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
    return this.documentsService.previewDocument(payrollItemId, tid);
  }

  /** Émission — immuable (une ligne = un document), numérotée, scellée, archivée. */
  @Post('issue/:payrollItemId')
  async issue(
    @GetTenant() tenant: any,
    @Param('payrollItemId') payrollItemId: string,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
    return this.documentsService.issueDocument(payrollItemId, tid, user);
  }

  /** Registre des documents émis (filtres période / type / personnel). */
  @Get()
  async list(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
    @Query('periodYear') periodYear?: string,
    @Query('periodMonth') periodMonth?: string,
    @Query('documentType') documentType?: string,
    @Query('staffId') staffId?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
    const year = periodYear ? parseInt(periodYear, 10) : undefined;
    const month = periodMonth ? parseInt(periodMonth, 10) : undefined;
    return this.documentsService.listDocuments(tid, {
      ...(year && !isNaN(year) ? { periodYear: year } : {}),
      ...(month && !isNaN(month) ? { periodMonth: month } : {}),
      ...(documentType ? { documentType } : {}),
      ...(staffId ? { staffId } : {}),
    });
  }

  /** Détail d'un document émis (snapshot figé). */
  @Get(':id')
  async detail(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
    return this.documentsService.getDocument(id, tid);
  }

  /** Téléchargement du PDF archivé — fichier TEL QU'ÉMIS + contrôle SHA-256. */
  @Get(':id/download')
  async download(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
    const { buffer, document } = await this.documentsService.downloadDocument(id, tid);
    const staffName = document?.staff
      ? `${document.staff.lastName}_${document.staff.firstName}`.replace(/\s+/g, '_')
      : 'personnel';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.documentNumber}-${staffName}.pdf"`,
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('X-Content-Hash', document.contentHash);
    return res.send(buffer);
  }
}
