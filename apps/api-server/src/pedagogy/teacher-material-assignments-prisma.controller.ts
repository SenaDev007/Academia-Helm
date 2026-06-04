/**
 * ============================================================================
 * TEACHER MATERIAL ASSIGNMENTS PRISMA CONTROLLER - MODULE 2
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { TeacherMaterialAssignmentsPrismaService } from './teacher-material-assignments-prisma.service';
import { CreateTeacherMaterialAssignmentDto } from './dto/create-teacher-material-assignment.dto';
import { TeacherMaterialAssignmentsQueryDto } from './dto/query-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MaterialContextGuard } from './guards/material-context.guard';
import { MaterialRbacGuard } from './guards/material-rbac.guard';
import { MaterialStockGuard } from './guards/material-stock.guard';
import { UseInterceptors } from '@nestjs/common';
import { MaterialAuditInterceptor } from './interceptors/material-audit.interceptor';

@Controller('pedagogy/teacher-material-assignments')
@UseGuards(JwtAuthGuard, MaterialContextGuard, MaterialRbacGuard, MaterialStockGuard)
@UseInterceptors(MaterialAuditInterceptor)
export class TeacherMaterialAssignmentsPrismaController {
  constructor(
    private readonly teacherMaterialAssignmentsService: TeacherMaterialAssignmentsPrismaService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTeacherMaterialAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.teacherMaterialAssignmentsService.create({
      ...createDto,
      tenantId,
      performedById: user.id, // Pour le MaterialMovement
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: TeacherMaterialAssignmentsQueryDto,
  ) {
    return this.teacherMaterialAssignmentsService.findAll(
      tenantId,
      query.academicYearId,
      query,
      {
        teacherId: query.teacherId,
        materialId: query.materialId,
        schoolLevelId: query.schoolLevelId,
        classId: query.classId,
        signed: query.signed === 'true' ? true : query.signed === 'false' ? false : undefined,
      },
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.teacherMaterialAssignmentsService.findOne(id, tenantId);
  }

  @Patch(':id/sign')
  async sign(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.teacherMaterialAssignmentsService.sign(id, tenantId, user.id);
  }
}
