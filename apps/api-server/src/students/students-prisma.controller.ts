/**
 * ============================================================================
 * STUDENTS PRISMA CONTROLLER - MODULE 1
 * ============================================================================
 * 
 * Controller pour la gestion des élèves
 * Module 1 : Gestion des Élèves & Scolarité
 * 
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
import { StudentsPrismaService } from './students-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('api/students')
@UseGuards(JwtAuthGuard)
export class StudentsPrismaController {
  constructor(private readonly studentsService: StudentsPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: any,
  ) {
    return this.studentsService.createStudent({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: string,
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('regimeType') regimeType?: string,
    @Query('hasArrears') hasArrears?: string,
  ) {
    return this.studentsService.findAllStudents(tenantId, {
      academicYearId,
      schoolLevelId,
      status,
      classId,
      search,
      regimeType: regimeType || undefined,
      hasArrears: hasArrears === 'true' ? true : hasArrears === 'false' ? false : undefined,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.studentsService.getStudentStatistics(
      tenantId,
      academicYearId,
      schoolLevelId,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.studentsService.findStudentById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.studentsService.updateStudent(id, tenantId, updateDto);
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.studentsService.archiveStudent(id, tenantId, body.reason);
  }

  @Post(':id/enroll')
  async enroll(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() enrollDto: any,
  ) {
    return this.studentsService.enrollStudent({
      ...enrollDto,
      tenantId,
      studentId: id,
    });
  }
}

