/**
 * ============================================================================
 * ANNUAL TEACHER SUPPLIES PRISMA CONTROLLER - MODULE 2
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
} from '@nestjs/common';
import { AnnualTeacherSuppliesPrismaService } from './annual-teacher-supplies-prisma.service';
import { CreateAnnualTeacherSupplyDto } from './dto/create-annual-teacher-supply.dto';
import { AnnualTeacherSuppliesQueryDto } from './dto/query-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { MaterialContextGuard } from './guards/material-context.guard';
import { MaterialRbacGuard } from './guards/material-rbac.guard';
import { UseInterceptors } from '@nestjs/common';
import { MaterialAuditInterceptor } from './interceptors/material-audit.interceptor';

@Controller('pedagogy/annual-teacher-supplies')
@UseGuards(JwtAuthGuard, MaterialContextGuard, MaterialRbacGuard)
@UseInterceptors(MaterialAuditInterceptor)
export class AnnualTeacherSuppliesPrismaController {
  constructor(
    private readonly annualTeacherSuppliesService: AnnualTeacherSuppliesPrismaService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateAnnualTeacherSupplyDto,
  ) {
    return this.annualTeacherSuppliesService.create({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: AnnualTeacherSuppliesQueryDto,
  ) {
    return this.annualTeacherSuppliesService.findAll(
      tenantId,
      query.academicYearId,
      query,
      {
        teacherId: query.teacherId,
        materialId: query.materialId,
        schoolLevelId: query.schoolLevelId,
        classId: query.classId,
      },
    );
  }

  @Get('by-teacher/:teacherId')
  async findByTeacher(
    @Param('teacherId') teacherId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.annualTeacherSuppliesService.findByTeacher(
      tenantId,
      academicYearId,
      teacherId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.annualTeacherSuppliesService.findOne(id, tenantId);
  }
}
