/**
 * ============================================================================
 * CNSS PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service CNSSPrismaService réécrit.
 * Utilise CNSSRate, EmployeeCNSS, CNSSDeclaration, CNSSDeclarationLine.
 *
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
  BadRequestException, Res,
} from '@nestjs/common';
import { CNSSPrismaService } from './cnss-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { UpsertCNSSRateDto, CreateCNSSDeclarationDto } from './dto/index';
import type { Response } from 'express';

@Controller('hr/cnss')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CNSSPrismaController {
  constructor(private readonly cnssService: CNSSPrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Get('rates/active')
  async getActiveCNSSRate(@Query('countryCode') countryCode: string = 'BJ') {
    return this.cnssService.findActiveCNSSRate(countryCode);
  }

  @Post('rates')
  async upsertCNSSRate(@Body() body: UpsertCNSSRateDto) {
    return this.cnssService.upsertCNSSRate({
      countryCode: body.countryCode,
      employeeRate: body.employeeRate,
      employerRate: body.employerRate,
      salaryCeiling: body.salaryCeiling,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AFFILIATIONS EMPLOYÉS CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Get('employees')
  async findAllEmployeeCNSS(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.cnssService.findAllEmployeeCNSS(tid);
  }

  @Post('employees')
  async findOrCreateEmployeeCNSS(
    @GetTenant() tenant: any,
    @Body() body: { staffId: string; cnssNumber?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.cnssService.findOrCreateEmployeeCNSS(
      body.staffId, tid, body.cnssNumber,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORT CNSS — salariés déclarés + règle de fréquence de versement
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /hr/cnss/export — JSON de synthèse : effectif déclaré, fréquence
   * (mensuel si effectif ≥ seuil, trimestriel sinon), prochaine échéance,
   * liste des salariés déclarés + CSV prêt à télécharger.
   */
  @Get('export')
  async exportDeclaredStaff(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.cnssService.getExportSummary(tid);
  }

  /** GET /hr/cnss/export/csv — fichier CSV (séparateur « ; », Excel FR). */
  @Get('export/csv')
  async exportDeclaredStaffCsv(
    @GetTenant() tenant: any,
    @Res() res: Response,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const summary = await this.cnssService.getExportSummary(tid);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cnss-salaries-declares-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    // BOM UTF-8 pour Excel
    res.send('\uFEFF' + summary.csv);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DÉCLARATIONS CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Post('declarations')
  async createDeclaration(
    @GetTenant() tenant: any,
    @Body() body: CreateCNSSDeclarationDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Derive month from periodStart if not provided
    const month = body.month || body.periodStart?.substring(0, 7) || new Date().toISOString().substring(0, 7);
    return this.cnssService.createCNSSDeclaration({
      tenantId: tid,
      academicYearId: body.academicYearId,
      month,
      notes: (body as any).notes,
    });
  }

  @Get('declarations')
  async findAllDeclarations(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.cnssService.findAllDeclarations(tid);
  }

  @Get('declarations/:id')
  async findDeclarationById(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.cnssService.findDeclarationById(id, tid);
  }

  @Put('declarations/:id/finalize')
  async finalizeDeclaration(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: {
      status: 'SUBMITTED' | 'PAID' | 'GENERATED';
      paymentReference?: string;
      paymentProofPath?: string;
    },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Accept GENERATED status and map to appropriate action
    const finalStatus = body.status === 'GENERATED' ? 'SUBMITTED' : body.status;
    return this.cnssService.finalizeDeclaration(
      id, tid, finalStatus as 'SUBMITTED' | 'PAID',
      body.paymentReference, body.paymentProofPath,
    );
  }

  @Delete('declarations/:id')
  async deleteDeclaration(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.cnssService.deleteDeclaration(id, tid);
  }
}
