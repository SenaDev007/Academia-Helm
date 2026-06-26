/**
 * Phase 4: Sync endpoint — get real-time stats from existing modules
 * GET /api/tenant-website/sync-stats
 * Returns: studentCount, staffCount, teacherCount, activeLevels, etc.
 */

import { Controller, Get, UseGuards, BadRequestException } from '@nestjs/common';
import { TenantWebsiteService } from './tenant-website.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('tenant-website')
export class TenantWebsiteSyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteService: TenantWebsiteService,
  ) {}

  /**
   * GET /api/tenant-website/sync-stats
   * Récupère les statistiques en temps réel depuis les modules existants
   * pour alimenter les chiffres clés du site institutionnel.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('sync-stats')
  async getSyncStats(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');

    const [studentCount, staffCount, teacherCount, publishedNewsCount, upcomingEventsCount] = await Promise.all([
      // Total élèves actifs
      this.prisma.student.count({
        where: { tenantId: tid, status: 'ACTIVE' },
      }).catch(() => 0),
      // Total personnel actif (hors promoteur)
      this.prisma.staff.count({
        where: { tenantId: tid, status: { not: 'ARCHIVED' }, roleType: { not: 'PROMOTEUR' } },
      }).catch(() => 0),
      // Total enseignants
      this.prisma.teacher.count({
        where: { tenantId: tid, status: 'active' },
      }).catch(() => 0),
      // Actualités publiées
      this.prisma.tenantNewsArticle.count({
        where: { tenantId: tid, status: 'PUBLISHED' },
      }).catch(() => 0),
      // Événements à venir
      this.prisma.tenantEvent.count({
        where: { tenantId: tid, status: 'UPCOMING', startDate: { gte: new Date() } },
      }).catch(() => 0),
    ]);

    // Niveaux scolaires actifs
    let activeLevels: string[] = [];
    try {
      const levels = await this.prisma.schoolLevel.findMany({
        where: { tenantId: tid },
        select: { name: true, label: true },
      });
      activeLevels = levels.map(l => l.label || l.name);
    } catch {}

    return {
      studentCount,
      staffCount,
      teacherCount,
      publishedNewsCount,
      upcomingEventsCount,
      activeLevels,
    };
  }
}
