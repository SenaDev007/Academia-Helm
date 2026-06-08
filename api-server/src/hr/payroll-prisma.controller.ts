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
  Query, UseGuards, Res, BadRequestException,
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
  async createPayroll(
    @GetTenant() tenant: any,
    @Body() body: CreatePayrollDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.createPayroll({
      tenantId: tid,
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
    return this.payrollService.findAllPayrolls(tenant?.id, academicYearId);
  }

  @Get('batches/:id')
  async findPayrollById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollById(id, tenant?.id);
  }

  @Post('batches/:id/generate')
  async generatePayrollItems(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.generatePayrollItems(
      payrollId, tid, academicYearId,
    );
  }

  @Post('batches/:id/calculate')
  async calculatePayroll(
    @GetTenant() tenant: any,
    @Param('id') payrollId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollTaxService.calculatePeriod(
      payrollId, tid, academicYearId,
    );
  }

  @Put('batches/:id/status')
  async updatePayrollStatus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: UpdatePayrollStatusDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.updatePayrollStatus(id, tid, body.status, user?.id);
  }

  @Delete('batches/:id')
  async deletePayrollBatch(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.deletePayrollBatch(id, tid);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LIGNES DE PAIE (PayrollItems)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('items/:id')
  async findPayrollItemById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollItemById(id, tenant?.id);
  }

  @Post('items/:id/calculate')
  async calculatePayrollItem(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('countryCode') countryCode: string = 'BJ',
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollTaxService.calculatePayroll(
      tid, academicYearId, payrollItemId,
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
    return this.payrollService.getPayrollStatistics(tenant?.id, academicYearId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FISCALITÉ (TaxWithholding / TaxRate)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('items/:id/tax-withholdings')
  async getTaxWithholdings(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
  ) {
    return this.taxService.getTaxWithholdings(payrollItemId, tenant?.id);
  }

  @Get('tax-stats')
  async getTaxStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.taxService.getTaxStats(tenant?.id, academicYearId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULLETINS PDF (SalarySlip)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('items/:id/payslip-pdf')
  async generatePaySlipPdf(
    @GetTenant() tenant: any,
    @Param('id') payrollItemId: string,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    const result = await this.payrollPdfService.generatePaySlipPdf(payrollItemId, tid, user.id);
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
    let pdfBuffer = await this.payrollPdfService.getPaySlipPdf(payrollItemId, tenant?.id);

    if (!pdfBuffer) {
      // No existing PDF — generate one
      try {
        const result = await this.payrollPdfService.generatePaySlipPdf(payrollItemId, tenant?.id, null);
        pdfBuffer = result.pdfBuffer;
      } catch {
        return res.status(404).json({ error: 'PDF introuvable' });
      }
    }

    // Fetch staff name for the download filename
    let staffName = 'staff';
    try {
      const payrollItem = await this.payrollService.findPayrollItemById(payrollItemId, tenant?.id);
      if (payrollItem?.staff) {
        staffName = `${payrollItem.staff.lastName}_${payrollItem.staff.firstName}`.replace(/\s+/g, '_');
      }
    } catch {
      // Keep default 'staff' name
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bulletin-paie-${staffName}-${payrollItemId.substring(0, 8)}.pdf"`,
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
    return this.hrOrionService.getPayrollAndTaxKPIs(tenant?.id, academicYearId);
  }

  @Get('orion/alerts')
  async getPayrollAlerts(@GetTenant() tenant: any) {
    return this.hrOrionService.generateAlerts(tenant?.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PÉRIODES DE PAIE (PayrollPeriod)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('periods')
  async createPayrollPeriod(
    @GetTenant() tenant: any,
    @Body() body: CreatePayrollPeriodDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Auto-generate name if not provided
    const name = body.name || (() => {
      const start = new Date(body.startDate);
      const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    })();
    // Auto-derive month if not provided
    const month = body.month || new Date(body.startDate).toISOString().substring(0, 7);
    return this.payrollService.createPayrollPeriod({
      tenantId: tid,
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
    return this.payrollService.findAllPayrollPeriods(tenant?.id, academicYearId);
  }

  @Get('periods/:id')
  async findPayrollPeriodById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.payrollService.findPayrollPeriodById(id, tenant?.id);
  }

  @Put('periods/:id/close')
  async closePayrollPeriod(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.closePayrollPeriod(id, tid, user?.id);
  }

  @Delete('periods/:id')
  async deletePayrollPeriod(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.deletePayrollPeriod(id, tid);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAUX SALARIAUX (PayrollRate)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('rates')
  async upsertPayrollRate(
    @GetTenant() tenant: any,
    @Body() body: UpsertPayrollRateDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.upsertPayrollRate({
      tenantId: tid,
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
    return this.payrollService.findAllPayrollRates(tenant?.id, countryCode);
  }

  @Get('rates/active')
  async getActivePayrollRate(
    @GetTenant() tenant: any,
    @Query('countryCode') countryCode: string = 'BJ',
    @Query('roleType') roleType: string = 'TEACHER',
  ) {
    return this.payrollService.findActivePayrollRate(tenant?.id, countryCode, roleType);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIMES PONCTUELLES (OneTimeBonus)
  // ──────────────────────────────────────────────────────────────────────────

  @Post('bonuses')
  async createOneTimeBonus(
    @GetTenant() tenant: any,
    @Body() body: CreateOneTimeBonusDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.createOneTimeBonus({
      tenantId: tid,
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
    return this.payrollService.findAllOneTimeBonuses(tenant?.id, { staffId, status, bonusType });
  }

  @Put('bonuses/:id/approve')
  async approveOneTimeBonus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.approveOneTimeBonus(id, tid, user?.id);
  }

  @Delete('bonuses/:id')
  async deleteOneTimeBonus(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.payrollService.deleteOneTimeBonus(id, tid);
  }
}
