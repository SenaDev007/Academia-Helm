/**
 * FederisPatronatService — API connectée de l'espace patronat
 *
 * Conforme au cahier des charges Academia Federis :
 *  - Profil patronat avec hiérarchie (national → territorial) multi-pays
 *  - Dashboard : cockpit institutionnel orienté décision (aucune saisie)
 *  - Patronats territoriaux (visibles du niveau national uniquement)
 *  - Écoles rattachées (demande de rattachement Helm, école manuelle)
 *  - Abonnement par année scolaire (Essentiel / Institution) + Fedapay
 *  - ORION : lecture seule — détection d'anomalies d'inscription et risques
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { normalizePatronatFunction, patronatFunctionLabel } from './federis-roles';
import { FederisFedapayService } from './federis-fedapay.service';

/** Offres Federis (cahier des charges §12 + proposition tarifaire). */
export const FEDERIS_PLANS = {
  ESSENTIEL: {
    code: 'ESSENTIEL',
    name: 'Federis Essentiel',
    amountXOF: 100_000,
    period: 'année scolaire',
    maxSchools: 5,
    maxCandidates: 500,
    maxActiveCampaigns: 1,
  },
  INSTITUTION: {
    code: 'INSTITUTION',
    name: 'Federis Institution',
    amountXOF: 250_000,
    period: 'année scolaire',
    maxSchools: 25,
    maxCandidates: 3_000,
    maxActiveCampaigns: 3,
  },
} as const;

export type FederisPlanCode = keyof typeof FEDERIS_PLANS;

export class CreateChildPatronatDto {
  /**
   * ⚠️ Décorateurs class-validator OBLIGATOIRES : le ValidationPipe global
   * (whitelist + forbidNonWhitelisted) rejette toute propriété sans
   * décorateur (« property X should not exist »).
   */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  territoryName!: string;

  /** Obsolète : Federis est dédié aux patronats — PATRONAT appliqué par défaut */
  @IsOptional()
  @IsIn(['PATRONAT', 'ASSOCIATION', 'ORGANISME'])
  organismType?: 'PATRONAT' | 'ASSOCIATION' | 'ORGANISME';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsibleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class RequestSchoolLinkDto {
  @IsString()
  schoolTenantId!: string;
}

export class CreateManualSchoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;
}

export class InitCheckoutDto {
  /**
   * ⭐ FIX « Property plan should not exist » : le ValidationPipe global
   * (whitelist: true + forbidNonWhitelisted: true, main.ts) rejette toute
   * propriété dépourvue de décorateur class-validator. Sans @IsIn, le POST
   * /federis/patronat/checkout { plan } était rejeté en 400 avant d'atteindre
   * le service — le paiement Fedapay ne pouvait jamais s'initialiser.
   */
  @IsIn(['ESSENTIEL', 'INSTITUTION'])
  plan!: FederisPlanCode;
}

@Injectable()
export class FederisPatronatService {
  private readonly logger = new Logger(FederisPatronatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fedapayService: FederisFedapayService,
  ) {}

