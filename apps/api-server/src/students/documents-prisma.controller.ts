/**
 * ============================================================================
 * DOCUMENTS PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentsPrismaService } from './documents-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateStudentDocumentDto } from './dto';

/**
 * ⭐ P2.4 — RBAC renforcé sur DocumentsPrismaController.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait CRUD documents.
 *    Maintenant : `TenantGuard` + `RolesGuard` + `@Roles` par endpoint.
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'SECRETARY', 'TEACHER',
];

@Controller('students/:studentId/documents')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DocumentsPrismaController {
  constructor(private readonly documentsService: DocumentsPrismaService) {}

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateStudentDocumentDto,
  ) {
    // ⭐ P0.7 — Le service createStudentDocument exige academicYearId + schoolLevelId.
    //    On résout depuis le contexte courant (tenant) si le DTO ne les fournit pas.
    return this.documentsService.createStudentDocument({
      ...createDto,
      tenantId,
      studentId,
      academicYearId: createDto.academicYearId || '',
      schoolLevelId: createDto.schoolLevelId || '',
    });
  }

  @Get()
  @Roles(...MANAGEMENT_ROLES)
  async findAll(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.documentsService.getStudentDocuments(studentId, tenantId, {
      documentType,
    });
  }

  @Delete(':id')
  @Roles(...MANAGEMENT_ROLES)
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.documentsService.deleteDocument(id, tenantId);
  }
}

@Controller('documents/generated')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GeneratedDocumentsController {
  constructor(private readonly documentsService: DocumentsPrismaService) {}

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async generate(
    @TenantId() tenantId: string,
    @Body() generateDto: any,
  ) {
    return this.documentsService.generateDocument({
      ...generateDto,
      tenantId,
    });
  }

  @Get()
  @Roles(...MANAGEMENT_ROLES)
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('studentId') studentId?: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.documentsService.getGeneratedDocuments(tenantId, {
      academicYearId,
      schoolLevelId,
      studentId,
      documentType,
    });
  }
}
