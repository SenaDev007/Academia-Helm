/**
 * ============================================================================
 * SUBJECTS PRISMA CONTROLLER
 * ============================================================================
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
  Logger,
} from '@nestjs/common';
import { SubjectsPrismaService } from './subjects-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsPrismaController {
  private readonly logger = new Logger(SubjectsPrismaController.name);
  constructor(private readonly subjectsService: SubjectsPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateSubjectDto,
  ) {
    // Log défensif : trace exactement ce que le frontend envoie
    // pour diagnostiquer les erreurs « Argument `academicYear` is missing »
    this.logger.log(`POST /subjects — payload keys: ${Object.keys(createDto).join(', ')}, academicYearId=${JSON.stringify((createDto as any).academicYearId)}, schoolLevelId=${JSON.stringify((createDto as any).schoolLevelId)}, code=${JSON.stringify((createDto as any).code)}`);

    const formattedData = { ...createDto };
    if (createDto.coefficient !== undefined) {
      formattedData.coefficient = Number(createDto.coefficient) || 1.0;
    }
    if (createDto.weeklyHours !== undefined) {
      formattedData.weeklyHours = Number(createDto.weeklyHours) || 0;
    }
    return this.subjectsService.createSubject({
      ...formattedData,
      tenantId,
    } as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
    @Query('language') language?: string,
    @Query('search') search?: string,
  ) {
    return this.subjectsService.findAllSubjects(tenantId, {
      academicYearId,
      schoolLevelId,
      academicTrackId,
      language,
      search,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.subjectsService.findSubjectById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateSubjectDto,
  ) {
    const formattedData = { ...updateDto };
    if (updateDto.coefficient !== undefined) {
      formattedData.coefficient = Number(updateDto.coefficient) || 1.0;
    }
    if (updateDto.weeklyHours !== undefined) {
      formattedData.weeklyHours = Number(updateDto.weeklyHours) || 0;
    }
    return this.subjectsService.updateSubject(id, tenantId, formattedData as any);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.subjectsService.deleteSubject(id, tenantId);
  }
}