  /** Résout le patronat depuis le tenant du JWT (fallback : lien PatronatUser). */
  async resolvePatronat(tenantId: string, userId?: string) {
    let patronat = tenantId
      ? await this.prisma.patronat.findFirst({
          where: { tenantId },
          include: {
            tenant: { select: { id: true, name: true, slug: true, status: true } },
            country: { select: { id: true, code: true, name: true } },
            territorialLevel: { select: { id: true, code: true, label: true, order: true } },
            parentPatronat: {
              select: { id: true, name: true, orgLevel: true, territoryName: true },
            },
          },
        })
      : null;

    if (!patronat && userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { userId, isActive: true },
        select: {
          patronat: {
            include: { tenant: true, country: true, territorialLevel: true, parentPatronat: true },
          },
        },
      });
      patronat = link?.patronat as typeof patronat;
    }
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }
    return patronat;
  }

  /** Profil complet du patronat connecté + statut d'abonnement. */
  async getProfile(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const plan =
      FEDERIS_PLANS[patronat.subscriptionPlan as FederisPlanCode] ?? FEDERIS_PLANS.ESSENTIEL;
    const childrenCount = await this.prisma.patronat.count({
      where: { parentPatronatId: patronat.id },
    });

    // ⭐ Fonction du demandeur dans le patronat (UI Shells par rôle) :
    //    PatronatUser.role (fonction courte) prime, sinon User.role (PATRONAT_*).
    let userRole: string | null = null;
    let userFunction: string | null = null;
    if (userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId: patronat.tenantId, userId, isActive: true },
        select: { role: true },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      userRole = link?.role ?? user?.role ?? null;
      userFunction = normalizePatronatFunction(userRole);
    }

    return {
      id: patronat.id,
      name: patronat.name,
      tenantId: patronat.tenantId,
      orgLevel: patronat.orgLevel,
      scope: patronat.scope,
      territoryName: patronat.territoryName,
      country: patronat.country,
      territorialLevel: patronat.territorialLevel,
      parentPatronat: patronat.parentPatronat,
      childrenCount,
      // ⭐ Fonction du membre connecté (COORDONNATEUR, SECRETAIRE, …) —
      //    pilote le filtrage de la navigation (UI Shells pattern Helm).
      userRole,
      userFunction,
      userFunctionLabel: userFunction ? patronatFunctionLabel(userFunction as any) : null,
      subscription: {
        plan: patronat.subscriptionPlan,
        planLabel: plan.name,
        amountXOF: plan.amountXOF,
        status: patronat.subscriptionStatus,
        period: patronat.subscriptionPeriod,
        startedAt: patronat.subscriptionStartedAt,
        expiresAt: patronat.subscriptionExpiresAt,
        quotas: {
          maxSchools: plan.maxSchools,
          maxCandidates: plan.maxCandidates,
          maxActiveCampaigns: plan.maxActiveCampaigns,
        },
      },
      createdAt: patronat.createdAt,
    };
  }

  /** Année scolaire active du patronat (règle NO ACADEMIC YEAR = NO DATA). */
  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    return year;
  }

  /**
   * Dashboard — cockpit institutionnel (cahier des charges §7.1 / §8.1).
   * Vue macro orientée décision : KPIs + alertes ORION + anomalies.
   */
  async getDashboard(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const academicYear = await this.getActiveYear(patronat.tenantId);

    const [
      joinedSchools,
      pendingSchools,
      manualSchools,
      childPatronats,
      exams,
      candidatesTotal,
      candidatesWithoutCenter,
      duplicateGroups,
      incidents,
    ] = await Promise.all([
      this.prisma.patronatSchool.count({
        where: { patronatId: patronat.id, status: 'JOINED' },
      }),
      this.prisma.patronatSchool.count({
        where: { patronatId: patronat.id, status: 'PENDING' },
      }),
      this.prisma.patronatManualSchool.count({
        where: { patronatId: patronat.id },
      }),
      this.prisma.patronat.findMany({
        where: { parentPatronatId: patronat.id },
        select: {
          id: true,
          name: true,
          territoryName: true,
          status: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          _count: { select: { schools: true } },
        },
        orderBy: { name: 'asc' },
      }),
      academicYear
        ? this.prisma.nationalExam.findMany({
            where: { patronatId: patronat.id, academicYearId: academicYear.id },
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              startDate: true,
              endDate: true,
              totalCandidates: true,
              totalCenters: true,
            },
            orderBy: { startDate: 'desc' },
            take: 20,
          })
        : [],
      academicYear
        ? this.prisma.examCandidate.count({
            where: { tenantId: patronat.tenantId, academicYearId: academicYear.id },
          })
        : 0,
      academicYear
        ? this.prisma.examCandidate.count({
            where: {
              tenantId: patronat.tenantId,
              academicYearId: academicYear.id,
              centerId: null,
              status: { not: 'CANCELLED' },
            },
          })
        : 0,
      academicYear
        ? this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM (
              SELECT LOWER("firstName"), LOWER("lastName"), "dateOfBirth"
              FROM exam_candidates
              WHERE "tenantId" = ${patronat.tenantId}
                AND "academicYearId" = ${academicYear.id}
                AND status <> 'CANCELLED'
              GROUP BY LOWER("firstName"), LOWER("lastName"), "dateOfBirth"
              HAVING COUNT(*) > 1
            ) d`
        : Promise.resolve([{ count: BigInt(0) }]),
      academicYear
        ? this.prisma.examIncident.count({
            where: { tenantId: patronat.tenantId },
          })
        : 0,
    ]);

    const now = new Date();
    const activeExams = exams.filter(
      (e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED' && e.status !== 'ARCHIVED',
    );
    const upcomingExams = activeExams.filter((e) => new Date(e.startDate) > now);
    const inProgressExams = activeExams.filter((e) => new Date(e.startDate) <= now);

    const examsWithoutCenters = activeExams.filter((e) => e.totalCenters === 0);

    // ── Alertes ORION (lecture seule) ────────────────────────────
    const orionAlerts: Array<{
      severity: 'critical' | 'warning' | 'info';
      category: string;
      message: string;
      count?: number;
    }> = [];

    if (Number(duplicateGroups[0]?.count ?? 0) > 0) {
      orionAlerts.push({
        severity: 'critical',
        category: 'INSCRIPTION',
        message: `${duplicateGroups[0].count} groupe(s) de candidats en doublon probable détecté(s).`,
        count: Number(duplicateGroups[0].count),
      });
    }
    if (candidatesWithoutCenter > 0) {
      orionAlerts.push({
        severity: 'warning',
        category: 'LOGISTIQUE',
        message: `${candidatesWithoutCenter} candidat(s) sans centre d'examen affecté.`,
        count: candidatesWithoutCenter,
      });
    }
    if (examsWithoutCenters.length > 0) {
      orionAlerts.push({
        severity: 'warning',
        category: 'LOGISTIQUE',
        message: `${examsWithoutCenters.length} examen(s) actif(s) sans centre configuré.`,
        count: examsWithoutCenters.length,
      });
    }
    if (!academicYear) {
      orionAlerts.push({
        severity: 'critical',
        category: 'CONFORMITÉ',
        message: 'Aucune année scolaire active — la création de données est bloquée.',
      });
    }
    if (
      patronat.subscriptionExpiresAt &&
      new Date(patronat.subscriptionExpiresAt) < new Date(Date.now() + 7 * 24 * 3600 * 1000)
    ) {
      orionAlerts.push({
        severity: 'info',
        category: 'ABONNEMENT',
        message: `Abonnement ${patronat.subscriptionPlan} arrivant à échéance ou expiré.`,
      });
    }
    if (patronat.orgLevel === 'NATIONAL' && childPatronats.length === 0) {
      orionAlerts.push({
        severity: 'info',
        category: 'ORGANISATION',
        message: 'Aucun patronat territorial rattaché — créez les patronats de votre réseau.',
      });
    }

    const plan =
      FEDERIS_PLANS[patronat.subscriptionPlan as FederisPlanCode] ?? FEDERIS_PLANS.ESSENTIEL;
    const totalSchools = joinedSchools + manualSchools;

    return {
      patronat: {
        id: patronat.id,
        name: patronat.name,
        orgLevel: patronat.orgLevel,
        territoryName: patronat.territoryName,
        country: patronat.country,
      },
      academicYear: academicYear
        ? { id: academicYear.id, label: academicYear.label, name: academicYear.name }
        : null,
      kpis: {
        schoolsAttached: totalSchools,
        schoolsPending: pendingSchools,
        manualSchools,
        candidates: candidatesTotal,
        activeExams: activeExams.length,
        upcomingExams: upcomingExams.length,
        inProgressExams: inProgressExams.length,
        centers: exams.reduce((sum, e) => sum + e.totalCenters, 0),
        incidents,
        childPatronats: childPatronats.length,
        quotaUsage: {
          schools: { used: totalSchools, max: plan.maxSchools },
          candidates: { used: candidatesTotal, max: plan.maxCandidates },
        },
      },
      subscription: {
        plan: patronat.subscriptionPlan,
        planLabel: plan.name,
        status: patronat.subscriptionStatus,
        expiresAt: patronat.subscriptionExpiresAt,
      },
      exams: exams.slice(0, 6).map((e) => ({
        id: e.id,
        name: e.name,
        code: e.code,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        totalCandidates: e.totalCandidates,
        totalCenters: e.totalCenters,
      })),
      childrenPatronats: childPatronats.map((c) => ({
        id: c.id,
        name: c.name,
        territoryName: c.territoryName,
        status: c.status,
        subscriptionPlan: c.subscriptionPlan,
        subscriptionStatus: c.subscriptionStatus,
        schoolsCount: c._count.schools,
      })),
      orion: {
        readOnly: true,
        alerts: orionAlerts,
        summary:
          orionAlerts.length === 0
            ? 'Aucune anomalie détectée sur le périmètre.'
            : `${orionAlerts.length} alerte(s) — ${orionAlerts.filter((a) => a.severity === 'critical').length} critique(s).`,
      },
    };
  }

  /** Patronats territoriaux rattachés (niveau national uniquement). */
  async getChildrenPatronats(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    if (patronat.orgLevel !== 'NATIONAL') {
      throw new ForbiddenException(
        'La gestion des patronats territoriaux est réservée au niveau national.',
      );
    }
    const children = await this.prisma.patronat.findMany({
      where: { parentPatronatId: patronat.id },
      include: {
        territorialLevel: { select: { label: true, code: true } },
        _count: { select: { schools: true, exams: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
    return children.map((c) => ({
      id: c.id,
      name: c.name,
      territoryName: c.territoryName,
      territorialLevel: c.territorialLevel,
      status: c.status,
      subscriptionPlan: c.subscriptionPlan,
      subscriptionStatus: c.subscriptionStatus,
      schoolsCount: c._count.schools,
      examsCount: c._count.exams,
      usersCount: c._count.users,
      createdAt: c.createdAt,
    }));
  }

  /** Création d'un patronat territorial par le niveau national. */
  async createChildPatronat(tenantId: string, userId: string, dto: CreateChildPatronatDto) {
    const parent = await this.resolvePatronat(tenantId, userId);
    if (parent.orgLevel !== 'NATIONAL') {
      throw new ForbiddenException(
        'Seul un patronat national peut créer des patronats territoriaux.',
      );
    }
    if (!parent.countryId) {
      throw new BadRequestException(
        "Le patronat national n'est pas rattaché à un pays — impossible de créer un territorial.",
      );
    }

    // Niveaux territoriaux configurés pour le pays (ordre > 1 = sous-niveau du national)
    // Défensif : table non déployée (migration 20260927000000 absente) →
    // refus propre plutôt qu'une erreur 500.
    let levels: { id: string; code: string; label: string; order: number }[] = [];
    try {
      levels = await this.prisma.countryTerritorialLevel.findMany({
        where: { countryId: parent.countryId, isActive: true, order: { gt: 1 } },
        orderBy: { order: 'asc' },
      });
    } catch (err) {
      const code = (err as any)?.code;
      if (code !== 'P2021' && code !== 'P2022' && code !== 'P2024') throw err;
      this.logger.warn(
        'Table country_territorial_levels absente — création de patronat territorial indisponible (migration 20260927000000 non déployée ?).',
      );
    }
    if (levels.length === 0) {
      throw new BadRequestException(
        "Aucun niveau territorial configuré pour ce pays. Configurez d'abord les niveaux du pays.",
      );
    }

    const nameConflict = await this.prisma.patronat.findFirst({
      where: {
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        parentPatronatId: parent.id,
      },
    });
    if (nameConflict) {
      throw new BadRequestException('Un patronat territorial portant ce nom existe déjà.');
    }

    const slugBase =
      dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'patronat-territorial';
    let slug = slugBase;
    let suffix = 2;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${suffix++}`;
    }

    // Premier niveau territorial configuré pour le pays (ex : Département au Bénin)
    const childLevel = levels[0];

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          countryId: parent.countryId!,
          type: 'PATRONAT',
          status: 'active',
          subscriptionStatus: 'TRIAL',
        },
      });

      const [respFirst, ...respRest] = dto.responsibleName?.trim().split(/\s+/) ?? [];
      const patronat = await tx.patronat.create({
        data: {
          tenantId: tenant.id,
          name: dto.name.trim(),
          primaryEmail: dto.email?.trim().toLowerCase() || null,
          primaryPhone: dto.phone?.trim() || null,
          region: dto.territoryName?.trim() || null,
          territoryName: dto.territoryName?.trim() || null,
          scope: childLevel?.code ?? 'TERRITORIAL',
          orgLevel: 'TERRITORIAL',
          parentPatronatId: parent.id,
          territorialLevelId: childLevel?.id ?? null,
          countryId: parent.countryId,
          subscriptionPlan: 'ESSENTIEL',
          subscriptionStatus: 'PENDING_PAYMENT',
          metadata: { organismType: dto.organismType ?? 'PATRONAT', createdBy: userId },
        },
      });

      // Année scolaire active pour le territorial (NO ACADEMIC YEAR = NO DATA)
      const now = new Date();
      const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      await tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: `${startYear}-${startYear + 1}`,
          label: `Année scolaire ${startYear}-${startYear + 1}`,
          startDate: new Date(`${startYear}-09-01T00:00:00Z`),
          endDate: new Date(`${startYear + 1}-08-31T23:59:59Z`),
          isActive: true,
          isAutoGenerated: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: parent.tenantId,
          userId,
          action: 'FEDERIS_CHILD_PATRONAT_CREATED',
          resource: 'Patronat',
          resourceId: patronat.id,
          tableName: 'patronats',
          recordId: patronat.id,
          newData: { name: patronat.name, territoryName: patronat.territoryName },
        },
      });

      return patronat;
    });

    this.logger.log(`Patronat territorial créé : « ${result.name} » (parent : ${parent.name})`);
    return { success: true, patronat: result };
  }

  /** Écoles rattachées au patronat (Helm + manuelles). */
  async getSchools(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const [linked, manual] = await Promise.all([
      this.prisma.patronatSchool.findMany({
        where: { patronatId: patronat.id },
        include: {
          schoolTenant: {
            select: { id: true, name: true, slug: true, subdomain: true, logo: true, status: true },
          },
          academicYear: { select: { name: true } },
          _count: { select: { candidates: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patronatManualSchool.findMany({
        where: { patronatId: patronat.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      linked: linked.map((s) => ({
        id: s.id,
        kind: 'HELM' as const,
        name: s.schoolTenant?.name ?? 'École',
        slug: s.schoolTenant?.slug,
        logo: s.schoolTenant?.logo,
        status: s.status,
        accessLevel: s.accessLevel,
        joinedAt: s.joinedAt,
        academicYear: s.academicYear?.name,
        candidatesCount: s._count.candidates,
      })),
      manual: manual.map((s) => ({
        id: s.id,
        kind: 'MANUAL' as const,
        name: s.name,
        address: s.address,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  }

  /** Recherche d'écoles Academia Helm existantes (par nom/slug). */
  async searchHelmSchools(query: string) {
    const q = query?.trim();
    if (!q || q.length < 2) return [];
    return this.prisma.tenant.findMany({
      where: {
        type: 'SCHOOL',
        status: 'active',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, slug: true, subdomain: true, logo: true },
      take: 15,
      orderBy: { name: 'asc' },
    });
  }

  /** Demande de rattachement d'une école Helm existante (validation par l'école). */
  async requestSchoolLink(tenantId: string, userId: string, dto: RequestSchoolLinkDto) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const school = await this.prisma.tenant.findFirst({
      where: { id: dto.schoolTenantId, type: 'SCHOOL' },
    });
    if (!school) throw new NotFoundException('École Academia Helm introuvable.');

    const academicYear = await this.getActiveYear(patronat.tenantId);
    if (!academicYear) {
      throw new BadRequestException(
        "Aucune année scolaire active — impossible d'initier un rattachement.",
      );
    }

    const existing = await this.prisma.patronatSchool.findFirst({
      where: { patronatId: patronat.id, schoolTenantId: school.id },
    });
    if (existing) {
      throw new BadRequestException(
        existing.status === 'PENDING'
          ? 'Une demande de rattachement est déjà en attente pour cette école.'
          : 'Cette école est déjà rattachée à votre patronat.',
      );
    }

    // Quota d'écoles du plan (alerte à 80 % / 100 %, jamais de facturation auto)
    const plan =
      FEDERIS_PLANS[patronat.subscriptionPlan as FederisPlanCode] ?? FEDERIS_PLANS.ESSENTIEL;
    const currentCount = await this.prisma.patronatSchool.count({
      where: { patronatId: patronat.id, status: 'JOINED' },
    });
    if (currentCount >= plan.maxSchools) {
      throw new BadRequestException(
        `Quota d'écoles atteint pour l'offre ${plan.name} (${plan.maxSchools}). Passez à l'offre Institution ou contactez l'équipe.`,
      );
    }

    const membership = await this.prisma.patronatSchool.create({
      data: {
        patronatId: patronat.id,
        tenantId: patronat.tenantId,
        schoolTenantId: school.id,
        academicYearId: academicYear.id,
        status: 'PENDING',
        accessLevel: 'READ_ONLY',
        createdBy: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_SCHOOL_LINK_REQUESTED',
        resource: 'PatronatSchool',
        resourceId: membership.id,
        tableName: 'patronat_schools',
        recordId: membership.id,
        newData: { school: school.name, status: 'PENDING' },
      },
    });

    return {
      success: true,
      membership,
      quota: { used: currentCount + 1, max: plan.maxSchools },
    };
  }

  /** Création d'une école minimale (école hors Academia Helm). */
  async createManualSchool(tenantId: string, userId: string, dto: CreateManualSchoolDto) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    if (!dto.name?.trim()) throw new BadRequestException('Le nom de l’école est requis.');

    const school = await this.prisma.patronatManualSchool.create({
      data: {
        patronatId: patronat.id,
        tenantId: patronat.tenantId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        status: 'MANUAL',
        metadata: { createdBy: userId },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_MANUAL_SCHOOL_CREATED',
        resource: 'PatronatManualSchool',
        resourceId: school.id,
        tableName: 'patronat_manual_schools',
        recordId: school.id,
        newData: { name: school.name },
      },
    });

    return { success: true, school };
  }

  /** Statut d'abonnement + historique de facturation. */
  async getSubscription(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const plan =
      FEDERIS_PLANS[patronat.subscriptionPlan as FederisPlanCode] ?? FEDERIS_PLANS.ESSENTIEL;
    const invoices = await this.prisma.federisInvoice.findMany({
      where: { patronatId: patronat.id },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return {
      plan: patronat.subscriptionPlan,
      planLabel: plan.name,
      amountXOF: plan.amountXOF,
      status: patronat.subscriptionStatus,
      period: patronat.subscriptionPeriod,
      startedAt: patronat.subscriptionStartedAt,
      expiresAt: patronat.subscriptionExpiresAt,
      quotas: {
        maxSchools: plan.maxSchools,
        maxCandidates: plan.maxCandidates,
        maxActiveCampaigns: plan.maxActiveCampaigns,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        type: inv.type,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
        paymentsCount: inv.payments.length,
      })),
    };
  }

  /**
   * Initialisation du paiement Fedapay (cahier des charges §12).
   * Crée la facture puis la transaction Fedapay ; renvoie l'URL de paiement.
   * Aucun prélèvement automatique — renouvellement manuel.
   *
   * ⭐ MÊME COMPORTEMENT QUE LE CHECKOUT HELM (createOnboardingPaymentSession) :
   *   1. IDEMPOTENCE — une facture UNPAID du même plan existe déjà → on la
   *      réutilise ; si son URL Fedapay est encore fraîche (< 12 h) elle est
   *      renvoyée TELLE QUELLE : un double-clic ou un réessai ne crée ni
   *      facture en double, ni transaction Fedapay en double (c'est ce qui
   *      faisait refuser la 2e transaction par Fedapay et déclenchait le
   *      message trompeur « non configuré »).
   *   2. NUMÉRO GLOBALEMENT UNIQUE — l'ancien compteur PAR PATRONAT
   *      (FED-{3 initiales du nom}-{année}-0001) entrait en collision P2002
   *      dès que deux patronats partageaient les mêmes initiales (ex : tous
   *      les « Patronat … » → FED-PAT-…-0001). Nouveau format : séquence
   *      GLOBALE + retry sur collision résiduelle.
   *   3. ERREURS FEDAPAY PROPAGÉES — plus de fallback silencieux : si Fedapay
   *      refuse la transaction, l'utilisateur voit la VRAIE erreur (comme sur
   *      le signup Helm). Le mode « manuel » ne reste que si la clé Fedapay
   *      est réellement absente de l'environnement (développement local).
   */
  async initCheckout(tenantId: string, userId: string, dto: InitCheckoutDto) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const plan = FEDERIS_PLANS[dto.plan];
    if (!plan) throw new BadRequestException('Offre invalide. Offres : ESSENTIEL, INSTITUTION.');

    // ── 1. Facture impayée existante ? (pattern Helm : existingPayment PENDING) ──
    const existing = await this.prisma.federisInvoice.findFirst({
      where: { patronatId: patronat.id, status: 'UNPAID', type: 'SUBSCRIPTION' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const existingMeta = (existing.metadata as Record<string, any>) ?? {};

      if (existingMeta.plan !== plan.code) {
        // Changement d'offre : l'ancienne facture (jamais réglée) est annulée
        // pour ne laisser qu'une seule facture ouverte par patronat.
        await this.prisma.federisInvoice.update({
          where: { id: existing.id },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...existingMeta,
              cancelledAt: new Date().toISOString(),
              cancelledReason: `plan_change:${plan.code}`,
            },
          },
        });
      } else if (
        typeof existingMeta.paymentUrl === 'string' &&
        existingMeta.paymentUrl.startsWith('https://') &&
        Date.now() - existing.createdAt.getTime() < 12 * 3600 * 1000
      ) {
        // ⭐ Session Fedapay encore valide → renvoyée telle quelle (Helm
        //    renvoie metadata.paymentUrl du paiement PENDING existant).
        await this.prisma.auditLog.create({
          data: {
            tenantId: patronat.tenantId,
            userId,
            action: 'FEDERIS_CHECKOUT_REUSED',
            resource: 'FederisInvoice',
            resourceId: existing.id,
            tableName: 'federis_invoices',
            recordId: existing.id,
            newData: { plan: plan.code, provider: 'FEDAPAY', reused: true },
          },
        });
        return {
          success: true,
          invoice: { id: existing.id, number: existing.number, amount: existing.amount },
          plan: { code: plan.code, name: plan.name, amountXOF: plan.amountXOF },
          provider: 'FEDAPAY',
          paymentUrl: existingMeta.paymentUrl,
          message: 'Paiement Fedapay initialisé.',
        };
      }
      // Sinon : la MÊME facture est réutilisée ci-dessous pour une nouvelle
      // transaction (URL absente, expirée > 12 h, ou transaction refusée).
    }

    // ── 2. Facture de souscription (année scolaire, numéro GLOBALEMENT unique) ──
    const year =
      new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    // Préfixe lisible : 3 premiers caractères alphanumériques du nom (accents
    // retirés) — l'unicité vient de la séquence GLOBALE, pas du préfixe.
    const prefix =
      patronat.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PAT';

    let invoice =
      existing && ((existing.metadata as any)?.plan ?? '') === plan.code ? existing : null;
    if (!invoice) {
      const baseSeq = await this.prisma.federisInvoice.count({});
      for (let attempt = 0; attempt < 6 && !invoice; attempt++) {
        const number =
          attempt < 5
            ? `FED-${prefix}-${year}-${String(baseSeq + 1 + attempt).padStart(4, '0')}`
            : `FED-${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`; // dernier recours
        try {
          invoice = await this.prisma.federisInvoice.create({
            data: {
              patronatId: patronat.id,
              tenantId: patronat.tenantId,
              number,
              amount: plan.amountXOF,
              currency: 'XOF',
              dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
              status: 'UNPAID',
              type: 'SUBSCRIPTION',
              metadata: { plan: plan.code, period: 'SCHOOL_YEAR', initiatedBy: userId },
            },
          });
        } catch (err: any) {
          // Numéro pris par une création concurrente → tenter le suivant
          if (err?.code === 'P2002' && attempt < 5) continue;
          throw err;
        }
      }
    }

    // ── 3. Transaction Fedapay (MÊME PATTER QUE HELM — SDK officiel) ──
    // La transaction porte les metadata federis (federisInvoiceId…) +
    // webhook_url propre à Federis : le webhook
    // POST /api/federis/public/fedapay/webhook active l'abonnement dès
    // l'approbation (montant vérifié, idempotent).
    if (!this.fedapayService.isConfigured()) {
      // Clé Fedapay réellement absente (développement local) : facture en
      // mode manuel, finalisation par l'équipe. En production la clé est
      // configurée (même backend que Helm) — ce bloc ne s'exécute pas.
      await this.prisma.auditLog.create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_CHECKOUT_INITIALIZED',
          resource: 'FederisInvoice',
          resourceId: invoice.id,
          tableName: 'federis_invoices',
          recordId: invoice.id,
          newData: { plan: plan.code, amount: plan.amountXOF, provider: 'MANUAL' },
        },
      });
      return {
        success: true,
        invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount },
        plan: { code: plan.code, name: plan.name, amountXOF: plan.amountXOF },
        provider: 'MANUAL',
        paymentUrl: null,
        message:
          "Facture créée. Fedapay n'est pas configuré sur cet environnement (mode développement) — l'équipe activera l'abonnement après règlement.",
      };
    }

    // ⭐ Erreurs PROPAGÉES (pattern Helm) : si Fedapay refuse, la VRAIE cause
    //    remonte au frontend au lieu du message trompeur « non configuré ».
    const tx = await this.fedapayService.createSubscriptionTransaction({
      invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount },
      patronat: {
        id: patronat.id,
        tenantId: patronat.tenantId,
        name: patronat.name,
        primaryEmail: patronat.primaryEmail,
        primaryPhone: patronat.primaryPhone,
      },
      plan: { code: plan.code, name: plan.name },
    });

    // Trace la transaction sur la facture (résolution webhook + lookup
    // by-transaction si les metadata venaient à manquer dans le payload).
    // amountFedapay = montant réellement débité (plafonné en sandbox —
    // pattern Helm : la facture conserve le montant RÉEL).
    const invoiceMeta = (invoice.metadata as Record<string, any>) ?? {};
    await this.prisma.federisInvoice.update({
      where: { id: invoice.id },
      data: {
        metadata: {
          ...invoiceMeta,
          provider: 'FEDAPAY',
          providerTransactionId: tx.transactionId,
          amountFedapay: tx.amountFedapay,
          paymentUrl: tx.paymentUrl,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_CHECKOUT_INITIALIZED',
        resource: 'FederisInvoice',
        resourceId: invoice.id,
        tableName: 'federis_invoices',
        recordId: invoice.id,
        newData: {
          plan: plan.code,
          amount: plan.amountXOF,
          provider: 'FEDAPAY',
          providerTransactionId: tx.transactionId,
          reusedInvoice: invoice.id === existing?.id,
        },
      },
    });

    if (!tx.paymentUrl) {
      throw new BadRequestException(
        "Fedapay a accepté la transaction mais n'a renvoyé aucune URL de paiement. Réessayez dans un instant.",
      );
    }

    return {
      success: true,
      invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount },
      plan: { code: plan.code, name: plan.name, amountXOF: plan.amountXOF },
      provider: 'FEDAPAY',
      paymentUrl: tx.paymentUrl,
      message: 'Paiement Fedapay initialisé.',
    };
  }
}
