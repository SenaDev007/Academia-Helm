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
 *   POST   /hr/staff/:id/photo         — Upload/replace staff photo (Multer)
 *   GET    /hr/staff/:id/photo         — Get staff photo
 *   DELETE /hr/staff/:id/photo         — Delete staff photo
 *
 *   POST   /hr/staff/:id/documents     — Upload document (Multer file upload)
 *   POST   /hr/staff/:id/documents/json— Add document metadata (legacy JSON body)
 *   GET    /hr/staff/:id/documents     — Get all documents (grouped by category)
 *   DELETE /hr/staff/:id/documents/:docId — Delete a document
 *   PUT    /hr/staff/:id/documents/:docId/validate — Validate/reject a document
 *
 *   POST   /hr/staff/:id/generate-matricules — Generate missing matricules
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { StaffPrismaService } from './staff-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import {
  CreateStaffDto, UpdateStaffDto, AddStaffDocumentDto,
  UploadStaffDocumentDto, ValidateDocumentDto,
} from './dto/index';
import type { Response } from 'express';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  constructor(private readonly staffService: StaffPrismaService) {}

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

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  async uploadPhoto(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    if (!file) {
      throw new Error('Aucun fichier photo fourni');
    }
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.staffService.uploadStaffPhoto(staffId, tid, file);
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
   * Upload a document file (Multer multipart/form-data)
   * Query params: documentType, description?, expiresAt?
   */
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  }))
  async uploadDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadStaffDocumentDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Normalize expiresAt: treat empty strings as undefined/null
    const expiresAt = body.expiresAt && body.expiresAt.trim() !== '' ? body.expiresAt : undefined;
    return this.staffService.uploadStaffDocument(
      staffId,
      tid,
      file,
      body.documentType || 'OTHER',
      body.description,
      expiresAt,
    );
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
}
