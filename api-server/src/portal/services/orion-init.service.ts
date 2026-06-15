/**
 * ============================================================================
 * ORION INIT SERVICE - INITIALISATION ORION À LA CONNEXION
 * ============================================================================
 * 
 * Service pour initialiser ORION lors de la connexion d'un directeur/promoteur
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KPICalculationService } from '../../orion/services/kpi-calculation.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import { OrionDashboardService } from '../../orion/services/orion-dashboard.service';

@Injectable()
export class OrionInitService {
  private readonly logger = new Logger(OrionInitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiService: KPICalculationService,
    private readonly alertsService: OrionAlertsService,
    private readonly dashboardService: OrionDashboardService,
  ) {}

  /**
   * Initialise ORION pour un utilisateur (directeur/promoteur)
   * Appelé automatiquement au login
   */
  async initializeOrion(
    tenantId: string,
    userId: string,
    portalType: 'SCHOOL' | 'TEACHER' | 'PARENT',
  ) {
    // Vérifier si l'utilisateur est directeur/promoteur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Seuls les directeurs/promoteurs déclenchent ORION
    const orionRoles = ['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN'];
    if (!orionRoles.includes(user.role || '')) {
      this.logger.debug(`User ${userId} is not a director, skipping ORION init`);
      return null;
    }

    // Récupérer l'année scolaire active
    const activeAcademicYear = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    const academicYearId = activeAcademicYear?.id;

    // Générer les KPIs
    let kpisGenerated = false;
    try {
      await this.kpiService.calculateSystemKPIs(tenantId, academicYearId);
      kpisGenerated = true;
      this.logger.log(`KPIs generated for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to generate KPIs for tenant ${tenantId}`, error);
    }

    // Générer les alertes
    let alertsGenerated = false;
    try {
      await this.alertsService.generateAllAlerts(tenantId, academicYearId);
      alertsGenerated = true;
      this.logger.log(`Alerts generated for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to generate alerts for tenant ${tenantId}`, error);
    }

    // Logger l'accès ORION
    const accessLog = await this.prisma.orionAccessLog.create({
      data: {
        tenantId,
        userId,
        portalType,
        kpisGenerated,
        alertsGenerated,
      },
    });

    this.logger.log(`ORION initialized for tenant ${tenantId}, user ${userId}`);

    return accessLog;
  }

  /**
   * Récupère les KPIs ORION pour un tenant
   */
  async getOrionKPIs(tenantId: string, academicYearId?: string, schoolLevelId?: string) {
    try {
      const kpis = await this.kpiService.calculateSystemKPIs(tenantId, academicYearId, schoolLevelId);
      return kpis;
    } catch (error) {
      this.logger.error(`Failed to get KPIs for tenant ${tenantId}`, error);
      return [];
    }
  }

  /**
   * Récupère les alertes ORION pour un tenant
   */
  async getOrionAlerts(tenantId: string, academicYearId?: string) {
    try {
      const alerts = await this.alertsService.getActiveAlerts(tenantId, {
        academicYearId,
        acknowledged: false,
      });
      return alerts;
    } catch (error) {
      this.logger.error(`Failed to get alerts for tenant ${tenantId}`, error);
      return [];
    }
  }

  /**
   * Récupère toutes les données du dashboard ORION
   */
  async getOrionDashboard(tenantId: string, academicYearId?: string, schoolLevelId?: string) {
    try {
      return await this.dashboardService.getDashboardData(tenantId, academicYearId, schoolLevelId);
    } catch (error) {
      this.logger.error(`Failed to get dashboard for tenant ${tenantId}`, error);
      return null;
    }
  }
}

