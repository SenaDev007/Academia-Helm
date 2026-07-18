/**
 * FINANCE PDF EXPORT CONTROLLER
 * 
 * Endpoints pour générer des PDF via Puppeteur (rendu HTML → PDF professionnel).
 * Reproduit exactement le design du module élève (en-tête officielle République du Bénin).
 * 
 * GET /finance/exports/transactions/pdf?academicYearId=...&dateFrom=...&dateTo=...
 * GET /finance/exports/student-accounts/pdf?academicYearId=...
 * GET /finance/exports/cash-register/pdf?registerId=...
 * GET /finance/exports/cash-registers/pdf
 */
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { FinancePdfExportService } from './finance-pdf-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance/exports')
@UseGuards(JwtAuthGuard)
export class FinancePdfExportController {
  constructor(private readonly pdfExportService: FinancePdfExportService) {}

  @Get('transactions/pdf')
  async exportTransactionsPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response,
  ) {
    return this.pdfExportService.exportTransactionsPdf(tenantId, academicYearId, dateFrom, dateTo, res);
  }

  @Get('student-accounts/pdf')
  async exportStudentAccountsPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    // ⭐ Task 23 : flag includeWithdrawn pour inclure les élèves abandonnés
    @Query('includeWithdrawn') includeWithdrawn?: string,
    @Res() res?: Response,
  ) {
    return this.pdfExportService.exportStudentAccountsPdf(
      tenantId,
      academicYearId,
      res,
      classId,
      // ⭐ Task 23 : transmettre le flag au service
      includeWithdrawn === 'true',
    );
  }

  @Get('cash-register/pdf')
  async exportCashRegisterPdf(
    @TenantId() tenantId: string,
    @Query('registerId') registerId: string,
    @Res() res?: Response,
  ) {
    return this.pdfExportService.exportCashRegisterPdf(tenantId, registerId, res);
  }

  @Get('cash-registers/pdf')
  async exportAllCashRegistersPdf(
    @TenantId() tenantId: string,
    @Res() res?: Response,
  ) {
    return this.pdfExportService.exportAllCashRegistersPdf(tenantId, res);
  }
}
