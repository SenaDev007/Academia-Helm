/**
 * ============================================================================
 * PAYROLL PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param,
  Query, UseGuards, Res
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollPrismaService } from './payroll-prisma.service';
import { TaxService } from './services/tax.service';
import { PayrollTaxService } from './services/payroll-tax.service';
import { PayrollPdfService } from './services/payroll-pdf.service';
import { HROrionService } from './services/hr-orion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/hr/payroll')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PayrollPrismaController {
  constructor(
    private readonly payrollService: PayrollPrismaService,
    private readonly taxService: TaxService,
    private readonly payrollTaxService: PayrollTaxService,
    private readonly payrollPdfService: PayrollPdfService,
    private readonly hrOrionService: HROrionService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // PÉRIODES DE PAIE
  // ──────────────────────────────────────────────────────────────────────────

  @Post('periods')
  async createPeriod(@GetTenant() tenant: any, @Body() body: any) {
    return this.payrollService.createPayrollPeriod({
      tenantId: tenant.id,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  @Get('periods')
  async findAllPeriods(@GetTenant() tenant: any) {
    return this.payrollService.findAllPeriods(tenant.id);
  }

  @Get('periods/:id')
  async findPeriodById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPeriodById(id, tenant.id);
  }

  @Post('periods/:id/generate')
  async generatePayrolls(
    @GetTenant() tenant: any,
    @Param('id') periodId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.payrollService.generatePayrollsForPeriod(
      periodId, tenant.id, academicYearId,
    );
  }

  @Post('periods/:id/calculate')
  async calculatePeriod(
    @GetTenant() tenant: any,
    @Param('id') periodId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.payrollTaxService.calculatePeriod(
      periodId, tenant.id, academicYearId,
    );
  }

  @Put('periods/:id/status')
  async updatePeriodStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.payrollService.updatePeriodStatus(id, tenant.id, body.status);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LIGNES DE PAIE
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id')
  async findPayrollById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollById(id, tenant.id);
  }

  @Post(':id/calculate')
  async calculatePayrollLine(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('countryCode') countryCode: string = 'BJ',
  ) {
    return this.payrollTaxService.calculatePayroll(
      tenant.id, academicYearId, payrollId, countryCode,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX CNSS PAR TENANT
  // ──────────────────────────────────────────────────────────────────────────

  @Get('rates/active')
  async getActivePayrollRate(@GetTenant() tenant: any) {
    return this.payrollService.findActivePayrollRate(tenant.id);
  }

  @Post('rates')
  async upsertPayrollRate(@GetTenant() tenant: any, @Body() body: any) {
    return this.payrollService.upsertPayrollRate({
      tenantId: tenant.id,
      cnssEmployeeRate: body.cnssEmployeeRate,
      cnssEmployerRate: body.cnssEmployerRate,
      taxRate: body.taxRate,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STATISTIQUES
  // ──────────────────────────────────────────────────────────────────────────

  @Get('statistics')
  async getPayrollStatistics(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.payrollService.getPayrollStatistics(tenant.id, academicYearId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FISCALITÉ (TaxWithholding / TaxRate)
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id/tax-withholdings')
  async getTaxWithholdings(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
  ) {
    return this.taxService.getTaxWithholdings(payrollId, tenant.id);
  }

  @Get('tax-stats')
  async getTaxStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.taxService.getTaxStats(tenant.id, academicYearId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULLETINS PDF
  // ──────────────────────────────────────────────────────────────────────────

  @Post(':id/payslip-pdf')
  async generatePaySlipPdf(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @CurrentUser() user: any,
  ) {
    return this.payrollPdfService.generatePaySlipPdf(payrollId, tenant.id, user.id);
  }

  @Get(':id/payslip-pdf')
  async getPaySlipPdf(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.payrollPdfService.getPaySlipPdf(payrollId, tenant.id);

    if (!pdfBuffer) {
      return res.status(404).json({ error: 'PDF introuvable' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bulletin-${payrollId}.pdf"`,
    );
    return res.send(pdfBuffer);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ORION
  // ──────────────────────────────────────────────────────────────────────────

  @Get('orion/kpis')
  async getPayrollKPIs(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.hrOrionService.getPayrollAndTaxKPIs(tenant.id, academicYearId);
  }

  @Get('orion/alerts')
  async getPayrollAlerts(@GetTenant() tenant: any) {
    return this.hrOrionService.generateAlerts(tenant.id);
  }
}
