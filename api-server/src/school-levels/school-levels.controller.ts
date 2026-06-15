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
} from '@nestjs/common';
import { SchoolLevelsService } from './school-levels.service';
import { CreateSchoolLevelDto } from './dto/create-school-level.dto';
import { UpdateSchoolLevelDto } from './dto/update-school-level.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantValidationGuard } from '../common/guards/tenant-validation.guard';
import { TenantIsolationGuard } from '../common/guards/tenant-isolation.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('school-levels')
@UseGuards(
  JwtAuthGuard,
  TenantValidationGuard,
  TenantIsolationGuard,
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
export class SchoolLevelsController {
  constructor(private readonly schoolLevelsService: SchoolLevelsService) {}

  @Post()
  @Roles('admin', 'director')
  @Permissions('school-levels.create', 'school-levels.manage')
  create(
    @Body() createSchoolLevelDto: CreateSchoolLevelDto,
    @TenantId() tenantId: string,
  ) {
    return this.schoolLevelsService.create(createSchoolLevelDto, tenantId);
  }

  @Get()
  @Permissions('school-levels.read', 'school-levels.manage')
  findAll(@TenantId() tenantId: string) {
    return this.schoolLevelsService.findAll(tenantId);
  }

  @Get(':id')
  @Permissions('school-levels.read', 'school-levels.manage')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.schoolLevelsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('admin', 'director')
  @Permissions('school-levels.update', 'school-levels.manage')
  update(
    @Param('id') id: string,
    @Body() updateSchoolLevelDto: UpdateSchoolLevelDto,
    @TenantId() tenantId: string,
  ) {
    return this.schoolLevelsService.update(id, updateSchoolLevelDto, tenantId);
  }

  @Delete(':id')
  @Roles('admin', 'director')
  @Permissions('school-levels.delete', 'school-levels.manage')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.schoolLevelsService.delete(id, tenantId);
  }

  @Post('initialize')
  @Roles('admin', 'director')
  @Permissions('school-levels.manage')
  initializeDefaults(@TenantId() tenantId: string) {
    return this.schoolLevelsService.initializeDefaults(tenantId);
  }
}

