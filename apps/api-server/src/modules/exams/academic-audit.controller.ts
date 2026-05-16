import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AcademicAuditService } from './services/academic-audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('api/institutional-exams/audit')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AcademicAuditController {
  constructor(private readonly auditService: AcademicAuditService) {}

  @Get('logs')
  @Permissions('exams.audit')
  async getLogs(
    @TenantId() tenantId: string,
    @Query() filters: any
  ) {
    return this.auditService.getAuditLogs(tenantId, filters);
  }

  @Get('corrections')
  @Permissions('exams.audit')
  async getCorrections(@TenantId() tenantId: string) {
    return this.auditService.getCorrectionRequests(tenantId);
  }
}
