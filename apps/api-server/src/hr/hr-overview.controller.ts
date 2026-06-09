/**
 * ============================================================================
 * HR OVERVIEW CONTROLLER - MODULE 5
 * ============================================================================
 *
 * Controller pour le cockpit RH (Onglet 1)
 *
 * Chaque sous-requête (snapshot, evolution, orion) est wrappée dans un
 * try/catch pour garantir que le dashboard renvoie toujours un résultat
 * partiel plutôt qu'une erreur 500 complète.
 *
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HrKpiService } from './hr-kpi.service';
import { HROrionService } from './services/hr-orion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

const DEFAULT_SNAPSHOT = {
  totalStaff: 0,
  totalTeachers: 0,
  totalAdmin: 0,
  monthlyPayroll: 0,
  cnssCharges: 0,
  leaveCount: 0,
  calculatedAt: null,
};

@Controller('hr/overview')
@UseGuards(JwtAuthGuard, TenantGuard)
export class HrOverviewController {
  constructor(
    private readonly hrKpiService: HrKpiService,
    private readonly hrOrionService: HROrionService,
  ) {}

  /**
   * Récupère les données consolidées pour le dashboard RH
   *
   * Résilient : chaque sous-requête est isolée pour éviter qu'une erreur
   * dans un service ne bloque l'ensemble du dashboard.
   */
  @Get('dashboard')
  async getDashboardData(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tenantId = tenant?.id ?? tenantIdFallback;

    // Snapshot KPI — isolé
    let snapshot = DEFAULT_SNAPSHOT;
    try {
      if (tenantId) {
        snapshot = await this.hrKpiService.generateSnapshot(tenantId, academicYearId);
      }
    } catch (err: any) {
      console.error('[HR Overview] generateSnapshot failed:', err?.message || err);
    }

    // Payroll evolution — isolé
    let evolution: any[] = [];
    try {
      if (tenantId) {
        evolution = await this.hrKpiService.getPayrollEvolution(tenantId, academicYearId);
      }
    } catch (err: any) {
      console.error('[HR Overview] getPayrollEvolution failed:', err?.message || err);
    }

    // ORION alerts — isolé
    let orionAlerts: any[] = [];
    try {
      if (tenantId) {
        const orionData = await this.hrOrionService.getPayrollAndTaxKPIs(tenantId, academicYearId);
        orionAlerts = orionData?.alerts || [];
      }
    } catch (err: any) {
      console.error('[HR Overview] getPayrollAndTaxKPIs failed:', err?.message || err);
    }

    return {
      snapshot,
      evolution,
      orionAlerts,
    };
  }

  /**
   * Données détaillées pour l'onglet Rapports
   */
  @Get('analytics')
  async getAnalytics(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tenantId = tenant?.id ?? tenantIdFallback;

    const results = await Promise.allSettled([
      this.hrKpiService.getPayrollEvolution(tenantId, academicYearId),
      this.hrKpiService.getStaffDistribution(tenantId),
      this.hrKpiService.generateSnapshot(tenantId, academicYearId),
    ]);

    return {
      evolution: results[0].status === 'fulfilled' ? results[0].value : [],
      distribution: results[1].status === 'fulfilled' ? results[1].value : [],
      snapshot: results[2].status === 'fulfilled' ? results[2].value : DEFAULT_SNAPSHOT,
    };
  }

  /**
   * Force le recalcul du snapshot
   */
  @Get('refresh-snapshot')
  async refreshSnapshot(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.hrKpiService.generateSnapshot(tid, academicYearId);
  }
}
