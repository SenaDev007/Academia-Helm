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
import { PayrollService, fiscalStaffType } from './services/payroll.service';
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

    // ⭐ 156 — STATISTIQUES RÉELLES : l'ancien tableau de bord ne lisait que
    //    les états financiers SYSCOHADA (saisie MANUELLE — 0 tant que le
    //    bilan n'est pas rempli) et les seules déclarations PAID/SUBMITTED
    //    (0 quand tout était en brouillon) : les 4 statistiques paraissaient
    //    « ne pas fonctionner ». Désormais : masse salariale, cotisations
    //    CNSS, effectif (permanents = déclarés CNSS / vacataires =
    //    prestataires & non déclarés) et charges fiscales TOUTES déclarations.
    const [summary, declarations, payrollAgg, staffRows] = await Promise.all([
      this.financialStatementService.getSummary(tid, academicYearId),
      this.taxDeclarationService.listByType(tid, academicYearId),
      this.prisma.payrollItem.aggregate({
        where: { tenantId: tid, academicYearId },
        _sum: {
          grossSalary: true,
          cnssEmployee: true,
          cnssEmployer: true,
          netSalary: true,
        },
        _count: { _all: true },
      }),
      this.prisma.staff.findMany({
        where: { tenantId: tid, status: { not: 'ARCHIVED' } },
        select: {
          statutContractuel: true,
          cnssNumber: true,
          employeeCNSS: { select: { cnssNumber: true, isActive: true } },
        },
      }),
    ]);

    let permanents = 0;
    let vacataires = 0;
    for (const s of staffRows) {
      if (fiscalStaffType(s as any) === 'PERMANENT') permanents++;
      else vacataires++;
    }

    let masseSalariale = Number(payrollAgg._sum?.grossSalary ?? 0);
    let cnssOuvriere = Number(payrollAgg._sum?.cnssEmployee ?? 0);
    let cnssPatronale = Number(payrollAgg._sum?.cnssEmployer ?? 0);
    let netVerse = Number(payrollAgg._sum?.netSalary ?? 0);
    if (!masseSalariale && !cnssOuvriere && !cnssPatronale) {
      // Repli : fiches fiscales générées sans le module Paie (tax_payslips)
      const slipAgg = await this.prisma.taxPayslip.aggregate({
        where: { tenantId: tid, academicYearId },
        _sum: {
          salaireBrut: true,
          cnssOuvriere: true,
          cnssPatronale: true,
          netAPayer: true,
        },
      });
      masseSalariale = Number(slipAgg._sum?.salaireBrut ?? 0);
      cnssOuvriere = Number(slipAgg._sum?.cnssOuvriere ?? 0);
      cnssPatronale = Number(slipAgg._sum?.cnssPatronale ?? 0);
      netVerse = Number(slipAgg._sum?.netAPayer ?? 0);
    }

    // Charges fiscales : TOUTES les déclarations (brouillon + déposées +
    // payées) — l'ancien filtre PAID/SUBMITTED renvoyait 0 en brouillon.
    const totalTax = declarations
      .filter(d => ['DRAFT', 'SUBMITTED', 'PAID'].includes(d.status))
      .reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);

    return {
      ...summary,
      totalTax,
      declarationsCount: declarations.length,
      pendingDeclarations: declarations.filter(d => d.status === 'DRAFT').length,
      // ⭐ 156 — statistiques réelles (paie + effectif + déclarations)
      masseSalariale,
      netVerse,
      cotisationsCnss: {
        ouvriere: cnssOuvriere,
        patronale: cnssPatronale,
        total: cnssOuvriere + cnssPatronale,
      },
      effectif: { permanents, vacataires, total: staffRows.length },
      lignesDePaie: Number(payrollAgg._count ?? 0),
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
    @Query('academicYearId') academicYearId?: string,
    @Query('type') type?: string,
  ) {
    if (!t?.id) throw new BadRequestException('Tenant ID requis');
    // If academicYearId not provided, try to resolve active year
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { isActive: true, tenantId: t.id },
        select: { id: true },
      });
      if (!activeYear) {
        // Return empty array if no active year
        return [];
      }
      academicYearId = activeYear.id;
    }
    return this.taxDeclarationService.listByType(t.id, academicYearId, type);
  }

  @Get('declarations/:id')
  async getDeclaration(@Param('id') id: string) {
    return this.taxDeclarationService.getById(id);
  }

  /**
   * ⭐ 125 — Synchronisation AUTOMATIQUE des déclarations + fiches fiscales :
   * alimente IST/IRPP/VPS, AIB, CNSS trimestrielle et tax_payslips depuis la
   * paie générée. Appelée par le front à l'ouverture de l'onglet CNSS et par
   * le module Paie après chaque génération/calcul — plus besoin de cliquer
   * « Générer » dans chaque sous-onglet.
   */
  @Post('declarations/sync-all')
  async syncAllDeclarations(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; tenantId?: string; period?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = t?.id ?? tenantIdFallback ?? body.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!body.academicYearId) throw new BadRequestException('academicYearId requis');

    if (body.period && /^\d{4}-\d{2}$/.test(body.period)) {
      // Synchronisation ciblée sur un mois unique
      return this.taxDeclarationService.syncAllForTenant(tid, body.academicYearId);
    }
    return this.taxDeclarationService.syncAllForTenant(tid, body.academicYearId);
  }

  @Post('declarations/ist/generate')
  async generateIST(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string; tenantId?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = t?.id ?? tenantIdFallback ?? body.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.taxDeclarationService.getOrGenerateIST(tid, body.academicYearId, body.period);
  }

  @Post('declarations/cnss/generate')
  async generateCNSS(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string; tenantId?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = t?.id ?? tenantIdFallback ?? body.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.taxDeclarationService.getOrGenerateCNSS(tid, body.academicYearId, body.period);
  }

  @Post('declarations/aib/generate')
  async generateAIB(
    @GetTenant() t: any,
    @Body() body: { academicYearId: string; period: string; baseAchats?: number; basePrestations?: number; tenantId?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = t?.id ?? tenantIdFallback ?? body.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.taxDeclarationService.getOrGenerateAIB(
      tid, body.academicYearId, body.period,
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
        statutContractuel: true,
        employeeCNSS: { select: { cnssNumber: true, isActive: true } },
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
      // ⭐ 156 — règle fiscale : PERMANENT = déclaré à la CNSS (SALARIE_DECLARE
      //    ou n° CNSS actif) ; VACATAIRE = prestataire / non déclaré. L'ancien
      //    contractType ne matchait aucun dossier → les filtres ne filtraient
      //    rien et la colonne vacataire restait vide.
      staffType: fiscalStaffType(s as any),
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
    @Body() body: { academicYearId: string; period: string; staffType: string; tenantId?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = t?.id ?? tenantIdFallback ?? body.tenantId;
    if (!tid || !body.academicYearId || !body.period || !body.staffType) {
      throw new BadRequestException('academicYearId, period et staffType requis');
    }
    return this.payrollService.generatePayslips(tid, body.academicYearId, body.period, body.staffType);
  }

  @Get('payroll/payslips')
  async getPayslips(
    @GetTenant() t: any,
    @Query('academicYearId') academicYearId: string,
    @Query('period') period?: string,
    @Query('staffType') staffType?: string,
  ) {
    if (!t?.id || !academicYearId) throw new BadRequestException('academicYearId requis');
    return this.payrollService.getPayslips(t.id, academicYearId, period || '', staffType || '');
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
    // ⭐ 161 — le module Paie produit le document CONFORME AU MODÈLE : fiche
    // de paie FP pour les salariés, ÉTAT DE PAIEMENT EP pour les vacataires
    // (prestataires) — le nom du fichier suit la nature du document.
    const result = await this.taxPdfService.generatePayslipPdf(id);
    const asciiName = result.documentType === 'ETAT_DE_PAIEMENT' ? 'etat_paiement.pdf' : 'fiche_paie.pdf';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(`${result.fileName}.pdf`)}`,
      'Content-Length': result.buffer.length,
    });
    return res.send(result.buffer);
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
