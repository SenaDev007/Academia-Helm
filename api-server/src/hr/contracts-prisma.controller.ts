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
  BadRequestException,
} from '@nestjs/common';
import { ContractsPrismaService } from './contracts-prisma.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import type { Response, Request } from 'express';
import { CreateContractDto, UpdateContractDto, CreateAmendmentDto, SignContractDto, CreateContractTemplateDto, UpdateContractTemplateDto, TerminateContractDto } from './dto';

@Controller('hr/contracts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractsPrismaController {
  constructor(
    private readonly contractsService: ContractsPrismaService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  // ─── Contracts CRUD ─────────────────────────────────────────────────────────

  @Post()
  async createContract(
    @GetTenant() tenant: any,
    @Body() data: CreateContractDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractsService.createContract({
      ...data,
      tenantId: tid,
    });
  }

  @Get()
  async findAllContracts(
    @GetTenant() tenant: any,
    @Query('staffId') staffId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contractsService.findAllContracts(tenant?.id, { staffId, type, status });
  }

  // ─── Staff active contract (MUST be before @Get(':id')) ────────────────────

  @Get('staff/:staffId/active')
  async findActiveContract(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.contractsService.findActiveContract(staffId, tenant?.id);
  }

  // ─── Contract Templates (MUST be before @Get(':id')) ───────────────────────

  @Get('templates/list')
  async listTemplates(@GetTenant() tenant: any) {
    return this.contractPdfService.listTemplates(tenant?.id);
  }

  @Get('templates/default/:type')
  async getDefaultTemplate(@Param('type') type: string) {
    return { template: JSON.stringify(this.contractPdfService.getDefaultArticles(type)) };
  }

  @Post('templates')
  async createTemplate(
    @GetTenant() tenant: any,
    @Body() data: CreateContractTemplateDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractPdfService.createTemplate(tid, data);
  }

  @Put('templates/:id')
  async updateTemplate(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateContractTemplateDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractPdfService.updateTemplate(id, tid, data);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    await this.contractPdfService.deleteTemplate(id, tid);
  }

  // ─── Parameterized contract routes (AFTER all static routes) ───────────────

  @Get(':id')
  async findContractById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.contractsService.findContractById(id, tenant?.id);
  }

  @Put(':id')
  async updateContract(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateContractDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractsService.updateContract(id, tid, data);
  }

  /**
   * PUT /hr/contracts/:id/terminate
   * Résilie un contrat de manière professionnelle.
   * Si c'est le dernier contrat actif du staff, son statut est également mis à jour.
   */
  @Put(':id/terminate')
  async terminateContract(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data?: TerminateContractDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractsService.terminateContract(
      id,
      tid,
      data?.reason,
      {
        terminatedAt: data?.terminatedAt ? new Date(data.terminatedAt) : undefined,
        terminationType: data?.terminationType,
        updateStaffStatus: data?.updateStaffStatus,
      },
    );
  }

  @Delete(':id')
  async deleteContract(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractsService.deleteContract(id, tid);
  }

  @Post(':id/amendments')
  async createAmendment(
    @GetTenant() tenant: any,
    @Param('id') contractId: string,
    @Body() data: CreateAmendmentDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractsService.createAmendment({
      ...data,
      tenantId: tid,
      contractId,
    });
  }

  // ─── PDF Generation ──────────────────────────────────────────────────────────

  /**
   * POST /api/hr/contracts/:id/generate-pdf
   * Génère (ou régénère) le PDF du contrat. Retourne { pdfUrl }.
   */
  @Post(':id/generate-pdf')
  async generatePdf(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    const { pdfUrl } = await this.contractPdfService.generateContractPdf(id, tid);
    return { pdfUrl, message: 'PDF généré avec succès.' };
  }

  /**
   * GET /api/hr/contracts/:id/pdf
   * Télécharge le PDF du contrat (sert le PDF existant ou le génère si non existant).
   */
  @Get(':id/pdf')
  async downloadPdf(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Try to serve existing PDF first (no re-generation)
    let result = await this.contractPdfService.getExistingContractPdf(id, tenant?.id);

    // If no PDF exists yet, generate one
    if (!result) {
      const generated = await this.contractPdfService.generateContractPdf(id, tenant?.id);
      result = { pdfBuffer: generated.pdfBuffer, contract: generated.contract };
    }

    const { pdfBuffer, contract } = result;
    const staffName = `${contract.staff?.lastName}_${contract.staff?.firstName}`.replace(/\s+/g, '_');
    const filename = `Contrat_${staffName}_${contract.contractType}_${id.substring(0, 8)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  /**
   * PUT /api/hr/contracts/:id/articles
   * Sauvegarde le contenu personnalisé des articles d'un contrat non signé.
   * Permet l'édition complète du document avant signature.
   */
  @Put(':id/articles')
  async saveContractArticles(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { articles: Array<{ title: string; content: string }> },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractPdfService.saveContractArticles(id, tid, body.articles);
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
    @Body() body: SignContractDto,
    @Req() req: Request,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.contractPdfService.signContract(id, tid, {
      ...body,
      ipAddress: req.ip || req.socket?.remoteAddress,
    });
  }
}
