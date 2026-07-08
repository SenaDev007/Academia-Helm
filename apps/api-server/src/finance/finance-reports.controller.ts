/**
 * SOUS-MODULE 7 — Rapports financiers — API
 *
 * Endpoints disponibles :
 *   GET /finance/reports/kpi
 *   GET /finance/reports/monthly-encaissements
 *   GET /finance/reports/class-encaissements
 *   GET /finance/reports/expense-by-category
 *   GET /finance/reports/comparative-year
 *   GET /finance/reports/top-10-impayes
 *   GET /finance/reports/projection-tresorerie
 *   GET /finance/reports/cash-register-comparative
 *   GET /finance/reports/bilan-periodique              ← NOUVEAU (filtres date/classe/caisse)
 *   GET /finance/reports/journal-caisse                ← NOUVEAU (filtres date/caisse)
 *   GET /finance/reports/suspicious-transactions       ← NOUVEAU (audit)
 *   GET /finance/reports/cash-mismatches               ← NOUVEAU (audit)
 *   GET /finance/reports/missed-closures               ← NOUVEAU (audit)
 *   GET /finance/reports/top-accountants               ← NOUVEAU (audit)
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

  /**
   * GET /finance/reports/bilan-periodique?academicYearId=...&dateFrom=...&dateTo=...&classId=...&cashRegisterId=...
   * Bilan périodique avec filtres dynamiques.
   */
  @Get('bilan-periodique')
  async getBilanPeriodique(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('classId') classId?: string,
    @Query('cashRegisterId') cashRegisterId?: string,
  ) {
    if (!academicYearId) {
      return { periode: { dateFrom: null, dateTo: null }, kpi: { totalEncaissement: 0, totalDepenses: 0, soldeNet: 0, transactionCount: 0 }, parClasse: [], parCategorie: [] };
    }
    return this.service.getBilanPeriodique(tenantId, academicYearId, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      classId: classId || undefined,
      cashRegisterId: cashRegisterId || undefined,
    });
  }

  /**
   * GET /finance/reports/journal-caisse?academicYearId=...&dateFrom=...&dateTo=...&cashRegisterId=...&type=...
   * Journal de caisse avec filtres dynamiques.
   */
  @Get('journal-caisse')
  async getJournalCaisse(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('cashRegisterId') cashRegisterId?: string,
    @Query('type') type?: string,
  ) {
    if (!academicYearId) {
      return { rows: [], totals: { totalIn: 0, totalOut: 0, netBalance: 0, count: 0 } };
    }
    return this.service.getJournalCaisse(tenantId, academicYearId, {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      cashRegisterId: cashRegisterId || undefined,
      type: type || undefined,
    });
  }

  /**
   * GET /finance/reports/suspicious-transactions?academicYearId=...&days=30&minAmount=100000
   * Transactions suspectes (annulations, transactions nocturnes, montants élevés).
   */
  @Get('suspicious-transactions')
  async getSuspiciousTransactions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('days') days?: string,
    @Query('minAmount') minAmount?: string,
  ) {
    if (!academicYearId) {
      return { reversals: [], nocturnal: [], highValue: [], stats: { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 } };
    }
    return this.service.getSuspiciousTransactions(tenantId, academicYearId, {
      days: days ? parseInt(days, 10) : 30,
      minAmount: minAmount ? parseInt(minAmount, 10) : 100000,
    });
  }

  /**
   * GET /finance/reports/cash-mismatches?academicYearId=...
   * Écarts caisse — solde théorique vs solde déclaré.
   */
  @Get('cash-mismatches')
  async getCashMismatches(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getCashMismatches(tenantId, academicYearId);
  }

  /**
   * GET /finance/reports/missed-closures?academicYearId=...&days=30
   * Clôtures manquées sur la période.
   */
  @Get('missed-closures')
  async getMissedClosures(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('days') days?: string,
  ) {
    if (!academicYearId) return { missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } };
    return this.service.getMissedClosures(tenantId, academicYearId, days ? parseInt(days, 10) : 30);
  }

  /**
   * GET /finance/reports/top-accountants?academicYearId=...&days=30
   * Top 10 comptables les plus actifs.
   */
  @Get('top-accountants')
  async getTopAccountants(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('days') days?: string,
  ) {
    if (!academicYearId) return [];
    return this.service.getTopAccountants(tenantId, academicYearId, days ? parseInt(days, 10) : 30);
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
