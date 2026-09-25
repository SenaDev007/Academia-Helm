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
   * GET /api/tenant-website/public/:tenantSlug/school-levels
   * Renvoie la liste des niveaux scolaires ACTIFS pour ce tenant.
   * Utilisé par le site institutionnel public pour n'afficher que les
   * programmes correspondant aux niveaux réellement configurés par l'école
   * (ex: une école sans secondaire ne verra pas la carte "Secondaire").
   *
   * Réponse: [{ code, name, label, order }]
   *  - code : 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE'
   *  - name : nom court (ex: 'Maternelle')
   *  - label : libellé long (ex: 'Maternelle — PS & GS')
   *  - order : pour trier l'affichage
   */
  @Public()
  @Get('public/:tenantSlug/school-levels')
  async getPublicSchoolLevels(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Établissement introuvable');

    try {
      const levels = await this.prisma.schoolLevel.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { code: true, name: true, label: true, order: true },
        orderBy: { order: 'asc' },
      });
      return levels.map((l: any) => ({
        code: l.code,
        name: l.name,
        label: l.label || l.name,
        order: l.order ?? 0,
      }));
    } catch (err: any) {
      // Si la colonne isActive n'existe pas (vieille DB) — fallback : tous les niveaux
      try {
        const levels = await this.prisma.schoolLevel.findMany({
          where: { tenantId: tenant.id },
          select: { code: true, name: true, label: true, order: true },
          orderBy: { order: 'asc' },
        });
        return levels.map((l: any) => ({
          code: l.code,
          name: l.name,
          label: l.label || l.name,
          order: l.order ?? 0,
        }));
      } catch {
        return [];
      }
    }
  }

  /**
   * GET /api/tenant-website/public/:tenantSlug/faculty
   * Renvoie la liste des enseignants actifs (roleType=TEACHER) pour le site
   * institutionnel public. Inclut leur photo (StaffPhoto.thumbnailUrl) si
   * disponible, et leur poste (position) qui peut être "Directeur/trice",
   * "Directeur pédagogique", etc.
   *
   * ⚠️ PUBLIC (sans auth) : on ne sélectionne QUE des champs publics —
   * jamais d'email, de téléphone, d'adresse, de salaire, etc.
   *
   * Réponse: [{ id, firstName, lastName, position, subject, photoUrl }]
   *  - position : depuis Staff.position (ex: "Directeur pédagogique",
   *    "Responsable Primaire", "Enseignant" si vide)
   *  - subject : depuis Staff.department (ex: "Mathématiques")
   *  - photoUrl : StaffPhoto.thumbnailUrl (ou null)
   *
   * Limité à 12 enseignants (suffit pour la grille 2x4 / 3x4 sur le site).
   */
  @Public()
  @Get('public/:tenantSlug/faculty')
  async getPublicFaculty(@Param('tenantSlug') tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { subdomain: tenantSlug }],
        status: { in: ['active', 'trial'] },
      },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Établissement introuvable');

    try {
      // Staff avec roleType TEACHER + status actif
      const teachers = await this.prisma.staff.findMany({
        where: {
          tenantId: tenant.id,
          roleType: 'TEACHER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          department: true,
          photo: { select: { thumbnailUrl: true, originalUrl: true } },
        },
        take: 12,
        orderBy: { lastName: 'asc' },
      }).catch(() => []);

      return teachers.map((t: any) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        name: `${t.firstName} ${t.lastName}`.trim(),
        position: t.position || 'Enseignant',
        subject: t.department || null,
        photoUrl: t.photo?.thumbnailUrl || t.photo?.originalUrl || null,
      }));
    } catch {
      return [];
    }
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
