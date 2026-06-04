/**
 * ============================================================================
 * TEACHERS PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TeachersPrismaService } from './teachers-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class TeachersPrismaController {
  constructor(private readonly teachersService: TeachersPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTeacherDto,
  ) {
    return this.teachersService.createTeacher({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.teachersService.findAllTeachers(tenantId, {
      schoolLevelId,
      departmentId,
      status,
      search,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.teachersService.findTeacherById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTeacherDto,
  ) {
    return this.teachersService.updateTeacher(id, tenantId, updateDto);
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.teachersService.archiveTeacher(id, tenantId);
  }
}
