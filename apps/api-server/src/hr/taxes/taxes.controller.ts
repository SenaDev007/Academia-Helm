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
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { PrismaService } from '../../database/prisma.service';
import { TaxSettingsService, TaxSettingsData } from './services/tax-settings.service';
import { FinancialStatementService } from './services/financial-statement.service';
import { TaxDeclarationService } from './services/tax-declaration.service';

@Controller('hr/taxes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TaxesController {
  constructor(
    private prisma: PrismaService,
    private taxSettingsService: TaxSettingsService,
    private financialStatementService: FinancialStatementService,
    private taxDeclarationService: TaxDeclarationService,
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
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return staff.map(s => ({
      ...s,
      salary: Number(s.salary || 0),
      staffType: s.contractType === 'VACATAIRE' ? 'VACATAIRE' : 'PERMANENT',
      displayName: `${s.firstName} ${s.lastName}`,
    }));
  }
}
