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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AcademicSeriesPrismaService } from './academic-series-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { StorageService } from '../common/services/storage.service';

@Controller('api/pedagogy/academic-series')
@UseGuards(JwtAuthGuard)
export class AcademicSeriesPrismaController {
  constructor(
    private readonly service: AcademicSeriesPrismaService,
    private readonly storage: StorageService,
  ) {}


  // ... existing methods ...

  @Post('programs/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProgram(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const url = await this.storage.uploadFile(file, folder || 'programs');
    return { url };
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
    @Body() body: { academicYearId: string; levelId: string; name: string; description?: string },
  ) {
    return this.service.createSeries({ ...body, tenantId });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean },
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
    @Body()
    body: {
      academicYearId: string;
      seriesId: string;
      subjectId: string;
      coefficient: number;
      weeklyHours: number;
    },
  ) {
    return this.service.addSubjectToSeries({ ...body, tenantId });
  }

  @Put('subjects/:id')
  async updateSeriesSubject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { coefficient?: number; weeklyHours?: number },
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
    @Body()
    body: { academicYearId: string; subjectId: string; documentUrl: string; version: string },
  ) {
    return this.service.createSubjectProgram({ ...body, tenantId });
  }

  @Put('programs/:id/approve')
  async approveProgram(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { approvedById: string },
  ) {
    return this.service.approveSubjectProgram(id, tenantId, body.approvedById);
  }
}
