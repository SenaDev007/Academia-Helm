/**
 * ============================================================================
 * CONTRACTS PRISMA CONTROLLER - MODULE 5 (UPDATED)
 * ============================================================================
 * Gère les contrats de travail : CRUD, génération PDF, signature électronique,
 * et gestion des modèles (templates) de contrats.
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Res, StreamableFile, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ContractsPrismaService } from './contracts-prisma.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import type { Response, Request } from 'express';

@Controller('api/hr/contracts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractsPrismaController {
  constructor(
    private readonly contractsService: ContractsPrismaService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  // ─── Contracts CRUD ─────────────────────────────────────────────────────────

  @Post()
  async createContract(@GetTenant() tenant: any, @Body() data: any) {
    return this.contractsService.createContract({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllContracts(
    @GetTenant() tenant: any,
    @Query('staffId') staffId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contractsService.findAllContracts(tenant.id, { staffId, type, status });
  }

  @Get('staff/:staffId/active')
  async findActiveContract(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.contractsService.findActiveContract(staffId, tenant.id);
  }

  @Get(':id')
  async findContractById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.contractsService.findContractById(id, tenant.id);
  }

  @Put(':id')
  async updateContract(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.contractsService.updateContract(id, tenant.id, data);
  }

  @Put(':id/terminate')
  async terminateContract(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.contractsService.terminateContract(id, tenant.id);
  }

  @Post(':id/amendments')
  async createAmendment(
    @GetTenant() tenant: any,
    @Param('id') contractId: string,
    @Body() data: any,
  ) {
    return this.contractsService.createAmendment({
      ...data,
      tenantId: tenant.id,
      contractId,
    });
  }

  // ─── PDF Generation ──────────────────────────────────────────────────────────

  /**
   * POST /api/hr/contracts/:id/generate-pdf
   * Génère (ou régénère) le PDF du contrat. Retourne { pdfUrl }.
   */
  @Post(':id/generate-pdf')
  async generatePdf(@GetTenant() tenant: any, @Param('id') id: string) {
    const { pdfUrl } = await this.contractPdfService.generateContractPdf(id, tenant.id);
    return { pdfUrl, message: 'PDF généré avec succès.' };
  }

  /**
   * GET /api/hr/contracts/:id/pdf
   * Télécharge le PDF du contrat (génère si non existant).
   */
  @Get(':id/pdf')
  async downloadPdf(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdfBuffer, contract } = await this.contractPdfService.generateContractPdf(id, tenant.id);
    const staffName = `${contract.staff?.lastName}_${contract.staff?.firstName}`.replace(/\s+/g, '_');
    const filename = `Contrat_${staffName}_${contract.contractType}_${id.substring(0, 8)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  // ─── Electronic Signature ─────────────────────────────────────────────────

  /**
   * POST /api/hr/contracts/:id/sign
   * Enregistre la signature électronique de l'employé.
   * Body: { signatureData: string (base64), signerName: string, signerRole?: string }
   */
  @Post(':id/sign')
  async signContract(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { signatureData: string; signerName: string; signerRole?: string },
    @Req() req: Request,
  ) {
    return this.contractPdfService.signContract(id, tenant.id, {
      ...body,
      ipAddress: req.ip || req.socket?.remoteAddress,
    });
  }

  // ─── Contract Templates ──────────────────────────────────────────────────

  @Get('templates/list')
  async listTemplates(@GetTenant() tenant: any) {
    return this.contractPdfService.listTemplates(tenant.id);
  }

  @Post('templates')
  async createTemplate(@GetTenant() tenant: any, @Body() data: any) {
    return this.contractPdfService.createTemplate(tenant.id, data);
  }

  @Put('templates/:id')
  async updateTemplate(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.contractPdfService.updateTemplate(id, tenant.id, data);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@GetTenant() tenant: any, @Param('id') id: string) {
    await this.contractPdfService.deleteTemplate(id, tenant.id);
  }

  /**
   * GET /api/hr/contracts/templates/default/:type
   * Retourne le template HTML par défaut pour un type de contrat.
   */
  @Get('templates/default/:type')
  async getDefaultTemplate(@Param('type') type: string) {
    return { template: this.contractPdfService.getDefaultTemplate(type) };
  }
}
