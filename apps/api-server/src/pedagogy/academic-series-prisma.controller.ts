/**
 * ACADEMIC SERIES PRISMA CONTROLLER - MODULE 2
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AcademicSeriesPrismaService } from './academic-series-prisma.service';
import { IMAGE_OR_PDF_DATA_URL_PIPE } from '../common/pipes/data-url-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import {
  CreateAcademicSeriesDto,
  UpdateAcademicSeriesDto,
  AddSeriesSubjectDto,
  UpdateSeriesSubjectDto,
  CreateSubjectProgramDto,
} from './dto/supplementary-dtos';

@Controller('pedagogy/academic-series')
@UseGuards(JwtAuthGuard)
export class AcademicSeriesPrismaController {
  constructor(
    private readonly service: AcademicSeriesPrismaService,
  ) {}


  // ... existing methods ...

  /**
   * Upload programme via data URL (base64) — pattern standard Helm.
   * Body: { fileDataUrl, fileName?, mimeType?, folder? }
   *
   * Supporte les images ET les PDF. Le data URL est retourné tel quel et
   * sera stocké directement dans program.documentUrl.
   *
   * Convention nom endpoint : POST /<resource>/upload-<type>
   */
  @Post('programs/upload-program')
  async uploadProgramData(
    @Body('fileDataUrl', IMAGE_OR_PDF_DATA_URL_PIPE) fileDataUrl: string,
  ) {
    // Le pipe a déjà validé le format, le MIME type (image/* ou application/pdf) et la taille (20 Mo).
    // Retourner le data URL tel quel — sera stocké directement dans documentUrl.
    return { url: fileDataUrl };
  }

  @Put('programs/:id/approve')
  async approveProgram(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('userId') userId: string,
  ) {
    return this.service.approveProgram(id, tenantId, userId);
  }


  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
  ) {
    if (!academicYearId) return [];
    return this.service.findAllSeries(tenantId, academicYearId, levelId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() body: CreateAcademicSeriesDto,
  ) {
    return this.service.createSeries({ ...body, tenantId });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateAcademicSeriesDto,
  ) {
    return this.service.updateSeries(id, tenantId, body);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getSeriesOrThrow(id, tenantId);
  }

  @Post('subjects')
  async addSubjectToSeries(
    @TenantId() tenantId: string,
    @Body() body: AddSeriesSubjectDto,
  ) {
    return this.service.addSubjectToSeries({ ...body, tenantId });
  }

  @Put('subjects/:id')
  async updateSeriesSubject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: UpdateSeriesSubjectDto,
  ) {
    return this.service.updateSeriesSubject(id, tenantId, body);
  }

  @Delete('subjects/:id')
  async removeSubjectFromSeries(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.removeSubjectFromSeries(id, tenantId);
  }

  @Get('programs/by-subject/:subjectId')
  async getProgramsBySubject(
    @Param('subjectId') subjectId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.service.findProgramsBySubject(tenantId, academicYearId, subjectId);
  }

  @Post('programs')
  async createProgram(
    @TenantId() tenantId: string,
    @Body() body: CreateSubjectProgramDto,
  ) {
    return this.service.createSubjectProgram({ ...body, tenantId });
  }

}
