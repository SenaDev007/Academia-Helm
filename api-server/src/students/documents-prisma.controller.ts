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
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateStudentDocumentDto } from './dto';

@Controller('students/:studentId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsPrismaController {
  constructor(private readonly documentsService: DocumentsPrismaService) {}

  @Post()
  async create(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateStudentDocumentDto,
  ) {
    return this.documentsService.createStudentDocument({
      ...createDto,
      tenantId,
      studentId,
    });
  }

  @Get()
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
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.documentsService.deleteDocument(id, tenantId);
  }
}

@Controller('documents/generated')
@UseGuards(JwtAuthGuard)
export class GeneratedDocumentsController {
  constructor(private readonly documentsService: DocumentsPrismaService) {}

  @Post()
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
