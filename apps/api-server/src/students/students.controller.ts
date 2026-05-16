/**
 * ============================================================================
 * STUDENTS CONTROLLER - EXEMPLE MODULE SCOLARITE
 * ============================================================================
 * 
 * Exemple de controller avec protection par module et niveau scolaire
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleAccessGuard } from '../common/guards/module-access.guard';
import { TenantValidationGuard } from '../common/guards/tenant-validation.guard';
import { TenantIsolationGuard } from '../common/guards/tenant-isolation.guard';
import { PortalAccessGuard } from '../common/guards/portal-access.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { RequiredModule } from '../common/decorators/required-module.decorator';
import { RequiredPermission } from '../common/decorators/required-permission.decorator';
import { Module } from '../common/enums/module.enum';
import { PermissionAction } from '../common/enums/permission-action.enum';
import { ModuleIsolationInterceptor } from '../common/interceptors/module-isolation.interceptor';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ModuleTypeRequired, ModuleTypeParam } from '../common/decorators/module-type.decorator';
import { ModuleType } from '../modules/entities/module.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('students')
@UseGuards(
  JwtAuthGuard,
  PortalAccessGuard, // Vérifie le portail autorisé
  TenantValidationGuard,
  TenantIsolationGuard,
  ModulePermissionGuard, // Vérifie les permissions par module
  RolesGuard,
  PermissionsGuard,
  ModuleAccessGuard, // Protection par module
)
@UseInterceptors(
  AuditLogInterceptor,
  ModuleIsolationInterceptor, // Isolation par niveau
)
@RequiredModule(Module.ELEVES) // Module ELEVES requis (nouveau système)
@ModuleTypeRequired(ModuleType.SCOLARITE) // Module SCOLARITE requis (ancien système)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @RequiredPermission(PermissionAction.WRITE) // Nouveau système
  @Roles('admin', 'director', 'teacher')
  @Permissions('students.create', 'students.manage')
  create(
    @Body() createStudentDto: CreateStudentDto,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement par ContextInterceptor
    @ModuleTypeParam() moduleType: ModuleType, // Résolu automatiquement
    @CurrentUser() user: any,
  ) {
    // Le contexte (tenantId, schoolLevelId, moduleType) est automatiquement résolu et validé
    return this.studentsService.create(createStudentDto, tenantId, schoolLevelId, user.id);
  }

  @Get()
  @RequiredPermission(PermissionAction.READ) // Nouveau système (par défaut READ)
  @Permissions('students.read', 'students.manage')
  findAll(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement
    @ModuleTypeParam() moduleType: ModuleType, // Résolu automatiquement
    @Query() pagination: PaginationDto,
    @Query('academicYearId') academicYearId?: string,
  ) {
    // Isolation garantie : seuls les étudiants du niveau spécifié
    // Le contexte est automatiquement validé par ContextValidationGuard
    return this.studentsService.findAll(tenantId, schoolLevelId, pagination, academicYearId);
  }

  @Get(':id')
  @Permissions('students.read', 'students.manage')
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement
  ) {
    return this.studentsService.findOne(id, tenantId, schoolLevelId);
  }

  @Patch(':id')
  @Roles('admin', 'director', 'teacher')
  @Permissions('students.update', 'students.manage')
  update(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE - Résolu automatiquement
    @CurrentUser() user: any,
  ) {
    return this.studentsService.update(id, updateStudentDto, tenantId, schoolLevelId);
  }

  @Delete(':id')
  @RequiredPermission(PermissionAction.MANAGE) // Suppression = MANAGE
  @Roles('admin', 'director')
  @Permissions('students.delete', 'students.manage')
  remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.studentsService.delete(id, tenantId, schoolLevelId);
  }

  @Get('statistics')
  @Permissions('students.read')
  getStatistics(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.studentsService.getStatistics(tenantId, schoolLevelId, academicYearId);
  }

  @Post(':id/export-educmaster')
  @Permissions('students.read')
  exportEducMaster(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.studentsService.exportToEducMaster(id, tenantId);
  }

  @Get(':id/academic-dossier')
  @Permissions('students.read')
  getAcademicDossier(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.studentsService.generateAcademicDossier(id, tenantId, academicYearId);
  }
}
