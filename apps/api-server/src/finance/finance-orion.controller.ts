/**
 * ============================================================================
 * FINANCE ORION CONTROLLER
 * ============================================================================
 * 
 * API endpoints pour les KPIs et alertes ORION du Module 4
 * 
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FinanceOrionService } from './finance-orion.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('api/finance/orion')
@UseGuards(JwtAuthGuard)
export class FinanceOrionController {
  constructor(private readonly orionService: FinanceOrionService) {}

  /**
   * Récupère les KPIs des notifications de reçus
   */
  @Get('receipt-notifications/kpis')
  async getReceiptNotificationKPIs(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.getReceiptNotificationKPIs(
      user.tenantId || '',
      academicYearId,
    );
  }

  /**
   * Génère les alertes pour les notifications de reçus
   */
  @Get('receipt-notifications/alerts')
  async getReceiptNotificationAlerts(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.generateReceiptNotificationAlerts(
      user.tenantId || '',
      academicYearId,
    );
  }

  /**
   * Génère les alertes pour les arriérés inter-années
   */
  @Get('arrears/alerts')
  async getArrearAlerts(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionService.generateArrearAlerts(
      user.tenantId || '',
      academicYearId,
    );
  }

  @Get('reductions/alerts')
  async getReductionAlerts(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionService.generateReductionAlerts(
      user.tenantId || '',
      academicYearId,
    );
  }

  /**
   * Endpoint agrégé pour toutes les alertes ORION du Module Finance
   */
  @Get('alerts')
  async getCombinedAlerts(
    @CurrentUser() user: User,
    @Query('academicYearId') academicYearId: string,
  ) {
    const tenantId = user.tenantId || '';
    
    // On agrège en parallèle pour la performance
    const [notifAlerts, arrearAlerts, reductionAlerts, anomalies] = await Promise.all([
      this.orionService.generateReceiptNotificationAlerts(tenantId, academicYearId),
      this.orionService.generateArrearAlerts(tenantId, academicYearId),
      this.orionService.generateReductionAlerts(tenantId, academicYearId),
      this.orionService.detectAnomalies(tenantId, academicYearId),
    ]);

    return [...notifAlerts, ...arrearAlerts, ...reductionAlerts, ...anomalies];
  }
}


