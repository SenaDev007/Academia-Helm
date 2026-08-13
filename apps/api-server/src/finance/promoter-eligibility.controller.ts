import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Logger,
} from '@nestjs/common';
import { PromoterEligibilityService } from './promoter-eligibility.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * ============================================================================
 * PROMOTER ELIGIBILITY CONTROLLER — Endpoints pour gérer les élèves
 * "paiement direct au fondateur"
 * ============================================================================
 *
 * POST   /api/finance/promoter-eligibility/activate
 *   Active le flag pour un élève (avec motif obligatoire)
 *   Body: { studentId, academicYearId, motif, expectedDate? }
 *
 * POST   /api/finance/promoter-eligibility/deactivate
 *   Désactive le flag (toggle off)
 *   Body: { studentId, academicYearId }
 *
 * GET    /api/finance/promoter-eligibility?academicYearId=...
 *   Liste tous les élèves marqués actifs (sous-onglet "Reçu par le fondateur")
 *
 * GET    /api/finance/promoter-eligibility/check?studentId=...&academicYearId=...
 *   Vérifie si un élève est marqué (pour afficher le toggle sur la ligne)
 *
 * ⭐ Sécurité multi-tenant : tenantId extrait du JWT, jamais du body.
 * ============================================================================
 */
@Controller('finance/promoter-eligibility')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PromoterEligibilityController {
  private readonly logger = new Logger(PromoterEligibilityController.name);

  constructor(private readonly service: PromoterEligibilityService) {}

  /**
   * Active le flag "paiement fondateur" pour un élève.
   */
  @Post('activate')
  async activate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      academicYearId: string;
      motif: string;
      expectedDate?: string;
    },
  ) {
    this.logger.log(`Activate promoter eligibility: tenant=${tenantId}, student=${body.studentId}, user=${user?.id}`);
    return this.service.activate(tenantId, user?.id ?? '', body);
  }

  /**
   * Désactive le flag (toggle off).
   */
  @Post('deactivate')
  async deactivate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { studentId: string; academicYearId: string },
  ) {
    this.logger.log(`Deactivate promoter eligibility: tenant=${tenantId}, student=${body.studentId}, user=${user?.id}`);
    return this.service.deactivate(tenantId, user?.id ?? '', body.studentId, body.academicYearId);
  }

  /**
   * Liste tous les élèves marqués actifs (sous-onglet "Reçu par le fondateur").
   */
  @Get()
  async listActive(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      return [];
    }
    return this.service.listActive(tenantId, academicYearId);
  }

  /**
   * Vérifie si un élève est marqué (pour le toggle sur la ligne).
   */
  @Get('check')
  async check(
    @TenantId() tenantId: string,
    @Query('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!studentId || !academicYearId) {
      return { isActive: false };
    }
    return this.service.isEligible(tenantId, studentId, academicYearId);
  }

  /**
   * Récupère en masse les statuts d'éligibilité pour une liste d'élèves.
   * Utilisé par Compte Élèves pour afficher tous les toggles en une seule requête.
   */
  @Get('bulk-check')
  async bulkCheck(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('studentIds') studentIds: string,
  ) {
    if (!academicYearId || !studentIds) {
      return { eligibleStudentIds: [] };
    }
    const ids = studentIds.split(',').filter(Boolean);
    const activeIds = await this.service.getActiveStudentIds(tenantId, academicYearId);
    return {
      eligibleStudentIds: ids.filter((id) => activeIds.has(id)),
    };
  }
}
