/**
 * ============================================================================
 * STAFF PRISMA CONTROLLER - MODULE 5 (v3 — Photo + Documents + Matricules)
 * ============================================================================
 *
 * Endpoints:
 *   POST   /hr/staff                    — Create staff (with dual matricule auto-gen)
 *   GET    /hr/staff                    — List all staff (with photo)
 *   GET    /hr/staff/:id               — Get staff detail (with photo + documents grouped)
 *   PUT    /hr/staff/:id               — Update staff info
 *   DELETE /hr/staff/:id               — Archive staff
 *
 *   POST   /hr/staff/:id/upload-photo     — Upload photo (data URL base64)
 *   GET    /hr/staff/:id/photo            — Get staff photo
 *   DELETE /hr/staff/:id/photo            — Delete staff photo
 *
 *   POST   /hr/staff/:id/upload-document  — Upload document (data URL base64, images + PDF)
 *   POST   /hr/staff/:id/documents/json— Add document metadata (legacy JSON body)
 *   GET    /hr/staff/:id/documents     — Get all documents (grouped by category)
 *   DELETE /hr/staff/:id/documents/:docId — Delete a document
 *   PUT    /hr/staff/:id/documents/:docId/validate — Validate/reject a document
 *
 *   POST   /hr/staff/:id/generate-matricules — Generate missing matricules
 *
 *   POST   /hr/staff/:id/generate-credentials — Génère identifiants + email (bouton "Générer Identifiant")
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards,
  BadRequestException, Res, Req,
} from '@nestjs/common';
import { StaffPrismaService } from './staff-prisma.service';
import { TerminationPdfService } from './services/termination-pdf.service';
import { IMAGE_ONLY_DATA_URL_PIPE, IMAGE_OR_PDF_DATA_URL_PIPE } from '../common/pipes/data-url-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import {
  CreateStaffDto, UpdateStaffDto, AddStaffDocumentDto,
  ValidateDocumentDto, BatchAssignLevelDto,
} from './dto/index';
import type { Response, Request } from 'express';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  constructor(
    private readonly staffService: StaffPrismaService,
    private readonly terminationPdfService: TerminationPdfService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Post()
  async createStaff(
    @GetTenant() tenant: any,
    @Body() data: CreateStaffDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.createStaff({
      ...data,
      tenantId: tid,
    });
  }

  @Get()
  async findAllStaff(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('levelAssigned') levelAssigned?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.staffService.findAllStaff(tid, {
      academicYearId,
      category,
      status,
      levelAssigned,
    });
  }

  @Put('batch-assign-level')
  async batchAssignLevel(@Body() body: BatchAssignLevelDto, @Req() req: any) {
    // Validate that the user has permission (tenant guard already applied)
    return this.staffService.batchAssignLevel(body);
  }

  @Get('teachers-by-level')
  async getTeachersByLevel(@Query('schoolLevelId') schoolLevelId: string, @Query('academicYearId') academicYearId?: string, @Req() req?: any) {
    return this.staffService.findTeachersByLevel(schoolLevelId, academicYearId);
  }

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  @Post('admin/purge-all')
  async purgeAllStaff(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.purgeAllStaff(tid);
  }

  // ─── TERMINATE / REACTIVATE ────────────────────────────────────────────────

  @Post(':id/terminate')
  async terminateStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { terminationType: string; terminationDetails?: any; noticePeriodDays?: number; lastWorkingDate?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.terminateStaff(id, tid, body);
  }

  @Post(':id/reactivate')
  async reactivateStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.reactivateStaff(id, tid);
  }

  // ─── TERMINATION DOCUMENTS ────────────────────────────────────────────────

  /**
   * GET /api/hr/staff/:id/termination/preview?type=letter|certificate|settlement|attestation
   * Returns HTML preview of a termination document.
   */
  @Get(':id/termination/preview')
  async previewTerminationDocument(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('type') docType: 'letter' | 'certificate' | 'settlement' | 'attestation',
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!docType) throw new BadRequestException('Type de document requis (letter, certificate, settlement, attestation)');
    const html = await this.terminationPdfService.previewTerminationDocument(id, tid, docType);
    return { html };
  }

  /**
   * POST /api/hr/staff/:id/termination/generate-pdf?type=letter|certificate|settlement|attestation
   * Generates and returns the URL of the termination document PDF.
   */
  @Post(':id/termination/generate-pdf')
  async generateTerminationPdf(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('type') docType: 'letter' | 'certificate' | 'settlement' | 'attestation',
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!docType) throw new BadRequestException('Type de document requis');

    let pdfUrl: string;
    switch (docType) {
      case 'letter':
        pdfUrl = await this.terminationPdfService.generateTerminationLetterPdf(id, tid);
        break;
      case 'certificate':
        pdfUrl = await this.terminationPdfService.generateEmploymentCertificatePdf(id, tid);
        break;
      case 'settlement':
        pdfUrl = await this.terminationPdfService.generateSettlementReceiptPdf(id, tid);
        break;
      case 'attestation':
        pdfUrl = await this.terminationPdfService.generateEmployerAttestationPdf(id, tid);
        break;
      default:
        throw new BadRequestException(`Type de document inconnu: ${docType}`);
    }

    // Store pdfUrl in terminationDetails
    const staff = await this.staffService.findStaffById(id, tid);
    const details = (staff as any)?.terminationDetails || {};
    const pdfUrls = details.pdfUrls || {};
    pdfUrls[docType] = pdfUrl;
    await this.staffService.updateStaffTerminationDetails(id, tid, { ...details, pdfUrls });

    return { pdfUrl, docType };
  }

  /**
   * POST /api/hr/staff/:id/termination/sign-document
   * Signs a termination document (employer or employee signature).
   */
  @Post(':id/termination/sign-document')
  async signTerminationDocument(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { signatureData: string; signerName: string; signerRole: 'EMPLOYEUR' | 'EMPLOYE'; documentType: string },
    @Req() req: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');

    const staff = await this.staffService.findStaffById(id, tid);
    const details = (staff as any)?.terminationDetails || {};
    const ipAddress = req?.ip || req?.socket?.remoteAddress;

    const signerRole = (body.signerRole || 'EMPLOYEUR').toUpperCase();

    if (signerRole === 'EMPLOYEUR') {
      details.employerSignatureData = body.signatureData;
      details.employerSignerName = body.signerName;
      details.employerSignedAt = new Date().toISOString();
      details.employerIpAddress = ipAddress;
      details.employerSignatureMethod = 'ELECTRONIC_CANVAS';
    } else {
      details.employeeSignatureData = body.signatureData;
      details.employeeSignerName = body.signerName;
      details.employeeSignedAt = new Date().toISOString();
      details.employeeIpAddress = ipAddress;
      details.employeeSignatureMethod = 'ELECTRONIC_CANVAS';
    }

    await this.staffService.updateStaffTerminationDetails(id, tid, details);
    return { success: true, signerRole };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Get(':id')
  async findStaffById(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.staffService.findStaffById(id, tid);
  }

  @Put(':id')
  async updateStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateStaffDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.updateStaff(id, tid, data);
  }

  @Delete(':id')
  async deleteStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('force') force?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // force=true → hard delete (permanent removal from DB)
    // No force or force=false → soft delete (archive, status → INACTIVE)
    if (force === 'true') {
      return this.staffService.hardDeleteStaff(id, tid);
    }
    return this.staffService.archiveStaff(id, tid);
  }

  // ─── PHOTO ─────────────────────────────────────────────────────────────────

  /**
   * Upload photo via data URL (base64) — pattern standard Helm.
   * Body: { photoDataUrl: string }
   *
   * Le frontend compresse l'image côté navigateur (compressImageFileToDataUrl)
   * et envoie le data URL en JSON. Plus fiable que le multipart via BFF proxy.
   *
   * Convention nom endpoint : POST /<resource>/upload-<type>
   */
  @Post(':id/upload-photo')
  async uploadPhotoDataUrl(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Body('photoDataUrl', IMAGE_ONLY_DATA_URL_PIPE) photoDataUrl: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.uploadStaffPhotoDataUrl(staffId, tid, photoDataUrl);
  }

  @Get(':id/photo')
  async getPhoto(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.getStaffPhoto(staffId, tenant?.id);
  }

  @Delete(':id/photo')
  async deletePhoto(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.deleteStaffPhoto(staffId, tid);
  }

  // ─── DOCUMENTS ─────────────────────────────────────────────────────────────

  /**
   * Upload document via data URL (base64) — pattern standard Helm.
   * Body: { documentType, fileName, fileDataUrl, mimeType, fileSize, description?, expiresAt? }
   *
   * Supporte les images (JPEG, PNG, WebP) ET les PDF.
   *
   * Convention nom endpoint : POST /<resource>/upload-<type>
   */
  @Post(':id/upload-document')
  async uploadDocumentDataUrl(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Body() body: {
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      mimeType: string;
      fileSize: number;
      description?: string;
      expiresAt?: string;
    },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    if (!body?.documentType || !body?.fileName) {
      throw new BadRequestException('documentType et fileName requis');
    }
    // Valider le data URL via le pipe (vérifie format, MIME type, taille)
    const validatedDataUrl = IMAGE_OR_PDF_DATA_URL_PIPE.transform(body.fileDataUrl);
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    const expiresAt = body.expiresAt && body.expiresAt.trim() !== '' ? body.expiresAt : undefined;
    return this.staffService.uploadStaffDocumentDataUrl(staffId, tid, {
      documentType: body.documentType,
      fileName: body.fileName,
      fileDataUrl: validatedDataUrl,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      description: body.description,
      expiresAt,
    });
  }

  @Get(':id/documents')
  async findStaffDocuments(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.findStaffDocuments(staffId, tenant?.id);
  }

  /**
   * GET /hr/staff/:id/documents/:docId/download
   * Download a specific staff document file.
   */
  @Get(':id/documents/:docId/download')
  async downloadStaffDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    const { buffer, fileName, mimeType } = await this.staffService.downloadStaffDocument(docId, staffId, tid);

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    return buffer;
  }

  @Delete(':id/documents/:docId')
  async deleteStaffDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Param('docId') docId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.deleteStaffDocument(docId, staffId, tid);
  }

  @Put(':id/documents/:docId/validate')
  async validateDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Param('docId') docId: string,
    @Body() body: ValidateDocumentDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.validateStaffDocument(docId, staffId, tid, body.status);
  }

  // ─── MATRICULES ────────────────────────────────────────────────────────────

  @Post(':id/generate-matricules')
  async generateMatricules(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.generateMissingMatricules(staffId, tid);
  }

  // ─── CREDENTIALS (Générer Identifiant) ─────────────────────────────────────

  /**
   * POST /api/hr/staff/:id/generate-credentials
   *
   * Génère (ou régénère) les identifiants de connexion d'un staff dont le contrat
   * est signé. Crée ou met à jour l'utilisateur dans la table `users`, hashe le
   * mot de passe avec bcrypt, et envoie un email professionnel au staff avec ses
   * identifiants. Le mot de passe en clair n'est JAMAIS retourné au frontend —
   * seul l'email le contient.
   *
   * Déclenché par le bouton "Générer Identifiant" du module RH > Contrats.
   */
  @Post(':id/generate-credentials')
  async generateCredentials(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Req() req: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    const triggeredByUserId = req?.user?.id;
    const result = await this.staffService.generateCredentials(tid, staffId, triggeredByUserId);

    if (!result.success) {
      throw new BadRequestException(result.message || 'Erreur lors de la génération des identifiants');
    }
    return result;
  }
}
