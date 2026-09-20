/**
 * Phase 4: Sync endpoint — get real-time stats from existing modules
 * GET /api/tenant-website/sync-stats            — auth requise (admin back-office)
 * GET /api/tenant-website/public/:tenantSlug/stats — public (site institutionnel)
 * Returns: studentCount, staffCount, teacherCount, activeLevels, etc.
 */

import { Controller, Get, UseGuards, BadRequestException, Param } from '@nestjs/common';
import { TenantWebsiteService } from './tenant-website.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

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

    return this._computeStats(tid);
  }

  /**
   * GET /api/tenant-website/public/:tenantSlug/stats
   * Variante PUBLIQUE (sans auth) des stats temps réel, pour le site
   * institutionnel public. Le visiteur non authentifié récupère les
   * mêmes compteurs (élèves, enseignants, etc.) que l'admin — mais
   * uniquement le décompte public, jamais les données personnelles.
   *
   * Le slug est résolu via la table `tenants` (slug ou subdomain).
   */
  @Public()
  @Get('public/:tenantSlug/stats')
  async getPublicSyncStats(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Établissement introuvable');
    return this._computeStats(tenant.id);
  }

  /**
   * Compute real-time stats for a tenant — shared by both auth and public
   * endpoints. Toutes les requêtes sont catchées pour éviter qu'un échec
   * partiel (table absente, etc.) ne casse l'endpoint.
   */
  private async _computeStats(tid: string) {
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

    // Ratio encadrant/élève (si > 0 élèves)
    const ratio = studentCount > 0
      ? Math.round((staffCount / studentCount) * 10) / 10 // 1 décimale
      : 0;

    return {
      studentCount,
      staffCount,
      teacherCount,
      publishedNewsCount,
      upcomingEventsCount,
      activeLevels,
      // Ratio arrondi à 1 décimale (ex: 0.04 → 0.04 enseignants/élève → "1 pour 25")
      // On l'exprime plutôt sous forme "1:X" côté frontend pour plus de clarté.
      facultyRatio: ratio,
      // Compteur des niveaux actifs
      levelsCount: activeLevels.length,
      // Date de génération (pour debug/cache)
      generatedAt: new Date().toISOString(),
    };
  }
}
