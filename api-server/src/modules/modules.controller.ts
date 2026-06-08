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
  UseInterceptors,
} from '@nestjs/common';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
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
import { ModuleType } from './entities/module.entity';

@Controller('modules')
@UseGuards(
  JwtAuthGuard,
  TenantValidationGuard,
  TenantIsolationGuard,
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post()
  @Roles('admin', 'director')
  @Permissions('modules.create', 'modules.manage')
  create(
    @Body() createModuleDto: CreateModuleDto,
    @TenantId() tenantId: string,
  ) {
    return this.modulesService.create(createModuleDto, tenantId);
  }

  @Get()
  @Permissions('modules.read', 'modules.manage')
  findAll(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    if (activeOnly) {
      return this.modulesService.findActive(tenantId, schoolLevelId);
    }
    return this.modulesService.findAll(tenantId, schoolLevelId);
  }

  @Get('by-type/:type')
  @Permissions('modules.read', 'modules.manage')
  findByType(
    @Param('type') type: ModuleType,
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.modulesService.findByType(tenantId, type, schoolLevelId);
  }

  @Get(':id')
  @Permissions('modules.read', 'modules.manage')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.modulesService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('admin', 'director')
  @Permissions('modules.update', 'modules.manage')
  update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @TenantId() tenantId: string,
  ) {
    return this.modulesService.update(id, updateModuleDto, tenantId);
  }

  @Patch(':id/toggle')
  @Roles('admin', 'director')
  @Permissions('modules.update', 'modules.manage')
  toggleModule(
    @Param('id') id: string,
    @Body() body: { isEnabled: boolean },
    @TenantId() tenantId: string,
  ) {
    return this.modulesService.toggleModule(id, tenantId, body.isEnabled);
  }

  @Get(':id/dependencies')
  @Permissions('modules.read', 'modules.manage')
  async checkDependencies(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId: string,
  ) {
    const module = await this.modulesService.findOne(id, tenantId);
    return this.modulesService.checkDependencies(
      tenantId,
      module.type,
      schoolLevelId,
    );
  }

  @Delete(':id')
  @Roles('admin', 'director')
  @Permissions('modules.delete', 'modules.manage')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.modulesService.delete(id, tenantId);
  }

  @Post('initialize')
  @Roles('admin', 'director')
  @Permissions('modules.manage')
  initializeDefaults(
    @Body() body: { schoolLevelId: string },
    @TenantId() tenantId: string,
  ) {
    return this.modulesService.initializeDefaults(tenantId, body.schoolLevelId);
  }
}

