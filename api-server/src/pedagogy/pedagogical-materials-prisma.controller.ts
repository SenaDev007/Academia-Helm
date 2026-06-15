/**
 * ============================================================================
 * PEDAGOGICAL MATERIALS PRISMA CONTROLLER - MODULE 2
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
import { PedagogicalMaterialsPrismaService } from './pedagogical-materials-prisma.service';
import { CreatePedagogicalMaterialDto } from './dto/create-pedagogical-material.dto';
import { UpdatePedagogicalMaterialDto } from './dto/update-pedagogical-material.dto';
import { PedagogicalMaterialsQueryDto } from './dto/query-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { MaterialContextGuard } from './guards/material-context.guard';
import { MaterialRbacGuard } from './guards/material-rbac.guard';
import { UseInterceptors } from '@nestjs/common';
import { MaterialAuditInterceptor } from './interceptors/material-audit.interceptor';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';

@Controller('pedagogy/pedagogical-materials')
@UseGuards(
  JwtAuthGuard,
  PortalAccessGuard, // Vérifie le portail autorisé
  MaterialContextGuard,
  MaterialRbacGuard,
  ModulePermissionGuard, // Vérifie les permissions par module
)
@UseInterceptors(MaterialAuditInterceptor)
@RequiredModule(Module.MATERIEL_PEDAGOGIQUE) // Module MATERIEL_PEDAGOGIQUE requis
export class PedagogicalMaterialsPrismaController {
  constructor(
    private readonly pedagogicalMaterialsService: PedagogicalMaterialsPrismaService,
  ) {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE)
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreatePedagogicalMaterialDto,
  ) {
    return this.pedagogicalMaterialsService.create({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  @RequiredPermission(PermissionAction.READ)
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: PedagogicalMaterialsQueryDto,
  ) {
    return this.pedagogicalMaterialsService.findAll(tenantId, query, {
      schoolLevelId: query.schoolLevelId,
      subjectId: query.subjectId,
      category: query.category,
      isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
      search: query.search,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.pedagogicalMaterialsService.findOne(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdatePedagogicalMaterialDto,
  ) {
    return this.pedagogicalMaterialsService.update(id, tenantId, updateDto);
  }

  @Delete(':id')
  @RequiredPermission(PermissionAction.MANAGE)
  async remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.pedagogicalMaterialsService.remove(id, tenantId);
  }
}
