/**
 * ============================================================================
 * COMPLIANCE CONTROLLER - CONFORMITÉ DONNÉES SCOLAIRES
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantValidationGuard } from '../common/guards/tenant-validation.guard';
import { TenantIsolationGuard } from '../common/guards/tenant-isolation.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('compliance')
@UseGuards(
  JwtAuthGuard,
  TenantValidationGuard,
  TenantIsolationGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('consent')
  @Permissions('compliance.manage')
  async recordConsent(
    @Body() body: { consentType: string; consented: boolean },
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.recordConsent(
      tenantId,
      user.id,
      body.consentType,
      body.consented,
    );
  }

  @Get('consent/:consentType')
  @Permissions('compliance.read')
  async checkConsent(
    @Param('consentType') consentType: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return {
      hasConsent: await this.complianceService.hasConsent(
        tenantId,
        user.id,
        consentType,
      ),
    };
  }

  @Post('export')
  @Permissions('compliance.export')
  async exportData(
    @Body() body: { exportType?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.exportUserData(
      tenantId,
      user.id,
      body.exportType || 'full',
    );
  }

  @Post('delete')
  @Permissions('compliance.delete')
  async deleteData(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    await this.complianceService.deleteUserData(tenantId, user.id);
    return { message: 'Data deletion request processed' };
  }
}

