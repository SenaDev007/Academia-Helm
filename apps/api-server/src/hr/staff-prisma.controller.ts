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

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  constructor(private readonly staffService: StaffPrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Post()
  async createStaff(@GetTenant() tenant: any, @Body() data: CreateStaffDto) {
    return this.staffService.createStaff({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllStaff(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('levelAssigned') levelAssigned?: string,
  ) {
    return this.staffService.findAllStaff(tenant.id, {
      academicYearId,
      category,
      status,
      levelAssigned,
    });
  }

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  @Post('admin/purge-all')
  async purgeAllStaff(@GetTenant() tenant: any) {
    return this.staffService.purgeAllStaff(tenant.id);
  }

  // ─── TERMINATE / REACTIVATE ────────────────────────────────────────────────

  @Post(':id/terminate')
  async terminateStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { terminationType: string; terminationDetails?: any; noticePeriodDays?: number; lastWorkingDate?: string },
  ) {
    return this.staffService.terminateStaff(id, tenant.id, body);
  }

  @Post(':id/reactivate')
  async reactivateStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.staffService.reactivateStaff(id, tenant.id);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Get(':id')
  async findStaffById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.findStaffById(id, tenant.id);
  }

  @Put(':id')
  async updateStaff(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateStaffDto) {
    return this.staffService.updateStaff(id, tenant.id, data);
  }

  @Delete(':id')
  async deleteStaff(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    // force=true → hard delete (permanent removal from DB)
    // No force or force=false → soft delete (archive, status → INACTIVE)
    if (force === 'true') {
      return this.staffService.hardDeleteStaff(id, tenant.id);
    }
    return this.staffService.archiveStaff(id, tenant.id);
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
  ) {
    if (!file) {
      throw new Error('Aucun fichier photo fourni');
    }
    return this.staffService.uploadStaffPhoto(staffId, tenant.id, file);
  }

  @Get(':id/photo')
  async getPhoto(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.getStaffPhoto(staffId, tenant.id);
  }

  @Delete(':id/photo')
  async deletePhoto(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.deleteStaffPhoto(staffId, tenant.id);
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
  ) {
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }
    return this.staffService.uploadStaffDocument(
      staffId,
      tenant.id,
      file,
      body.documentType || 'OTHER',
      body.description,
      body.expiresAt,
    );
  }

  @Get(':id/documents')
  async findStaffDocuments(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.findStaffDocuments(staffId, tenant.id);
  }

  @Delete(':id/documents/:docId')
  async deleteStaffDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Param('docId') docId: string,
  ) {
    return this.staffService.deleteStaffDocument(docId, staffId, tenant.id);
  }

  @Put(':id/documents/:docId/validate')
  async validateDocument(
    @GetTenant() tenant: any,
    @Param('id') staffId: string,
    @Param('docId') docId: string,
    @Body() body: ValidateDocumentDto,
  ) {
    return this.staffService.validateStaffDocument(docId, staffId, tenant.id, body.status);
  }

  // ─── MATRICULES ────────────────────────────────────────────────────────────

  @Post(':id/generate-matricules')
  async generateMatricules(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.generateMissingMatricules(staffId, tenant.id);
  }
}
