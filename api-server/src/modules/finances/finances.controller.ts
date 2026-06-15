/**
 * ============================================================================
 * FINANCES CONTROLLER - ENDPOINTS PAR MODULE FINANCES
 * ============================================================================
 * 
 * Controller dédié au module FINANCES avec :
 * - Endpoints de calcul par niveau
 * - Isolation stricte par tenant + school_level
 * - Logs d'audit obligatoires
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FinancesCalculationService } from './services/finances-calculation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ContextValidationGuard } from '../../common/guards/context-validation.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../../common/decorators/school-level-id.decorator';
import { ModuleTypeParam } from '../../common/decorators/module-type.decorator';
import { ModuleTypeRequired } from '../../common/decorators/module-type.decorator';
import { ModuleType } from '../../modules/entities/module.entity';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@Controller('finances')
@UseGuards(
  JwtAuthGuard,
  ContextValidationGuard, // Valide tenant + school_level + module
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
@ModuleTypeRequired(ModuleType.FINANCES) // Module FINANCES requis
export class FinancesController {
  constructor(
    private readonly financesCalculationService: FinancesCalculationService,
  ) {}

  /**
   * GET /api/finances/summary
   * Bilan financier complet pour un niveau scolaire
   */
  @Get('summary')
  @Permissions('finance.read', 'finance.manage')
  async getFinancialSummary(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @ModuleTypeParam() moduleType: ModuleType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const context = {
      tenantId,
      schoolLevelId,
      moduleType,
    };

    return this.financesCalculationService.calculateFinancialSummary(
      context,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * GET /api/finances/revenue-by-period
   * Revenus par période (mois, trimestre, année) pour un niveau
   */
  @Get('revenue-by-period')
  @Permissions('finance.read', 'finance.manage')
  async getRevenueByPeriod(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @ModuleTypeParam() moduleType: ModuleType,
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
  ) {
    const context = {
      tenantId,
      schoolLevelId,
      moduleType,
    };

    return this.financesCalculationService.calculateRevenueByPeriod(
      context,
      period,
    );
  }
}

