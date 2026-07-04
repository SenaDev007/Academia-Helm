/**
 * SOUS-MODULE 7 — Rapports financiers — API
 *
 * Endpoints disponibles :
 *   GET /finance/reports/kpi
 *   GET /finance/reports/monthly-encaissements
 *   GET /finance/reports/class-encaissements
 *   GET /finance/reports/expense-by-category
 *   GET /finance/reports/comparative-year      ← NOUVEAU
 *   GET /finance/reports/top-10-impayes        ← NOUVEAU
 *   GET /finance/reports/projection-tresorerie ← NOUVEAU
 *   GET /finance/reports/cash-register-comparative ← NOUVEAU
 *   POST /finance/reports/export-log
 */
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { FinanceReportsService } from './finance-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('finance/reports')
@UseGuards(JwtAuthGuard)
export class FinanceReportsController {
  constructor(private readonly service: FinanceReportsService) {}

  @Get('kpi')
  async getKpi(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return {};
    return this.service.getKpi(tenantId, academicYearId);
  }

  @Get('monthly-encaissements')
  async getMonthlyEncaissements(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getMonthlyEncaissements(tenantId, academicYearId);
  }

  @Get('class-encaissements')
  async getClassEncaissements(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getClassEncaissements(tenantId, academicYearId);
  }

  @Get('expense-by-category')
  async getExpenseByCategory(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getExpenseByCategory(tenantId, academicYearId);
  }

  /**
   * GET /finance/reports/comparative-year?academicYearId=...
   * Comparatif année N vs N-1.
   */
  @Get('comparative-year')
  async getComparativeYear(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return { current: null, previous: null, deltas: null };
    return this.service.getComparativeYear(tenantId, academicYearId);
  }

  /**
   * GET /finance/reports/top-10-impayes?academicYearId=...
   * Top 10 élèves avec le plus gros solde impayé.
   */
  @Get('top-10-impayes')
  async getTop10Impayes(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getTop10Impayes(tenantId, academicYearId);
  }

  /**
   * GET /finance/reports/projection-tresorerie?academicYearId=...
   * Projection de trésorerie fin trimestre/année.
   */
  @Get('projection-tresorerie')
  async getProjectionTresorerie(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return null;
    return this.service.getProjectionTresorerie(tenantId, academicYearId);
  }

  /**
   * GET /finance/reports/cash-register-comparative?academicYearId=...
   * Comparatif par caisse (multi-caisses).
   */
  @Get('cash-register-comparative')
  async getCashRegisterComparative(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getCashRegisterComparative(tenantId, academicYearId);
  }

  @Post('export-log')
  async logExport(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; reportType: string },
  ) {
    return this.service.logExport(tenantId, body.academicYearId, body.reportType, user?.id);
  }
}
