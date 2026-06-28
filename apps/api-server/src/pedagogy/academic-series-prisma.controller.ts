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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import {
  CreateAcademicSeriesDto,
  UpdateAcademicSeriesDto,
  AddSeriesSubjectDto,
  UpdateSeriesSubjectDto,
} from './dto/supplementary-dtos';

@Controller('pedagogy/academic-series')
@UseGuards(JwtAuthGuard)
export class AcademicSeriesPrismaController {
  constructor(
    private readonly service: AcademicSeriesPrismaService,
  ) {}


  // ... existing methods ...

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

}
