import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import { AdmissionService } from '../services/admission.service';
import { CreateAdmissionDto } from '../dto/create-admission.dto';
import { UpdateAdmissionDto } from '../dto/update-admission.dto';
import { DecideAdmissionDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IMAGE_OR_PDF_DATA_URL_PIPE } from '../../common/pipes/data-url-validation.pipe';
import { PrismaService } from '../../database/prisma.service';
import type { Response } from 'express';

@Controller('students/admissions')
@UseGuards(JwtAuthGuard)
export class AdmissionController {
  constructor(
    private readonly admissionService: AdmissionService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══ CRUD Admission ═══

  @Post()
  async create(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() createAdmissionDto: CreateAdmissionDto) {
    return this.admissionService.create(tenantId, createAdmissionDto, user?.id);
  }

  @Get()
  async findAll(@TenantId() tenantId: string, @Query() query: any) {
    return this.admissionService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateAdmissionDto: UpdateAdmissionDto
  ) {
    return this.admissionService.update(id, tenantId, updateAdmissionDto, user?.id);
  }

  @Delete(':id')
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.delete(id, tenantId);
  }

  // ═══ Workflow ═══

  @Post(':id/submit')
  async submit(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.submit(id, tenantId);
  }

  @Post(':id/decide')
  async decide(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() decideDto: DecideAdmissionDto,
  ) {
    return this.admissionService.decide(id, tenantId, decideDto.decision as 'ACCEPTED' | 'REJECTED', decideDto.comment ?? '', user?.id);
  }

  @Post(':id/accept')
  async accept(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.accept(id, tenantId, body.comment ?? '', user?.id);
  }

  @Post(':id/reject')
  async reject(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.reject(id, tenantId, body.comment ?? '', user?.id);
  }

  @Post(':id/waitlist')
  async waitlist(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.waitlist(id, tenantId, body.comment ?? '', user?.id);
  }

  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.cancel(id, tenantId, body.comment ?? '', user?.id);
  }

  @Post(':id/request-documents')
  async requestDocuments(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.requestDocuments(id, tenantId, body.comment ?? '', user?.id);
  }

  @Post(':id/convert')
  async convert(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.admissionService.convertToStudent(id, tenantId, user?.id);
  }

  // ═══ Documents ═══

  @Get(':id/documents')
  async getDocuments(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.getDocuments(id, tenantId);
  }

  @Post(':id/documents')
  async createDocument(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.admissionService.createDocument(id, tenantId, body);
  }

  /**
   * Upload d'un document d'admission via data URL (base64).
   * Body: { documentType, fileName, fileDataUrl, mimeType, fileSize, comment?, expiresAt? }
   *
   * Pattern aligné sur POST /hr/staff/:id/upload-document.
   * Supporte les images (JPEG, PNG, WebP) ET les PDF (max 20 Mo).
   */
  @Post(':id/upload-document')
  async uploadDocumentDataUrl(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      documentType: string;
      fileName: string;
      fileDataUrl: string;
      mimeType: string;
      fileSize: number;
      comment?: string;
      expiresAt?: string;
    },
  ) {
    if (!body?.documentType || !body?.fileName) {
      throw new BadRequestException('documentType et fileName requis');
    }
    // Valider le data URL via le pipe (vérifie format, MIME type, taille)
    const validatedDataUrl = IMAGE_OR_PDF_DATA_URL_PIPE.transform(body.fileDataUrl);
    const expiresAt = body.expiresAt && body.expiresAt.trim() !== '' ? body.expiresAt : undefined;
    return this.admissionService.uploadAdmissionDocumentDataUrl(id, tenantId, {
      documentType: body.documentType,
      fileName: body.fileName,
      fileDataUrl: validatedDataUrl,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      comment: body.comment,
      expiresAt,
    });
  }

  /**
   * GET /students/admissions/:id/documents/:docId/download
   * Télécharge un document d'admission. Le fichier est renvoyé en binaire
   * avec Content-Disposition: inline pour permettre la prévisualisation
   * navigateur (PDF/image) en plus du téléchargement.
   *
   * Pattern aligné sur GET /hr/staff/:id/documents/:docId/download.
   */
  @Get(':id/documents/:docId/download')
  async downloadDocument(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, fileName, mimeType } = await this.admissionService.downloadAdmissionDocument(docId, id, tenantId);

    // Encoder le filename pour gérer les caractères speciaux et unicode
    const encodedFileName = encodeURIComponent(fileName).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      'Content-Length': buffer.length,
    });

    return buffer;
  }

  @Patch('documents/:documentId')
  async updateDocument(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @Body() body: any,
  ) {
    return this.admissionService.updateDocument(documentId, tenantId, body);
  }

  @Post('documents/:documentId/validate')
  async validateDocument(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: any,
  ) {
    return this.admissionService.validateDocument(documentId, tenantId, user?.id);
  }

  @Post('documents/:documentId/reject')
  async rejectDocument(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: any,
    @Body() body: { comment?: string },
  ) {
    return this.admissionService.rejectDocument(documentId, tenantId, user?.id, body.comment ?? '');
  }

  @Delete('documents/:documentId')
  async deleteDocument(
    @TenantId() tenantId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.admissionService.deleteDocument(documentId, tenantId);
  }

  // ═══ Interviews ═══

  @Get(':id/interviews')
  async getInterviews(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.getInterviews(id, tenantId);
  }

  @Post(':id/interviews')
  async createInterview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.admissionService.createInterview(id, tenantId, body);
  }

  @Patch('interviews/:interviewId')
  async updateInterview(
    @TenantId() tenantId: string,
    @Param('interviewId') interviewId: string,
    @Body() body: any,
  ) {
    return this.admissionService.updateInterview(interviewId, tenantId, body);
  }

  @Post('interviews/:interviewId/complete')
  async completeInterview(
    @TenantId() tenantId: string,
    @Param('interviewId') interviewId: string,
    @Body() body: any,
  ) {
    return this.admissionService.completeInterview(interviewId, tenantId, body);
  }

  @Delete('interviews/:interviewId')
  async deleteInterview(
    @TenantId() tenantId: string,
    @Param('interviewId') interviewId: string,
  ) {
    return this.prisma.admissionInterview.delete({ where: { id: interviewId } });
  }
}
