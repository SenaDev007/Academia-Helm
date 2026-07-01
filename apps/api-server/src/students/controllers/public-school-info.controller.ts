/**
 * ============================================================================
 * PUBLIC SCHOOL INFO CONTROLLER — Portail public d'admission
 * ============================================================================
 *
 * Endpoint public (sans authentification) permettant au portail public d'admission
 * de récupérer les niveaux scolaires et classes configurés par l'établissement,
 * afin de construire dynamiquement le formulaire (cartes de niveaux + select classes).
 *
 * Rien n'est codé en dur côté frontend — tout est récupéré depuis la DB du tenant.
 *
 * Endpoints:
 *   GET /students/admissions-public/school-info/:tenantIdentifier
 *     → Retourne { schoolLevels: [{id, name, code}], classes: [{id, name, code, schoolLevelId}] }
 *     → tenantIdentifier peut être un UUID, un slug ou un subdomain
 *
 *   GET /students/admissions-public/school-info/:tenantIdentifier/classes?schoolLevelId=xxx
 *     → Retourne uniquement les classes pour un niveau donné (filtre)
 * ============================================================================
 */

import {
  Controller, Get, Param, Query, UseGuards, Logger, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('students/admissions-public')
@UseGuards(JwtAuthGuard)
export class PublicSchoolInfoController {
  private readonly logger = new Logger(PublicSchoolInfoController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout un identifier de tenant (UUID / slug / subdomain) vers un tenantId UUID.
   * Évite la duplication de logique entre les endpoints.
   */
  private async resolveTenantId(identifier: string): Promise<string> {
    if (!identifier) {
      throw new BadRequestException('tenantIdentifier est requis');
    }

    // UUID ?
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) {
      return identifier;
    }

    // Sinon résoudre par slug ou subdomain
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        status: { not: 'WITHDRAWN' },
        OR: [{ subdomain: identifier }, { slug: identifier }],
      },
      select: { id: true },
    });
    if (!tenant) {
      throw new BadRequestException(`Établissement introuvable pour "${identifier}"`);
    }
    return tenant.id;
  }

  /**
   * GET /students/admissions-public/school-info/:tenantIdentifier
   *
   * Retourne les niveaux scolaires (school_levels) et les classes configurés
   * par l'établissement. Utilisé par le portail public pour construire
   * dynamiquement les cartes de niveaux + le select de classes.
   */
  @Public()
  @Get('school-info/:tenantIdentifier')
  async getSchoolInfo(@Param('tenantIdentifier') tenantIdentifier: string) {
    const tenantId = await this.resolveTenantId(tenantIdentifier);

    // 1. Récupérer les niveaux scolaires (school_levels) du tenant
    //    Tri : Maternelle < Primaire < Secondaire < Autre
    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true },
    });

    // 2. Récupérer toutes les classes du tenant
    //    On ne filtre PAS par academicYearId ici : on veut toutes les classes
    //    structurantes de l'établissement, pas seulement celles de l'année active.
    //    Le portail public n'a pas connaissance de l'année académique.
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        schoolLevelId: true,
      },
      orderBy: { name: 'asc' },
    });

    // 3. Trier les niveaux par ordre pédagogique (Maternelle < Primaire < Secondaire)
    const levelOrder = (name: string) => {
      const n = (name || '').toUpperCase();
      if (n.includes('MATERNELLE')) return 0;
      if (n.includes('PRIMAIRE')) return 1;
      if (n.includes('SECONDAIRE')) return 2;
      return 3;
    };
    schoolLevels.sort((a, b) => levelOrder(a.name) - levelOrder(b.name));

    this.logger.log(
      `getSchoolInfo: tenant=${tenantId} → ${schoolLevels.length} niveau(x), ${classes.length} classe(s)`,
    );

    return {
      schoolLevels: schoolLevels.map(sl => ({
        id: sl.id,
        name: sl.name,
        code: sl.code,
      })),
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        schoolLevelId: c.schoolLevelId,
      })),
    };
  }

  /**
   * GET /students/admissions-public/school-info/:tenantIdentifier/classes?schoolLevelId=xxx
   *
   * Retourne uniquement les classes pour un niveau scolaire donné.
   * Utile si le frontend veut fetch les classes après sélection du niveau
   * (plutôt qu'en une seule fois au mount).
   */
  @Public()
  @Get('school-info/:tenantIdentifier/classes')
  async getClassesByLevel(
    @Param('tenantIdentifier') tenantIdentifier: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    const tenantId = await this.resolveTenantId(tenantIdentifier);

    const where: any = { tenantId };
    if (schoolLevelId) {
      where.schoolLevelId = schoolLevelId;
    }

    const classes = await this.prisma.class.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        schoolLevelId: true,
      },
      orderBy: { name: 'asc' },
    });

    this.logger.log(
      `getClassesByLevel: tenant=${tenantId} schoolLevelId=${schoolLevelId || 'ALL'} → ${classes.length} classe(s)`,
    );

    return classes.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      schoolLevelId: c.schoolLevelId,
    }));
  }
}
