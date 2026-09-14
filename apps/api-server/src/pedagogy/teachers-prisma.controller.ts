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
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeachersPrismaService } from './teachers-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import { resolveEffectiveLevelFilter } from '../common/context/scope-where';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class TeachersPrismaController {
  constructor(
    private readonly teachersService: TeachersPrismaService,
    private readonly prisma: PrismaService,
  ) {}

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
    @CurrentUser() user: any,
    @Req() req: any,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
  ) {
    // ⭐ 2026-09-15 : scope niveau — un directeur MAT_PRI ne voit que les
    //    enseignants de son périmètre ; le promoteur voit tout. Le filtre
    //    explicite (query OU header du sélecteur global) est résolu avec
    //    tolérance UUID et ne peut qu'affiner dans le périmètre.
    const effectiveLevel = await resolveEffectiveLevelFilter(
      this.prisma,
      tenantId,
      schoolLevelId,
      req?.headers?.['x-school-level-id'],
    );
    return this.teachersService.findAllTeachers(tenantId, {
      schoolLevelId: effectiveLevel,
      departmentId,
      status,
      search,
      language,
    }, user?.scope);
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
