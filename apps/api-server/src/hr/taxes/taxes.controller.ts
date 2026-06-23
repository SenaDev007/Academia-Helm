/**
 * ============================================================================
 * TAXES CONTROLLER — Module Impôts et États financiers
 * ============================================================================
 *
 * Endpoints pour les 4 sous-onglets :
 *   1. Tableau de bord (KPIs)
 *   2. Gestion du personnel (annuaire fiscal, fiches de paie)
 *   3. États financiers (Bilan, CR, TFT, notes)
 *   4. Déclarations fiscales (IST, AIB, CNSS)
 *
 * + Paramètres fiscaux configurables (taux)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, BadRequestException, Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { PrismaService } from '../../database/prisma.service';
import { TaxSettingsService, TaxSettingsData } from './services/tax-settings.service';
import { FinancialStatementService } from './services/financial-statement.service';
import { TaxDeclarationService } from './services/tax-declaration.service';
import { FinancialNoteService } from './services/financial-note.service';
import { PayrollService } from './services/payroll.service';
import { TaxPdfService } from './services/tax-pdf.service';
import { TaxExcelService } from './services/tax-excel.service';

@Controller('hr/taxes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TaxesController {
  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
    private financialStatementService: FinancialStatementService,
    private taxDeclarationService: TaxDeclarationService,
    private financialNoteService: FinancialNoteService,
    private payrollService: PayrollService,
    private taxPdfService: TaxPdfService,
    private taxExcelService: TaxExcelService,
  ) {}

  // ─── Paramètres fiscaux ──────────────────────────────────────────────────

  @Get('settings')
  async getSettings(@GetTenant() t: any) {
    return this.taxSettingsService.getOrCreate(t?.id);
  }

  @Put('settings')
  async updateSettings(@GetTenant() t: any, @Body() body: Partial<TaxSettingsData>) {
    return this.taxSettingsService.update(t?.id, body);
  }

  // ─── Tableau de bord ─────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    const tid = t?.id;
    if (!tid || !academicYearId) throw new BadRequestException('academicYearId requis');

    const [summary, declarations] = await Promise.all([
      this.financialStatementService.getSummary(tid, academicYearId),
      this.taxDeclarationService.listByType(tid, academicYearId),
    ]);

    // Calculer le total des charges fiscales
    const totalTax = declarations
      .filter(d => d.status === 'PAID' || d.status === 'SUBMITTED')
      .reduce((sum, d) => sum + Number(d.totalAmount), 0);

    return {
      ...summary,
      totalTax,
      declarationsCount: declarations.length,
      pendingDeclarations: declarations.filter(d => d.status === 'DRAFT').length,
    };
  }

  // ─── États financiers ────────────────────────────────────────────────────

  @Get('financial-statements')
  async getFinancialStatements(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type: string,
  ) {
    if (!t?.id || !academicYearId || !type) {
      throw new BadRequestException('academicYearId et type requis');
    }
    return this.financialStatementService.getOrCreate(t.id, academicYearId, type);
  }

  @Put('financial-statements/:id')
  async updateFinancialStatementLine(
    @Param('id') id: string,
    @Body() body: { amountN?: number; amountN1?: number },
  ) {
    return this.financialStatementService.updateLine(id, body.amountN, body.amountN1);
  }

  @Put('financial-statements/batch')
  async batchUpdateFinancialStatements(
    @Body() body: { updates: Array<{ id: string; amountN?: number; amountN1?: number }> },
  ) {
    return this.financialStatementService.updateLines(body.updates);
  }

  // ─── Déclarations fiscales ───────────────────────────────────────────────

  @Get('declarations')
  async listDeclarations(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type?: string,
  ) {
    if (!t?.id || !academicYearId) throw new BadRequestException('academicYearId requis');
    return this.taxDeclarationService.listByType(t.id, academicYearId, type);
  }

  @Get('declarations/:id')
  async getDeclaration(@Param('id') id: string) {
    return this.taxDeclarationService.getById(id);
  }

  @Post('declarations/ist/generate')
  async generateIST(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string },
  ) {
    return this.taxDeclarationService.getOrGenerateIST(t.id, body.academicYearId, body.period);
  }

  @Post('declarations/cnss/generate')
  async generateCNSS(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string },
  ) {
    return this.taxDeclarationService.getOrGenerateCNSS(t.id, body.academicYearId, body.period);
  }

  @Post('declarations/aib/generate')
  async generateAIB(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string; baseAchats?: number; basePrestations?: number },
  ) {
    return this.taxDeclarationService.getOrGenerateAIB(
      t.id, body.academicYearId, body.period,
      body.baseAchats || 0, body.basePrestations || 0,
    );
  }

  @Put('declarations/:id/status')
  async updateDeclarationStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.taxDeclarationService.updateStatus(id, body.status, body.notes);
  }

  // ─── Gestion du personnel (annuaire fiscal) ──────────────────────────────

  @Get('staff-fiscal')
  async getStaffFiscal(@GetTenant() t: any, @Query('tenantId') tidFallback?: string) {
    const tenantId = t?.id ?? tidFallback;
    if (!tenantId) throw new BadRequestException('Tenant ID requis');

    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        email: true,
        phone: true,
        salary: true,
        cnssNumber: true,
        ifuNumber: true,
        contractType: true,
        roleType: true,
        employeeNumber: true,
        tenantMatricule: true,
        hireDate: true,
        // Champs supplémentaires du fichier Excel
        qualifications: true,    // Diplôme
        gender: true,
        maritalStatus: true,     // Situation matrimoniale
        numberOfChildren: true,  // Nbre d'enfants
        notes: true,             // Observation
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return staff.map(s => ({
      ...s,
      salary: Number(s.salary || 0),
      staffType: s.contractType === 'VACATAIRE' ? 'VACATAIRE' : 'PERMANENT',
      displayName: `${s.firstName} ${s.lastName}`,
      diploma: s.qualifications || '',     // Alias pour Diplôme
      grade: s.position || '',             // Alias pour Grade/Expériences
      observation: s.notes || '',          // Alias pour Observation
    }));
  }

  // ─── Fiches de renseignements (Phase A) ──────────────────────────────────

  @Get('report-header')
  async getReportHeader(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!t?.id || !academicYearId) throw new BadRequestException('academicYearId requis');
    return this.payrollService.getReportHeader(t.id, academicYearId);
  }

  @Put('report-header')
  async updateReportHeader(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; data: any },
  ) {
    if (!t?.id || !body.academicYearId) throw new BadRequestException('academicYearId requis');
    return this.payrollService.updateReportHeader(t.id, body.academicYearId, body.data);
  }

  // ─── Notes annexes SYSCOHADA (Phase B) ───────────────────────────────────

  @Get('financial-notes')
  async getFinancialNotes(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!t?.id || !academicYearId) throw new BadRequestException('academicYearId requis');
    return this.financialNoteService.getOrCreateAll(t.id, academicYearId);
  }

  @Get('financial-notes/titles')
  async getNoteTitles() {
    return this.financialNoteService.getNoteTitles();
  }

  @Put('financial-notes/:id')
  async updateNoteLine(
    @Param('id') id: string,
    @Body() body: { amountN?: number; amountN1?: number },
  ) {
    return this.financialNoteService.updateLine(id, body.amountN, body.amountN1);
  }

  // ─── États de paiement + Fiches de paie (Phase C) ────────────────────────

  @Post('payroll/generate')
  async generatePayroll(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string; staffType: string },
  ) {
    if (!t?.id || !body.academicYearId || !body.period || !body.staffType) {
      throw new BadRequestException('academicYearId, period et staffType requis');
    }
    return this.payrollService.generatePayslips(t.id, body.academicYearId, body.period, body.staffType);
  }

  @Get('payroll/payslips')
  async getPayslips(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('period') period: string,
  ) {
    if (!t?.id || !academicYearId || !period) throw new BadRequestException('academicYearId et period requis');
    return this.payrollService.getPayslips(t.id, academicYearId, period);
  }

  @Put('payslips/:id')
  async updatePayslip(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.payrollService.updatePayslip(id, body);
  }

  // ─── Génération PDF officiels (Phase D) ──────────────────────────────────

  @Get('declarations/:id/pdf')
  async generateDeclarationPdf(
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const decl = await this.taxDeclarationService.getById(id);
    let pdf: Buffer;
    if (decl.type === 'IST') pdf = await this.taxPdfService.generateIstPdf(id);
    else if (decl.type === 'CNSS') pdf = await this.taxPdfService.generateCnssPdf(id);
    else if (decl.type === 'AIB') pdf = await this.taxPdfService.generateAibPdf(id);
    else throw new BadRequestException('Type de déclaration non supporté');

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${decl.type}_${decl.period}.pdf"`, 'Content-Length': pdf.length });
    return res.send(pdf);
  }

  @Get('payslips/:id/pdf')
  async generatePayslipPdf(
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const pdf = await this.taxPdfService.generatePayslipPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="fiche_paie.pdf"`, 'Content-Length': pdf.length });
    return res.send(pdf);
  }

  @Get('financial-statements-pdf')
  async generateFinancialStatementPdf(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type: string,
    @Res() res: any,
  ) {
    if (!t?.id || !academicYearId || !type) throw new BadRequestException('academicYearId et type requis');
    const pdf = await this.taxPdfService.generateFinancialStatementPdf(t.id, academicYearId, type);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${type}.pdf"`, 'Content-Length': pdf.length });
    return res.send(pdf);
  }

  // ─── Export Excel (Phase E) ──────────────────────────────────────────────

  @Get('export/financial-statements')
  async exportFinancialStatements(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type: string,
    @Res() res: any,
  ) {
    if (!t?.id || !academicYearId || !type) throw new BadRequestException('academicYearId et type requis');
    const buffer = await this.taxExcelService.exportFinancialStatement(t.id, academicYearId, type);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${type}.xlsx"`, 'Content-Length': buffer.length });
    return res.send(buffer);
  }

  @Get('export/payslips')
  async exportPayslips(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('period') period: string,
    @Res() res: any,
  ) {
    if (!t?.id || !academicYearId || !period) throw new BadRequestException('academicYearId et period requis');
    const buffer = await this.taxExcelService.exportPayslips(t.id, academicYearId, period);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="paie_${period}.xlsx"`, 'Content-Length': buffer.length });
    return res.send(buffer);
  }

  @Get('export/financial-notes')
  async exportFinancialNotes(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Res() res: any,
  ) {
    if (!t?.id || !academicYearId) throw new BadRequestException('academicYearId requis');
    const buffer = await this.taxExcelService.exportFinancialNotes(t.id, academicYearId);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="notes_annexes.xlsx"`, 'Content-Length': buffer.length });
    return res.send(buffer);
  }

  @Get('export/staff-fiscal')
  async exportStaffFiscal(
    @GetTenant() t: any,
    @Res() res: any,
  ) {
    if (!t?.id) throw new BadRequestException('Tenant ID requis');
    const buffer = await this.taxExcelService.exportStaffFiscal(t.id);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="personnel_fiscal.xlsx"`, 'Content-Length': buffer.length });
    return res.send(buffer);
  }
}
