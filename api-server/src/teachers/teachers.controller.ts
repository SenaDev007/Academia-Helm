import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';

@Controller('teachers')
@UseGuards(JwtAuthGuard, PortalAccessGuard, ModulePermissionGuard)
@RequiredModule(Module.ORGANISATION_PEDAGOGIQUE) // Les enseignants font partie de l'organisation pédagogique
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE) // Seuls directeurs/promoteurs
  create(
    @Body() createTeacherDto: CreateTeacherDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.create(createTeacherDto, tenantId, user.id);
  }

  @Get()
  @RequiredPermission(PermissionAction.READ)
  findAll(
    @TenantId() tenantId: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.teachersService.findAll(tenantId, departmentId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.teachersService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
    @TenantId() tenantId: string,
  ) {
    return this.teachersService.update(id, updateTeacherDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.teachersService.delete(id, tenantId);
  }
}

