/**
 * ============================================================================
 * CLASS DIARIES PRISMA CONTROLLER
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
} from '@nestjs/common';
import { ClassDiariesPrismaService } from './class-diaries-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateClassDiaryDto } from './dto/create-class-diary.dto';
import { UpdateClassDiaryDto } from './dto/update-class-diary.dto';

@Controller('class-diaries')
@UseGuards(JwtAuthGuard)
export class ClassDiariesPrismaController {
  constructor(private readonly classDiariesService: ClassDiariesPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateClassDiaryDto,
  ) {
    return this.classDiariesService.createClassDiary({
      ...createDto,
      tenantId,
    } as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('classSubjectId') classSubjectId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.classDiariesService.findAllClassDiaries(tenantId, {
      academicYearId,
      schoolLevelId,
      classSubjectId,
      classId,
      subjectId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.classDiariesService.findClassDiaryById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateClassDiaryDto,
  ) {
    return this.classDiariesService.updateClassDiary(id, tenantId, updateDto as any);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.classDiariesService.deleteClassDiary(id, tenantId);
  }
}
