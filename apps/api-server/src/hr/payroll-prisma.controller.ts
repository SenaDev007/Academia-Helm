/**
 * ============================================================================
 * PAYROLL PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service PayrollPrismaService réécrit.
 * Utilise les modèles Payroll (batch) + PayrollItem (lignes).
 *
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param,
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
import {
  CreatePayrollDto,
  UpdatePayrollStatusDto,
  CreatePayrollPeriodDto,
  UpsertPayrollRateDto,
  CreateOneTimeBonusDto,
  UpsertCNSSRateDto,
} from './dto';

@Controller('hr/payroll')
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
  // LOTS DE PAIE (Payroll batches)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('batches')
  async createPayroll(@GetTenant() tenant: any, @Body() body: CreatePayrollDto) {
    return this.payrollService.createPayroll({
      tenantId: tenant.id,
      academicYearId: body.academicYearId,
      month: body.month,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      schoolLevelId: body.schoolLevelId,
      payrollPeriodId: body.payrollPeriodId,
      notes: body.notes,
    });
  }

  @Get('batches')
  async findAllPayrolls(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.payrollService.findAllPayrolls(tenant.id, academicYearId);
  }

  @Get('batches/:id')
  async findPayrollById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollById(id, tenant.id);
  }

  @Post('batches/:id/generate')
  async generatePayrollItems(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.payrollService.generatePayrollItems(
      payrollId, tenant.id, academicYearId,
    );
  }

  @Post('batches/:id/calculate')
  async calculatePayroll(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.payrollTaxService.calculatePeriod(
      payrollId, tenant.id, academicYearId,
    );
  }

  @Put('batches/:id/status')
  async updatePayrollStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: UpdatePayrollStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.payrollService.updatePayrollStatus(id, tenant.id, body.status, user?.id);
  }

  @Delete('batches/:id')
  async deletePayrollBatch(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.deletePayrollBatch(id, tenant.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LIGNES DE PAIE (PayrollItems)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('items/:id')
  async findPayrollItemById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollItemById(id, tenant.id);
  }

  @Post('items/:id/calculate')
  async calculatePayrollItem(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('countryCode') countryCode: string = 'BJ',
  ) {
    return this.payrollTaxService.calculatePayroll(
      tenant.id, academicYearId, payrollItemId,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX CNSS
  // ──────────────────────────────────────────────────────────────────────────

  @Get('cnss-rates/active')
  async getActiveCNSSRate(
    @Query('countryCode') countryCode: string = 'BJ',
  ) {
    return this.payrollService.findActiveCNSSRate(countryCode);
  }

  @Post('cnss-rates')
  async upsertCNSSRate(@Body() body: UpsertCNSSRateDto) {
    return this.payrollService.upsertCNSSRate({
      countryCode: body.countryCode,
      employeeRate: body.employeeRate,
      employerRate: body.employerRate,
      salaryCeiling: body.salaryCeiling,
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

  @Get('items/:id/tax-withholdings')
  async getTaxWithholdings(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
  ) {
    return this.taxService.getTaxWithholdings(payrollItemId, tenant.id);
  }

  @Get('tax-stats')
  async getTaxStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.taxService.getTaxStats(tenant.id, academicYearId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULLETINS PDF (SalarySlip)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('items/:id/payslip-pdf')
  async generatePaySlipPdf(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
    @CurrentUser() user: any,
  ) {
    const result = await this.payrollPdfService.generatePaySlipPdf(payrollItemId, tenant.id, user.id);
    // Return JSON with base64-encoded PDF for frontend consumption
    return {
      ...result,
      pdfBase64: result.pdfBuffer ? result.pdfBuffer.toString('base64') : null,
      pdfBuffer: undefined, // Don't serialize raw Buffer in JSON
    };
  }

  @Get('items/:id/payslip-pdf')
  async getPaySlipPdf(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
    @Res() res: Response,
  ) {
    // Try to get existing PDF, or generate if not found
    let pdfBuffer = await this.payrollPdfService.getPaySlipPdf(payrollItemId, tenant.id);

    if (!pdfBuffer) {
      // No existing PDF — generate one
      try {
        const result = await this.payrollPdfService.generatePaySlipPdf(payrollItemId, tenant.id, null);
        pdfBuffer = result.pdfBuffer;
      } catch {
        return res.status(404).json({ error: 'PDF introuvable' });
      }
    }

    const staffName = (result => {
      try { return result || 'staff'; } catch { return 'staff'; }
    })(null);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bulletin-paie-${payrollItemId.substring(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', String(pdfBuffer.length));
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

  // ──────────────────────────────────────────────────────────────────────────
  // PÉRIODES DE PAIE (PayrollPeriod)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('periods')
  async createPayrollPeriod(@GetTenant() tenant: any, @Body() body: CreatePayrollPeriodDto) {
    // Auto-generate name if not provided
    const name = body.name || (() => {
      const start = new Date(body.startDate);
      const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    })();
    // Auto-derive month if not provided
    const month = body.month || new Date(body.startDate).toISOString().substring(0, 7);
    return this.payrollService.createPayrollPeriod({
      tenantId: tenant.id,
      academicYearId: body.academicYearId,
      schoolLevelId: body.schoolLevelId,
      name,
      periodType: body.periodType,
      month,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  @Get('periods')
  async findAllPayrollPeriods(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.payrollService.findAllPayrollPeriods(tenant.id, academicYearId);
  }

  @Get('periods/:id')
  async findPayrollPeriodById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollPeriodById(id, tenant.id);
  }

  @Put('periods/:id/close')
  async closePayrollPeriod(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.payrollService.closePayrollPeriod(id, tenant.id, user?.id);
  }

  @Delete('periods/:id')
  async deletePayrollPeriod(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.deletePayrollPeriod(id, tenant.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX SALARIAUX (PayrollRate)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('rates')
  async upsertPayrollRate(@GetTenant() tenant: any, @Body() body: UpsertPayrollRateDto) {
    return this.payrollService.upsertPayrollRate({
      tenantId: tenant.id,
      countryCode: body.countryCode,
      roleType: body.roleType,
      grade: body.grade,
      monthlyBaseSalary: body.monthlyBaseSalary,
      hourlyRate: body.hourlyRate,
      overtimeMultiplier: body.overtimeMultiplier,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    });
  }

  @Get('rates')
  async findAllPayrollRates(
    @GetTenant() tenant: any,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.payrollService.findAllPayrollRates(tenant.id, countryCode);
  }

  @Get('rates/active')
  async getActivePayrollRate(
    @GetTenant() tenant: any,
    @Query('countryCode') countryCode: string = 'BJ',
    @Query('roleType') roleType: string = 'TEACHER',
  ) {
    return this.payrollService.findActivePayrollRate(tenant.id, countryCode, roleType);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIMES PONCTUELLES (OneTimeBonus)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('bonuses')
  async createOneTimeBonus(@GetTenant() tenant: any, @Body() body: CreateOneTimeBonusDto, @CurrentUser() user: any) {
    return this.payrollService.createOneTimeBonus({
      tenantId: tenant.id,
      academicYearId: body.academicYearId,
      schoolLevelId: body.schoolLevelId,
      staffId: body.staffId,
      amount: body.amount,
      reason: body.reason,
      bonusType: body.bonusType,
      authorizedBy: user?.id,
    });
  }

  @Get('bonuses')
  async findAllOneTimeBonuses(
    @GetTenant() tenant: any,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
    @Query('bonusType') bonusType?: string,
  ) {
    return this.payrollService.findAllOneTimeBonuses(tenant.id, { staffId, status, bonusType });
  }

  @Put('bonuses/:id/approve')
  async approveOneTimeBonus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.payrollService.approveOneTimeBonus(id, tenant.id, user?.id);
  }

  @Delete('bonuses/:id')
  async deleteOneTimeBonus(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.deleteOneTimeBonus(id, tenant.id);
  }
}
