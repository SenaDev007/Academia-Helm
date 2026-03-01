/**
 * Extension — Contrôle & Audit : anomalies financières et log d'audit
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('api/finance')
@UseGuards(JwtAuthGuard)
export class FinanceAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('anomalies')
  async getAnomalies(
    @TenantId() tenantId: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    const where: { tenantId: string; resolved?: boolean } = { tenantId };
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
