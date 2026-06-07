/**
 * ============================================================================
 * SCOLARITE CONTROLLER - ENDPOINTS PAR MODULE SCOLARITE
 * ============================================================================
 * 
 * Controller dédié au module SCOLARITE avec :
 * - Endpoints de calcul par niveau
 * - Isolation stricte par tenant + school_level
 * - Logs d'audit obligatoires
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScolariteCalculationService } from './services/scolarite-calculation.service';
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

@Controller('scolarite')
@UseGuards(
  JwtAuthGuard,
  ContextValidationGuard, // Valide tenant + school_level + module
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
@ModuleTypeRequired(ModuleType.SCOLARITE) // Module SCOLARITE requis
export class ScolariteController {
  constructor(
    private readonly scolariteCalculationService: ScolariteCalculationService,
  ) {}

  /**
   * GET /api/scolarite/statistics
   * Statistiques complètes du module SCOLARITE pour un niveau
   */
  @Get('statistics')
  @Permissions('students.read', 'students.manage')
  async getStatistics(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @ModuleTypeParam() moduleType: ModuleType,
  ) {
    const context = {
      tenantId,
      schoolLevelId,
      moduleType,
    };

    return this.scolariteCalculationService.calculateStatistics(context);
  }

  /**
   * GET /api/scolarite/statistics/class/:classId
   * Statistiques par classe pour un niveau
   */
  @Get('statistics/class/:classId')
  @Permissions('students.read', 'students.manage')
  async getStatisticsByClass(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @ModuleTypeParam() moduleType: ModuleType,
  ) {
    const context = {
      tenantId,
      schoolLevelId,
      moduleType,
    };

    return this.scolariteCalculationService.calculateStatisticsByClass(
      context,
      classId,
    );
  }
}

