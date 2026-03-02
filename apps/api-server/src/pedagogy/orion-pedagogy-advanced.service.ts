/**
 * ORION PEDAGOGY ADVANCED SERVICE - SM8
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrionPedagogyAdvancedService {
  constructor(private readonly prisma: PrismaService) {}

  async findInsights(
    tenantId: string,
    academicYearId: string,
    filters?: { scopeType?: string; severity?: string }
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.scopeType) where.scopeType = filters.scopeType;
    if (filters?.severity) where.severity = filters.severity;
    return this.prisma.orionPedagogicalInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findRiskFlags(
    tenantId: string,
    academicYearId: string,
    filters?: { entityType?: string; level?: string }
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.level) where.level = filters.level;
    return this.prisma.orionRiskFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findForecasts(
    tenantId: string,
    academicYearId: string,
    filters?: { entityType?: string }
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.entityType) where.entityType = filters.entityType;
    return this.prisma.orionForecast.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 100,
    });
  }

  async getOrionDashboard(tenantId: string, academicYearId: string) {
    if (!academicYearId) {
      return { insights: [], riskFlags: [], forecasts: [], summary: null };
    }
    const [insights, riskFlags, forecasts] = await Promise.all([
      this.findInsights(tenantId, academicYearId),
      this.findRiskFlags(tenantId, academicYearId),
      this.findForecasts(tenantId, academicYearId),
    ]);

    const criticalCount = riskFlags.filter((r) => r.level === 'RED').length;
    const yellowCount = riskFlags.filter((r) => r.level === 'YELLOW').length;

    return {
      insights,
      riskFlags,
      forecasts,
      summary: {
        insightsCount: insights.length,
        riskFlagsCount: riskFlags.length,
        criticalRisks: criticalCount,
        warningRisks: yellowCount,
        forecastsCount: forecasts.length,
      },
    };
  }
}
