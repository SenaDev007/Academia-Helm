/**
 * Extension — Contrôle & Audit : anomalies financières et log d'audit
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceAuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ FIX 2026-09-09 (« bascule d'année globale ») : filtre année optionnel.
   * FinancialAnomaly n'a pas de colonne academicYearId — on filtre par la
   * PÉRIODE de l'année scolaire (detectedAt ∈ [startDate, endDate]) ; si
   * l'année n'a pas de bornes, on retombe sur le comportement historique
   * (toutes les anomalies du tenant).
   */
  private async anomalyYearFilter(tenantId: string, academicYearId?: string) {
    if (!academicYearId) return {};
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { startDate: true, endDate: true },
    });
    if (!year?.startDate || !year?.endDate) return {};
    return { detectedAt: { gte: year.startDate, lte: year.endDate } };
  }

  @Get('anomalies')
  async getAnomalies(
    @TenantId() tenantId: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const where: Record<string, any> = { tenantId, ...(await this.anomalyYearFilter(tenantId, academicYearId)) };
    if (resolved === 'true') where.resolved = true;
    if (resolved === 'false') where.resolved = false;
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return this.prisma.financialAnomaly.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take,
    });
  }

  @Get('audit-logs')
  async getAuditLogs(
    @TenantId() tenantId: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
  ) {
    const where: { tenantId: string; entityType?: string } = { tenantId };
    if (entityType) where.entityType = entityType;
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return this.prisma.financialAuditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take,
      include: { performer: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
