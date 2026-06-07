import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ExamsConfigService } from './services/exams-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('institutional-exams/config')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamsConfigController {
  constructor(private readonly configService: ExamsConfigService) {}

  @Get('evaluation-types')
  @Permissions('settings.read')
  async getTypes(@TenantId() tenantId: string) {
    return this.configService.getEvaluationTypes(tenantId);
  }

  @Post('evaluation-types')
  @Permissions('settings.manage')
  async createType(@TenantId() tenantId: string, @Body() data: any) {
    return this.configService.createEvaluationType(tenantId, data);
  }

  @Get('grade-scales')
  @Permissions('settings.read')
  async getScales(@TenantId() tenantId: string) {
    return this.configService.getGradeScales(tenantId);
  }

  @Post('grade-scales')
  @Permissions('settings.manage')
  async createScale(@TenantId() tenantId: string, @Body() data: any) {
    return this.configService.createGradeScale(tenantId, data);
  }
}
