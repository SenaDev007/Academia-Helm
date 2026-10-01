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
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import {
  normalizePatronatFunction,
  patronatFunctionLabel,
  MANAGE_USERS,
  type PatronatFunction,
} from './federis-roles';
import { FederisFedapayService } from './federis-fedapay.service';
// ⭐ 2026-10-01 — AGRÉGATION NATIONALE : années du périmètre (sans cycle DI)
import { resolveScopeYearsFor } from './federis-scope.service';
// ⭐ FIX « tenant SCHOOL » (2026-09-29) : l'onboarding Helm crée les tenants
//    écoles avec le TYPE D'ÉTABLISSEMENT (MATERNELLE / PRIMAIRE / SECONDAIRE /
//    MIXTE — cf. OnboardingService.activate : `type: draft.schoolType`), PAS
//    avec 'SCHOOL'. Toute requête `type: 'SCHOOL'` excluait donc TOUTES les
//    écoles réelles : recherche vide, rattachement impossible. Source unique
//    de vérité : common/constants/school-tenant-types (pattern school-search).
import { schoolTenantTypeFilter } from '../common/constants/school-tenant-types';
// ⭐ Découverte territoriale (2026-09-29) : carte officielle des 77 communes
//    du Bénin + alias de départements (renommages 2016) — permet de rattacher
//    les écoles à leur patronat départemental via leur VILLE (l'onboarding
//    Helm ne collecte pas le département).
// ⭐ Catégorisation par département (2026-09-29 #2) : cityToDepartment résout
//    le département canonique d'une école (fiche School.department, sinon la
//    ville) — vision globale du patronat national + attribution automatique
//    des demandes d'adhésion au patronat départemental de l'école.
import {
  normalizeTerritoryKey,
  territoryIncludesCity,
  cityToDepartment,
  departmentKeys,
  territoryIncludesKeys,
} from '../common/constants/benin-territories';
// ⭐ Fiche détail d'une école rattachée (2026-09-29 #3) : rapprochement des
//    classes de l'école avec les examens nationaux (CM2→CEP, 3ème→BEPC,
//    Terminale→BAC par série, CAP par filière) — mêmes règles que le module
//    « Examens nationaux » côté école.
// ⭐ FIX CYCLE D'IMPORTS (2026-09-30) : ces fonctions sont importées depuis
//    le module FEUILLE federis-exam-matching (zéro import) et NON PLUS depuis
//    federis-school-exams.service — l'ancienne arête créait le cycle runtime
//    patronat → school-exams → deliberation/grades/pdf → patronat, lequel
//    crashait le boot en TDZ sous SWC (« Cannot access 'FederisPatronatService
//    before initialization » — crash-loop Railway).
import {
  classMatchesExam,
  federisLevelMatchesType,
  resolveSeriesFromClassNames,
} from './federis-exam-matching';

/**
 * Offres Federis (cahier des charges §12 + proposition tarifaire).
 *
 * ⭐ TARIFICATION PAR NIVEAU ORGANISATIONNEL (2026-09-28) : les frais
 * d'abonnement du patronat NATIONAL sont SUPÉRIEURS à ceux des patronats
 * TERRITORIAUX / DÉPARTEMENTAUX — même offre, barème différencié :
 *   - Essentiel    : National 250 000 XOF · Territorial 100 000 XOF
 *   - Institution  : National 500 000 XOF · Territorial 250 000 XOF
 */
export const FEDERIS_PLANS = {
  ESSENTIEL: {
    code: 'ESSENTIEL',
    name: 'Federis Essentiel',
    amountXOF: 100_000, // valeur par défaut (territorial) — rétro-compat
    amounts: { NATIONAL: 250_000, TERRITORIAL: 100_000 },
    period: 'année scolaire',
    maxSchools: 5,
    maxCandidates: 500,
    maxActiveCampaigns: 1,
  },
  INSTITUTION: {
    code: 'INSTITUTION',
    name: 'Federis Institution',
    amountXOF: 250_000, // valeur par défaut (territorial) — rétro-compat
    amounts: { NATIONAL: 500_000, TERRITORIAL: 250_000 },
    period: 'année scolaire',
    maxSchools: 25,
    maxCandidates: 3_000,
    maxActiveCampaigns: 3,
  },
} as const;

export type FederisPlanCode = keyof typeof FEDERIS_PLANS;

/** Niveaux organisationnels tarifés (NATIONAL > TERRITORIAL / départemental). */
export type FederisPriceLevel = 'NATIONAL' | 'TERRITORIAL';

/**
 * Montant XOF d'une offre pour un niveau organisationnel donné.
 * Tout niveau non national (territorial, départemental, régional…) est
 * facturé au barème TERRITORIAL.
 */
export function resolvePlanAmount(
  plan: { amountXOF: number; amounts?: Partial<Record<FederisPriceLevel, number>> },
  orgLevel?: string | null,
): number {
  if (orgLevel === 'NATIONAL') {
    return plan.amounts?.NATIONAL ?? plan.amountXOF;
  }
  return plan.amounts?.TERRITORIAL ?? plan.amountXOF;
}


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

  /**
   * Niveau territorial cible (code du CountryTerritorialLevel, ex: DEPARTMENT).
   * Optionnel — par défaut le premier sous-niveau configuré pour le pays
   * (ex : Département au Bénin). Permet au national de créer des patronats
   * à différents étages territoriaux (départemental, communal…).
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  territorialLevelCode?: string;

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

  /**
   * ⭐ Même flux que l'inscription publique : le national définit le mot de
   * passe du compte responsable du patronat territorial créé.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
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

  /**
   * ⭐ Paiement POUR UN PATRONAT TERRITORIAL créé par le niveau national :
   * même flux payant que l'inscription publique. Le national règle
   * l'abonnement du patronat enfant identifié ici (la facture et
   * l'activation — sous-domaine + email — ciblent l'enfant).
   */
  @IsOptional()
  @IsString()
  patronatId?: string;
}

export class UpdatePatronatIdentityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  abbreviation?: string;

  /** Logo institutionnel — data URL (optimisée via /media/optimize) ou URL https. */
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  logo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  primaryEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  website?: string;
}

@Injectable()
export class FederisPatronatService {
  private readonly logger = new Logger(FederisPatronatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fedapayService: FederisFedapayService,
  ) {}

  // ── ⭐ DERNIÈRE VERSION DU LOGO D'ÉCOLE (2026-09-30) ────────────────────────
  //
  // Une école Helm peut uploader son logo à tout moment (Paramètres →
  // Profil d'identité) : chaque upload crée une NOUVELLE VERSION de
  // TenantIdentityProfile (version + 1, isActive = true) et désactive la
  // précédente. Le champ historique School.logo n'est PAS resynchronisé
  // systématiquement — il reste au mieux sur la PREMIÈRE version importée.
  // Lire uniquement School.logo affichait donc l'ancien logo (voire aucun).
  //
  // Résolution (pattern ReviewsService) :
  //   1. TenantIdentityProfile ACTIF le plus récent (dernier upload) ;
  //   2. SchoolSettings.logoUrl (synchronisé par identity-profile) ;
  //   3. School.logo (fiche historique) ;
  //   4. null.
  private static readonly SCHOOL_LOGO_INCLUDE = {
    schoolSettings: { select: { logoUrl: true } },
    identityProfiles: {
      where: { isActive: true },
      select: { logoUrl: true },
      orderBy: { version: 'desc' as const },
      take: 1,
    },
  } as const;

  /** Résout la DERNIÈRE version du logo d'une école (cf. commentaire ci-dessus). */
  private resolveSchoolLogo(t: {
    identityProfiles?: Array<{ logoUrl: string | null }> | null;
    schoolSettings?: { logoUrl: string | null } | null;
    schools?: { logo: string | null } | null;
  } | null): string | null {
    if (!t) return null;
    return (
      t.identityProfiles?.[0]?.logoUrl ||
      t.schoolSettings?.logoUrl ||
      t.schools?.logo ||
      null
    );
  }

  /** Résout le patronat depuis le tenant du JWT (fallback : lien PatronatUser). */
  /**
   * ★ 2026-10-01 — Lien PatronatUser du demandeur dans le patronat de SON
   * tenant (rôle court : COORDONNATEUR, SECRETAIRE…). Utilisé par la
   * garde des délégations nationales (seul le coordonnateur départemental
   * peut donner la main au national).
   */
  async resolvePatronatUser(tenantId: string, userId?: string) {
    if (!userId) return null;
    return this.prisma.patronatUser.findFirst({
      where: { tenantId, userId, isActive: true },
      select: { role: true, patronatId: true },
    });
  }

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
      abbreviation: patronat.abbreviation,
      logo: patronat.logo,
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
        amountXOF: resolvePlanAmount(plan, patronat.orgLevel),
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

    // ⭐ 2026-10-01 — AGRÉGATION NATIONALE : le tableau de bord du national
    //    consolide TOUT le réseau (lui-même + tous les départements) sur
    //    l'année courante. Un territorial garde la vue de son propre périmètre.
    const isNational = patronat.orgLevel === 'NATIONAL';
    const childrenForScope = isNational
      ? await this.prisma.patronat.findMany({
          where: { parentPatronatId: patronat.id, status: 'ACTIVE' },
          select: { id: true, tenantId: true },
        })
      : [];
    const scopePatronatIds = isNational
      ? [patronat.id, ...childrenForScope.map((c) => c.id)]
      : [patronat.id];
    const scopeTenantIds = isNational
      ? [patronat.tenantId, ...childrenForScope.map((c) => c.tenantId)]
      : [patronat.tenantId];
    const { yearIds: scopeYearIds } = await resolveScopeYearsFor(
      this.prisma,
      patronat.tenantId,
      scopeTenantIds,
    );
    const scopeYearFilter = scopeYearIds.length ? { in: scopeYearIds } : undefined;

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
      academicYear || scopeYearFilter
        ? this.prisma.nationalExam.findMany({
            where: {
              patronatId: { in: scopePatronatIds },
              ...(scopeYearFilter ? { academicYearId: scopeYearFilter } : {}),
            },
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              startDate: true,
              endDate: true,
              totalCandidates: true,
              totalCenters: true,
              patronatId: true,
            },
            orderBy: { startDate: 'desc' },
            take: 20,
          })
        : [],
      scopeYearFilter
        ? this.prisma.examCandidate.count({
            where: { tenantId: { in: scopeTenantIds }, academicYearId: scopeYearFilter },
          })
        : 0,
      scopeYearFilter
        ? this.prisma.examCandidate.count({
            where: {
              tenantId: { in: scopeTenantIds },
              academicYearId: scopeYearFilter,
              centerId: null,
              status: { not: 'CANCELLED' },
            },
          })
        : 0,
      scopeYearFilter
        ? this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*) as count FROM (
               SELECT LOWER("firstName"), LOWER("lastName"), "dateOfBirth"
               FROM exam_candidates
               WHERE "tenantId" IN (${scopeTenantIds.map((t) => `'${t}'`).join(',')})
                 AND "academicYearId" IN (${scopeYearIds.map((y) => `'${y}'`).join(',')})
                 AND status <> 'CANCELLED'
               GROUP BY LOWER("firstName"), LOWER("lastName"), "dateOfBirth"
               HAVING COUNT(*) > 1
             ) d`,
          )
        : Promise.resolve([{ count: BigInt(0) }]),
      academicYear
        ? this.prisma.examIncident.count({
            where: { tenantId: { in: scopeTenantIds } },
          })
        : 0,
    ]);

    // ⭐ AGRÉGATION NATIONALE — statistiques par département (année courante) :
    //    examens et candidats groupés, pour la vue « réseau » du national.
    let departmentsBreakdown: Array<{
      id: string;
      name: string;
      territoryName: string | null;
      status: string;
      schoolsCount: number;
      examsCount: number;
      candidatesCount: number;
    }> = [];
    if (isNational && childPatronats.length > 0 && scopeYearFilter) {
      const childIds = childPatronats.map((c: any) => c.id);
      const childTenantByPatronat = new Map(childrenForScope.map((c) => [c.id, c.tenantId]));
      const [examsByDept, candidatesByDept] = await Promise.all([
        this.prisma.nationalExam.groupBy({
          by: ['patronatId'],
          where: { patronatId: { in: childIds }, academicYearId: scopeYearFilter },
          _count: { _all: true },
        }),
        this.prisma.examCandidate.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { in: childrenForScope.map((c) => c.tenantId) },
            academicYearId: scopeYearFilter,
          },
          _count: { _all: true },
        }),
      ]);
      const examsMap = new Map(
        examsByDept.map((g: any) => [g.patronatId, g._count._all]),
      );
      const candidatesMap = new Map(
        candidatesByDept.map((g: any) => [g.tenantId, g._count._all]),
      );
      departmentsBreakdown = childPatronats.map((c: any) => ({
        id: c.id,
        name: c.name,
        territoryName: c.territoryName,
        status: c.status,
        schoolsCount: c._count?.schools ?? 0,
        examsCount: examsMap.get(c.id) ?? 0,
        candidatesCount: candidatesMap.get(childTenantByPatronat.get(c.id) ?? '') ?? 0,
      }));
    }

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
      // ⭐ AGRÉGATION NATIONALE — vue réseau : statistiques de l'année
      //    courante par département (examen de chaque département, candidats).
      departments: departmentsBreakdown,
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

  /**
   * Création d'un patronat territorial par le niveau national.
   *
   * ⭐ MÊME FLUX QUE L'INSCRIPTION PUBLIQUE (2026-09-28) : la création est
   * PAYANTE — le compte responsable est créé (User + PatronatUser + Bureau)
   * et le parcours se poursuit vers le CHECKOUT Fedapay (nextStep), le
   * national réglant l'abonnement du territorial créé. L'activation
   * (webhook/verify) attribue le sous-domaine et envoie l'email identifiants,
   * exactement comme le flux public.
   */
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

    // Niveau cible : celui demandé (ex : DEPARTMENT) sinon le premier
    // sous-niveau configuré (ex : Département au Bénin).
    const childLevel = dto.territorialLevelCode
      ? levels.find((l) => l.code === dto.territorialLevelCode)
      : levels[0];
    if (!childLevel) {
      throw new BadRequestException(
        `Niveau territorial « ${dto.territorialLevelCode} » non configuré pour ce pays. Niveaux disponibles : ${levels
          .map((l) => l.code)
          .join(', ')}.`,
      );
    }

    // ⭐ Validation du territoire contre la liste de référence du pays
    //    (même règle que l'inscription publique — ex : les 12 départements
    //    du Bénin), tolérante si la table n'est pas déployée.
    if (dto.territoryName?.trim()) {
      try {
        const referenceTerritories = await this.prisma.countryTerritory.findMany({
          where: { countryId: parent.countryId, isActive: true },
          select: { name: true },
        });
        if (
          referenceTerritories.length > 0 &&
          !referenceTerritories.some(
            (t) => t.name.trim().toLowerCase() === dto.territoryName.trim().toLowerCase(),
          )
        ) {
          throw new BadRequestException(
            `« ${dto.territoryName.trim()} » ne fait pas partie des unités territoriales configurées pour ce pays.`,
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const code = (err as any)?.code;
        if (code !== 'P2021' && code !== 'P2022' && code !== 'P2024') throw err;
      }
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

    // ⭐ Compte responsable : mêmes règles que l'inscription publique —
    //    email unique + mot de passe ≥ 8 caractères.
    const email = dto.email?.trim().toLowerCase() || null;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Adresse électronique du responsable invalide.');
      }
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(
          'Un compte existe déjà avec cette adresse électronique. Utilisez une autre adresse pour le responsable.',
        );
      }
    }
    if (dto.password && dto.password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
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
          primaryEmail: email,
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
          metadata: { organismType: 'PATRONAT', createdBy: userId },
        },
      });

      // ⭐ Compte responsable (même flux que registerPatronat) : User +
      //    PatronatUser (COORDONNATEUR) + membre du bureau (Président).
      //    Le responsable se connecte sur le sous-domaine du patronat après
      //    activation — le national lui communique ses identifiants.
      let responsibleUser: { id: string; email: string } | null = null;
      if (email && dto.responsibleName?.trim() && dto.password) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            passwordHash: hashedPassword,
            firstName: respFirst || '',
            lastName: respRest.join(' ') || '',
            role: 'PATRONAT_COORDONNATEUR',
            status: 'active',
          },
        });
        await tx.patronatUser.create({
          data: {
            patronatId: patronat.id,
            tenantId: tenant.id,
            userId: user.id,
            role: 'COORDONNATEUR',
            isActive: true,
          },
        });
        await tx.patronatBureauMember.create({
          data: {
            tenantId: tenant.id,
            patronatId: patronat.id,
            userId: user.id,
            role: 'PRESIDENT',
            firstName: respFirst || '',
            lastName: respRest.join(' ') || '',
            phone: dto.phone?.trim() || null,
            email,
            isActive: true,
          },
        });
        responsibleUser = { id: user.id, email: user.email };
      }

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
          newData: {
            name: patronat.name,
            territoryName: patronat.territoryName,
            responsibleAccount: responsibleUser ? 'created' : 'none',
          },
        },
      });

      return { patronat, tenant, responsibleUser };
    });

    this.logger.log(
      `Patronat territorial créé : « ${result.patronat.name} » (parent : ${parent.name}) — responsable ${
        result.responsibleUser ? result.responsibleUser.email : 'non créé'
      }`,
    );
    // ⭐ Même flux que l'inscription publique : le parcours continue vers le
    //    CHECKOUT — le national règle l'abonnement du territorial créé
    //    (barème TERRITORIAL), l'activation attribue le sous-domaine.
    return {
      success: true,
      patronat: {
        id: result.patronat.id,
        name: result.patronat.name,
        territoryName: result.patronat.territoryName,
        orgLevel: result.patronat.orgLevel,
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        subscriptionPlan: result.patronat.subscriptionPlan,
        subscriptionStatus: result.patronat.subscriptionStatus,
      },
      responsible: result.responsibleUser,
      nextStep: 'CHECKOUT',
    };
  }

  /**
   * Écoles rattachées au patronat (Helm + manuelles).
   *
   * ⭐ VISION NATIONALE (2026-09-29 #2) : pour le patronat NATIONAL, la liste
   * agrège les liens de TOUS les patronats du pays (les demandes émises par
   * le national sont attribuées aux patronats départementaux) — chaque école
   * est accompagnée du patronat dépositaire (patronat) et de son département
   * résolu (department), pour un affichage catégorisé par département.
   * Un patronat TERRITORIAL ne voit que ses propres liens (isolation des
   * données entre départements).
   */
  async getSchools(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const isNational = patronat.orgLevel === 'NATIONAL';

    const [linked, manual] = await Promise.all([
      this.prisma.patronatSchool.findMany({
        where: isNational
          ? {
              // Vision globale du national : liens de tous les patronats du pays
              patronat: {
                ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
              },
            }
          : { patronatId: patronat.id },
        include: {
          patronat: { select: { id: true, name: true, territoryName: true } },
          schoolTenant: {
            // ⭐ FIX « Champ logo invalide » : le modèle Tenant n'a PAS de
            //    champ logo — le logo d'une école Helm vit sur la fiche School
            //    (relation 1:1 Tenant.schools). L'ancien select demandait
            //    logo sur le tenant → P2022 « Invalid prisma.patronatSchool
            //    .findMany() invocation » et cassait toute la page Écoles
            //    rattachées.
            // ⭐ FIX DERNIÈRE VERSION DU LOGO (2026-09-30) : on inclut AUSSI le
            //    profil d'identité actif (dernier upload de l'école) et
            //    SchoolSettings — School.logo seul renvoie l'ANCIENNE version.
            select: {
              id: true,
              name: true,
              slug: true,
              subdomain: true,
              status: true,
              // ⭐ Infos établissement (fiche School 1:1) — affichage côté
              //    patronat une fois le rattachement validé par l'école.
              schools: {
                select: {
                  logo: true,
                  city: true,
                  department: true,
                  address: true,
                  primaryPhone: true,
                  primaryEmail: true,
                },
              },
              ...FederisPatronatService.SCHOOL_LOGO_INCLUDE,
            },
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

    // ⭐ Compteurs de candidats PAR EXAMEN (2026-09-29 #3) — mis à jour
    //    GLOBALEMENT dès qu'une école présente officiellement ses élèves :
    //    chaque ligne d'école porte ses totaux CEP/BEPC/BAC/CAP et l'en-tête
    //    du module affiche les totaux toutes écoles confondues. Les candidats
    //    retirés (WITHDRAWN) ne sont pas comptés.
    const linkIds = linked.map((l) => l.id);
    const examCandidates = linkIds.length
      ? await this.prisma.examCandidate.findMany({
          where: {
            patronatSchoolId: { in: linkIds },
            status: { not: 'WITHDRAWN' },
          },
          select: {
            patronatSchoolId: true,
            exam: { select: { level: true } },
          },
        })
      : [];
    const byExamByLink = new Map<
      string,
      { CEP: number; BEPC: number; BAC: number; CAP: number }
    >();
    const candidatesTotals = { CEP: 0, BEPC: 0, BAC: 0, CAP: 0 };
    for (const c of examCandidates) {
      if (!c.patronatSchoolId) continue;
      const bucket = byExamByLink.get(c.patronatSchoolId) ?? { CEP: 0, BEPC: 0, BAC: 0, CAP: 0 };
      const type = (['CEP', 'BEPC', 'BAC', 'CAP'] as const).find((t) =>
        federisLevelMatchesType(c.exam?.level, t),
      );
      if (type) {
        bucket[type]++;
        candidatesTotals[type]++;
      }
      byExamByLink.set(c.patronatSchoolId, bucket);
    }

    return {
      orgLevel: patronat.orgLevel,
      // ⭐ Totaux globaux du module (toutes écoles rattachées confondues) —
      //    l'en-tête « Écoles rattachées » affiche les candidats par examen.
      totals: {
        attached: linked.filter((s) => s.status === 'JOINED').length,
        pending: linked.filter((s) => s.status === 'PENDING').length,
        candidates: candidatesTotals,
      },
      linked: linked.map((s) => ({
        id: s.id,
        kind: 'HELM' as const,
        // ⭐ Identifiant du tenant école — ouvre la fiche détail au clic
        schoolTenantId: s.schoolTenantId,
        name: s.schoolTenant?.name ?? 'École',
        slug: s.schoolTenant?.slug,
        subdomain: s.schoolTenant?.subdomain,
        logo: this.resolveSchoolLogo(s.schoolTenant),
        city: s.schoolTenant?.schools?.city ?? null,
        department: s.schoolTenant?.schools?.department ?? null,
        // ⭐ Département résolu (fiche, sinon ville → département) — regroup
        // par département côté patronat national.
        resolvedDepartment:
          s.schoolTenant?.schools?.department ??
          cityToDepartment(s.schoolTenant?.schools?.city) ??
          null,
        address: s.schoolTenant?.schools?.address ?? null,
        phone: s.schoolTenant?.schools?.primaryPhone ?? null,
        email: s.schoolTenant?.schools?.primaryEmail ?? null,
        status: s.status,
        accessLevel: s.accessLevel,
        joinedAt: s.joinedAt,
        academicYear: s.academicYear?.name,
        candidatesCount: s._count.candidates,
        // ⭐ Candidats présentés PAR EXAMEN (CEP / BEPC / BAC / CAP) — la
        //    ligne de l'école affiche ces compteurs, le clic ouvre la fiche
        //    détail avec les listes complètes par sous-onglet.
        candidatesByExam: byExamByLink.get(s.id) ?? { CEP: 0, BEPC: 0, BAC: 0, CAP: 0 },
        // ⭐ Patronat dépositaire du lien (vision nationale uniquement)
        patronat: isNational ? (s.patronat?.name ?? null) : null,
        patronatTerritory: isNational ? (s.patronat?.territoryName ?? null) : null,
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
        // ⭐ 2026-09-30 — écoles PROVISOIRES issues du répertoire officiel :
        //    source + territorialité + invitation du responsable (badge et
        //    suivi côté front).
        source: (s.metadata as any)?.source ?? null,
        department: (s.metadata as any)?.department ?? null,
        commune: (s.metadata as any)?.commune ?? null,
        directoryExternalRef: (s.metadata as any)?.directoryExternalRef ?? null,
        invitedAt: (s.metadata as any)?.invitedAt ?? null,
      })),
    };
  }

  // ── Fiche détail d'une école rattachée (2026-09-29 #3) ────────────────────
  //
  // « Dès lors qu'une école adhère (accepte l'invitation), le clic sur cette
  //  école ouvre sa fiche complète » : informations de l'établissement
  //  (adresse, promoteur, contacts…), niveaux scolaires couverts (primaire
  //  CM2 → CEP, secondaire 1er cycle 3ème → BEPC, secondaire 2nd cycle
  //  Terminale → BAC, formation professionnelle → CAP), effectifs des
  //  classes d'examen ISSUS DE LA BASE DE DONNÉES DE L'ÉCOLE (Terminale et
  //  CAP catégorisés PAR SÉRIE / filière), et listes officielles des
  //  candidats présentés — un sous-onglet dynamique par examen (CEP, BEPC,
  //  BAC, CAP) dès que l'école a transmis sa liste au patronat.

  async getSchoolDetail(tenantId: string, userId: string, schoolTenantId: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const isNational = patronat.orgLevel === 'NATIONAL';

    // 1. Lien JOINED — le patronat (ou, en vision nationale, le patronat
    //    départemental du pays) doit avoir un rattachement VALIDÉ par l'école.
    const link = await this.prisma.patronatSchool.findFirst({
      where: isNational
        ? {
            schoolTenantId,
            status: 'JOINED',
            patronat: {
              ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
            },
          }
        : { schoolTenantId, patronatId: patronat.id, status: 'JOINED' },
      include: {
        patronat: { select: { id: true, name: true, tenantId: true, territoryName: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });
    if (!link) {
      throw new ForbiddenException(
        "Cette école n'est pas rattachée à votre patronat (adhésion non encore acceptée par l'établissement).",
      );
    }

    // 2. Fiche établissement (Tenant + School 1:1)
    const [schoolTenant, school] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: schoolTenantId },
        // ⭐ FIX DERNIÈRE VERSION DU LOGO (2026-09-30) : profil d'identité
        //    actif (dernier upload) > SchoolSettings.logoUrl > School.logo.
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
          status: true,
          ...FederisPatronatService.SCHOOL_LOGO_INCLUDE,
        },
      }),
      this.prisma.school.findUnique({
        where: { tenantId: schoolTenantId },
        select: {
          name: true,
          logo: true,
          address: true,
          city: true,
          department: true,
          primaryPhone: true,
          secondaryPhone: true,
          primaryEmail: true,
          website: true,
          founderName: true,
          directorPrimary: true,
          directorSecondary: true,
          educationLevels: true,
        },
      }),
    ]);
    if (!schoolTenant) {
      throw new NotFoundException('École introuvable.');
    }

    // 3. Année scolaire active de l'ÉCOLE (NO ACADEMIC YEAR = NO DATA)
    const schoolYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: schoolTenantId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true },
    });

    // 4. Classes de l'année + effectifs actifs — base de données de l'école
    const classes = schoolYear
      ? await this.prisma.class.findMany({
          where: { tenantId: schoolTenantId, academicYearId: schoolYear.id },
          include: {
            officialClass: {
              select: {
                name: true,
                series: { select: { name: true } },
                level: { select: { name: true } },
              },
            },
            _count: {
              select: {
                classStudents: {
                  where: { status: 'ACTIVE', student: { isActive: true } },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        })
      : [];

    // 5. Répartition par examen : CM2 (CEP), 3ème (BEPC), Terminale PAR SÉRIE
    //    (BAC), CAP PAR FILIÈRE (le nom de classe porte la filière).
    const classForExam = (type: 'CEP' | 'BEPC' | 'BAC' | 'CAP') =>
      classes.filter((c) =>
        classMatchesExam(
          [c.name, c.officialClass?.name, c.officialClass?.level?.name],
          type,
        ),
      );

    const sumCount = (list: typeof classes) =>
      list.reduce((acc, c) => acc + c._count.classStudents, 0);

    const cepClasses = classForExam('CEP');
    const bepcClasses = classForExam('BEPC');
    const bacClasses = classForExam('BAC');
    const capClasses = classForExam('CAP');

    // Terminale — effectifs PAR SÉRIE (A1, C, D…, sinon « non précisée »)
    const bacBySeries = new Map<string, number>();
    for (const c of bacClasses) {
      const serie =
        resolveSeriesFromClassNames(
          c.name,
          c.officialClass?.name,
          c.officialClass?.series?.name ?? null,
        ) ?? 'NON PRECISEE';
      bacBySeries.set(serie, (bacBySeries.get(serie) ?? 0) + c._count.classStudents);
    }
    // CAP — effectifs PAR FILIÈRE (une classe physique = une filière)
    const capByFiliere = new Map<string, number>();
    for (const c of capClasses) {
      capByFiliere.set(c.name, (capByFiliere.get(c.name) ?? 0) + c._count.classStudents);
    }
    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));

    // Niveaux scolaires couverts par l'école (dynamique, selon les classes)
    const levels: {
      code: 'CM2' | '3EME' | 'TERMINALE' | 'CAP';
      cycle: string;
      classe: string;
      examType: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
      examLabel: string;
      students: number;
    }[] = [];
    if (cepClasses.length > 0) {
      levels.push({
        code: 'CM2',
        cycle: 'Enseignement primaire',
        classe: 'CM2',
        examType: 'CEP',
        examLabel: 'CEP',
        students: sumCount(cepClasses),
      });
    }
    if (bepcClasses.length > 0) {
      levels.push({
        code: '3EME',
        cycle: 'Secondaire — 1er cycle',
        classe: '3ème',
        examType: 'BEPC',
        examLabel: 'BEPC',
        students: sumCount(bepcClasses),
      });
    }
    if (bacClasses.length > 0) {
      levels.push({
        code: 'TERMINALE',
        cycle: 'Secondaire — 2nd cycle',
        classe: 'Terminale',
        examType: 'BAC',
        examLabel: 'Baccalauréat',
        students: sumCount(bacClasses),
      });
    }
    if (capClasses.length > 0) {
      levels.push({
        code: 'CAP',
        cycle: 'Formation professionnelle',
        classe: 'Terminale CAP',
        examType: 'CAP',
        examLabel: 'CAP',
        students: sumCount(capClasses),
      });
    }

    // 6. Candidats officiellement présentés par l'école — sous-onglets
    //    dynamiques CEP / BEPC / BAC / CAP. Les ExamCandidate vivent chez le
    //    patronat dépositaire du lien (le départemental en vision nationale) ;
    //    on filtre sur les années scolaires actives des patronats concernés
    //    (le seul patronat en territorial, TOUS les patronats du pays en
    //    vision nationale — les liens y sont attribués aux départementaux).
    const countryPatronats = isNational
      ? await this.prisma.patronat.findMany({
          where: {
            ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
          },
          select: { id: true, tenantId: true },
        })
      : [];
    const visiblePatronatIds = isNational
      ? countryPatronats.map((p) => p.id)
      : [link.patronatId ?? patronat.id];
    const visibleYearTenantIds = isNational
      ? countryPatronats.map((p) => p.tenantId)
      : [link.patronat?.tenantId ?? patronat.tenantId];

    const activeYears = await this.prisma.academicYear.findMany({
      where: { tenantId: { in: visibleYearTenantIds }, isActive: true },
      select: { id: true, name: true },
    });

    const presentedCandidates =
      activeYears.length > 0
        ? await this.prisma.examCandidate.findMany({
            where: {
              schoolTenantId,
              status: { not: 'WITHDRAWN' },
              exam: {
                academicYearId: { in: activeYears.map((y) => y.id) },
                patronatId: { in: visiblePatronatIds },
              },
            },
            include: {
              exam: { select: { code: true, name: true, level: true, status: true } },
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          })
        : [];

    // Regroupement par type d'examen (level → CEP/BEPC/BAC/CAP)
    const EXAM_ORDER = ['CEP', 'BEPC', 'BAC', 'CAP'] as const;
    const presentationsByType = new Map<
      (typeof EXAM_ORDER)[number],
      {
        examType: (typeof EXAM_ORDER)[number];
        exam: { code: string; name: string } | null;
        candidates: {
          id: string;
          matricule: string;
          registrationNumber: string;
          firstName: string;
          lastName: string;
          gender: string | null;
          dateOfBirth: Date | null;
          series: string | null;
          schoolClass: string | null;
        }[];
      }
    >();
    for (const c of presentedCandidates) {
      const type = EXAM_ORDER.find((t) => federisLevelMatchesType(c.exam?.level, t));
      if (!type) continue;
      const entry =
        presentationsByType.get(type) ??
        {
          examType: type,
          exam: c.exam ? { code: c.exam.code, name: c.exam.name } : null,
          candidates: [],
        };
      const meta = (c.metadata ?? {}) as Record<string, unknown>;
      entry.candidates.push({
        id: c.id,
        matricule: c.matricule,
        registrationNumber: c.registrationNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        series: typeof meta.series === 'string' ? meta.series : null,
        schoolClass: typeof meta.schoolClass === 'string' ? meta.schoolClass : null,
      });
      presentationsByType.set(type, entry);
    }
    const presentations = EXAM_ORDER.filter((t) => presentationsByType.has(t)).map(
      (t) => presentationsByType.get(t)!,
    );

    return {
      school: {
        id: schoolTenant.id,
        name: schoolTenant.name,
        slug: schoolTenant.slug,
        subdomain: schoolTenant.subdomain,
        logo: this.resolveSchoolLogo(schoolTenant) ?? school?.logo ?? null,
        address: school?.address ?? null,
        city: school?.city ?? null,
        department: school?.department ?? null,
        phone: school?.primaryPhone ?? null,
        secondaryPhone: school?.secondaryPhone ?? null,
        email: school?.primaryEmail ?? null,
        website: school?.website ?? null,
        promoteur: school?.founderName ?? null,
        directeur: school?.directorPrimary ?? school?.directorSecondary ?? null,
        educationLevels: school?.educationLevels ?? [],
        joinedAt: link.joinedAt,
        accessLevel: link.accessLevel,
        patronat: link.patronat
          ? { name: link.patronat.name, territoryName: link.patronat.territoryName }
          : null,
      },
      academicYear: schoolYear?.name ?? null,
      levels,
      effectifs: {
        CEP: { total: sumCount(cepClasses), byClass: cepClasses.map((c) => ({ label: c.name, count: c._count.classStudents })) },
        BEPC: { total: sumCount(bepcClasses), byClass: bepcClasses.map((c) => ({ label: c.name, count: c._count.classStudents })) },
        BAC: { total: sumCount(bacClasses), bySerie: sortDesc(bacBySeries) },
        CAP: { total: sumCount(capClasses), byFiliere: sortDesc(capByFiliere) },
      },
      presentations,
    };
  }

  /** Recherche d'écoles Academia Helm existantes (par nom/slug). */
  async searchHelmSchools(query: string) {
    const q = query?.trim();
    if (!q || q.length < 2) return [];
    const tenants = await this.prisma.tenant.findMany({
      where: {
        // ⭐ FIX : écoles réelles = MATERNELLE/PRIMAIRE/SECONDAIRE/MIXTE/SCHOOL
        type: schoolTenantTypeFilter(),
        status: 'active',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      // ⭐ Même correctif que getSchools : logo via la fiche School (1:1),
      //    jamais sur le Tenant — PLUS profil d'identité actif et
      //    SchoolSettings pour la DERNIÈRE version du logo (2026-09-30).
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        schools: { select: { logo: true } },
        ...FederisPatronatService.SCHOOL_LOGO_INCLUDE,
      },
      take: 15,
      orderBy: { name: 'asc' },
    });
    // Aplatit le logo résolu (le front attend { id, name, slug, subdomain, logo })
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      subdomain: t.subdomain,
      logo: this.resolveSchoolLogo(t),
    }));
  }

  // ── Découverte automatique des écoles du territoire (2026-09-29) ──────────

  /**
   * ⭐ Écoles Academia Helm du périmètre du patronat — listage AUTOMATIQUE et
   * dynamique (« Écoles de votre territoire ») :
   *   - Patronat TERRITORIAL : écoles dont la fiche School correspond au
   *     territoire du patronat (territoryName, sinon region) + ⭐ les écoles
   *     sans localisation renseignée (ville ET département vides) proposées
   *     dans un groupe « Localisation non renseignée » (ex. CSPEB) ;
   *   - Patronat NATIONAL : toutes les écoles du pays du patronat,
   *     ⭐ CATÉGORISÉES PAR DÉPARTEMENT (resolvedDepartment = fiche
   *     School.department, sinon ville → département via la carte officielle
   *     des 77 communes du Bénin) — le national a la vision globale : le
   *     statut de rattachement agrégé de TOUS les patronats du pays
   *     (linkPatronat = patronat dépositaire du lien).
   *
   * Rapprochement territorial (dans l'ordre) :
   *   1. School.department — libellé exact (accents/tirets/casse tolérés) ;
   *   2. School.city → commune → département (carte officielle des 77 communes
   *      du Bénin — l'onboarding Helm ne collecte que la VILLE, le champ
   *      department reste vide pour la plupart des écoles réelles) ;
   *   3. School.city comparé directement au libellé du territoire (patronats
   *      couvrant une commune, ex. « Cotonou »).
   *
   * Chaque école est accompagnée de son statut de rattachement actuel
   * (PENDING / JOINED / REJECTED / SUSPENDED / null = jamais sollicitée).
   */
  async discoverTerritorySchools(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);

    const isNational = patronat.orgLevel === 'NATIONAL';
    const territory = patronat.territoryName ?? patronat.region ?? null;

    if (!isNational && !territory) {
      return {
        scope: null as string | null,
        territoryName: null as string | null,
        country: patronat.country?.name ?? null,
        message:
          'Aucun territoire configuré pour ce patronat — précisez le département dans Paramètres pour la découverte automatique.',
        schools: [] as unknown[],
      };
    }

    // Écoles Helm actives du même pays (le filtre territorial est appliqué
    // ensuite en code — normalisation des libellés de départements).
    const tenants = await this.prisma.tenant.findMany({
      where: {
        type: schoolTenantTypeFilter(),
        status: 'active',
        ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        type: true,
        schools: {
          select: {
            logo: true,
            city: true,
            department: true,
            address: true,
            primaryPhone: true,
            primaryEmail: true,
          },
        },
        // ⭐ FIX DERNIÈRE VERSION DU LOGO (2026-09-30) : profil d'identité
        //    actif (dernier upload) > SchoolSettings.logoUrl > School.logo.
        ...FederisPatronatService.SCHOOL_LOGO_INCLUDE,
      },
      take: 500,
      orderBy: { name: 'asc' },
    });

    // ⭐ Statuts de rattachement :
    //   - Patronat NATIONAL : vision globale — liens de TOUS les patronats du
    //     pays (préférence : JOINED > PENDING > REJECTED > SUSPENDED), avec le
    //     nom du patronat dépositaire (linkPatronat) ;
    //   - Patronat TERRITORIAL : ses propres liens uniquement (isolation des
    //     données — jamais la vision des autres départements).
    const linkWhere = isNational
      ? {
          patronat: {
            ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
          },
        }
      : { patronatId: patronat.id };
    const links = await this.prisma.patronatSchool.findMany({
      where: linkWhere,
      select: {
        schoolTenantId: true,
        status: true,
        patronat: { select: { id: true, name: true, orgLevel: true } },
      },
    });
    const STATUS_PRIORITY: Record<string, number> = {
      JOINED: 4,
      PENDING: 3,
      REJECTED: 2,
      SUSPENDED: 1,
    };
    const linkAgg = new Map<
      string,
      { status: string; patronatName: string | null; priority: number }
    >();
    for (const l of links) {
      const priority = STATUS_PRIORITY[l.status] ?? 0;
      const current = linkAgg.get(l.schoolTenantId);
      if (!current || priority > current.priority) {
        linkAgg.set(l.schoolTenantId, {
          status: l.status,
          patronatName: l.patronat?.name ?? null,
          priority,
        });
      }
    }

    // Filtre territorial (patronat territorial uniquement) :
    // département exact → commune→département (Bénin) → ville = territoire.
    // ⭐ Les écoles SANS ville NI département (ex. CSPEB avant correction de
    //    sa fiche) restent proposées — flag locationUnknown — pour ne jamais
    //    exclure une école réelle de la découverte automatique.
    const territoryKey = normalizeTerritoryKey(territory);
    const inScope = isNational
      ? tenants
      : tenants.filter((t) => {
          const dept = t.schools?.department ?? null;
          if (dept && normalizeTerritoryKey(dept) === territoryKey) return true;
          const city = t.schools?.city ?? null;
          if (city && territoryIncludesCity(territory, city)) return true;
          return false;
        });
    const unknownLocation = !isNational
      ? tenants.filter(
          (t) => !t.schools?.department && !t.schools?.city,
        )
      : [];

    const toSchoolDto = (t: (typeof tenants)[number], locationUnknown = false) => {
      const link = linkAgg.get(t.id);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        subdomain: t.subdomain,
        tenantType: t.type,
        logo: this.resolveSchoolLogo(t),
        city: t.schools?.city ?? null,
        department: t.schools?.department ?? null,
        // ⭐ Département résolu : fiche School.department, sinon ville →
        //    département (carte des 77 communes) — catégorisation par
        //    département pour le patronat national.
        resolvedDepartment:
          t.schools?.department ?? cityToDepartment(t.schools?.city) ?? null,
        locationUnknown,
        address: t.schools?.address ?? null,
        phone: t.schools?.primaryPhone ?? null,
        email: t.schools?.primaryEmail ?? null,
        linkStatus: link?.status ?? null,
        // ⭐ Patronat dépositaire du lien (vision nationale) — ex. « Patronat
        //    des Établissements Scolaires Privés du Borgou ».
        linkPatronat: link?.patronatName ?? null,
      };
    };

    return {
      scope: isNational ? 'COUNTRY' : 'DEPARTMENT',
      territoryName: isNational ? patronat.country?.name ?? null : territory,
      country: patronat.country?.name ?? null,
      orgLevel: patronat.orgLevel,
      message: null as string | null,
      total: inScope.length + unknownLocation.length,
      schools: inScope.map((t) => toSchoolDto(t)),
      // ⭐ Écoles sans localisation renseignée (patronat territorial) —
      //    proposées séparément pour ne bloquer aucune adhésion.
      unlocatedSchools: unknownLocation.map((t) => toSchoolDto(t, true)),
    };
  }

  /**
   * Demande de rattachement d'une école Helm existante (validation par l'école).
   *
   * ⭐ ATTRIBUTATION DÉPARTEMENTALE (2026-09-29 #2) : lorsque la demande est
   * émise par le patronat NATIONAL, le système considère qu'elle se joue
   * « sous le département de l'école » : le lien est créé au nom du patronat
   * TERRITORIAL (défaut : enfant du national) couvrant le département de
   * l'école (fiche School.department, sinon ville → département). Lorsque
   * l'école accepte, elle se retrouve donc rattachée au patronat de SON
   * département — et non au national. À défaut de patronat départemental
   * couvrant le département (ou d'année scolaire active chez lui), la demande
   * retombe sur le patronat national lui-même.
   */
  async requestSchoolLink(tenantId: string, userId: string, dto: RequestSchoolLinkDto) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    const school = await this.prisma.tenant.findFirst({
      // ⭐ FIX : accepter TOUS les types d'établissement (MATERNELLE/PRIMAIRE/
      //    SECONDAIRE/MIXTE/SCHOOL) — sinon « École Academia Helm introuvable »
      //    pour toutes les écoles réelles créées par l'onboarding Helm.
      where: { id: dto.schoolTenantId, type: schoolTenantTypeFilter() },
      include: { schools: { select: { city: true, department: true } } },
    });
    if (!school) throw new NotFoundException('École Academia Helm introuvable.');

    // ── Attribution au patronat départemental de l'école (demande nationale) ──
    let targetPatronat = patronat as {
      id: string;
      tenantId: string;
      name: string;
      territoryName: string | null;
      orgLevel: string;
      subscriptionPlan: string;
    };
    let attributedTo: { name: string; territoryName: string | null } | null = null;

    const schoolDepartment =
      school.schools?.department ?? cityToDepartment(school.schools?.city) ?? null;

    if (patronat.orgLevel === 'NATIONAL' && schoolDepartment) {
      const deptKeys = departmentKeys(schoolDepartment);
      // Patronats territoriaux du pays — enfants du national en priorité,
      // puis tous les territoriaux du pays (même pays, couverture du dept).
      const territorial = await this.prisma.patronat.findMany({
        where: {
          orgLevel: 'TERRITORIAL',
          ...(patronat.countryId ? { countryId: patronat.countryId } : {}),
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          territoryName: true,
          orgLevel: true,
          subscriptionPlan: true,
          parentPatronatId: true,
        },
      });
      const match =
        territorial.find(
          (p) =>
            p.parentPatronatId === patronat.id &&
            territoryIncludesKeys(p.territoryName, deptKeys),
        ) ??
        territorial.find((p) => territoryIncludesKeys(p.territoryName, deptKeys)) ??
        null;

      if (match) {
        // Le patronat départemental doit disposer d'une année scolaire active
        // pour porter le lien (academicYearId obligatoire).
        const territorialYear = await this.getActiveYear(match.tenantId);
        if (territorialYear) {
          targetPatronat = match;
          attributedTo = { name: match.name, territoryName: match.territoryName };
        }
      }
    }

    const academicYear = await this.getActiveYear(targetPatronat.tenantId);
    if (!academicYear) {
      throw new BadRequestException(
        "Aucune année scolaire active — impossible d'initier un rattachement.",
      );
    }

    // Un lien existe-t-il déjà pour le patronat cible ?
    const existing = await this.prisma.patronatSchool.findFirst({
      where: { patronatId: targetPatronat.id, schoolTenantId: school.id },
    });
    if (existing && (existing.status === 'PENDING' || existing.status === 'JOINED')) {
      throw new BadRequestException(
        existing.status === 'PENDING'
          ? `Une demande de rattachement est déjà en attente pour cette école${
              attributedTo ? ` auprès du ${attributedTo.name}` : ''
            }.`
          : `Cette école est déjà rattachée${
              attributedTo ? ` au ${attributedTo.name}` : ' à votre patronat'
            }.`,
      );
    }

    // Quota d'écoles du plan (alerte à 80 % / 100 %, jamais de facturation auto)
    const plan =
      FEDERIS_PLANS[targetPatronat.subscriptionPlan as FederisPlanCode] ??
      FEDERIS_PLANS.ESSENTIEL;
    const currentCount = await this.prisma.patronatSchool.count({
      where: { patronatId: targetPatronat.id, status: 'JOINED' },
    });
    if (currentCount >= plan.maxSchools) {
      throw new BadRequestException(
        `Quota d'écoles atteint pour l'offre ${plan.name}${
          attributedTo ? ` du ${attributedTo.name}` : ''
        } (${plan.maxSchools}). Passez à l'offre Institution ou contactez l'équipe.`,
      );
    }

    // ⭐ Re-sollicitation : un lien REJECTED/SUSPENDED est réactivé en PENDING
    //    (nouvelle demande) plutôt que bloqué — l'école statue à nouveau.
    const membership = existing
      ? await this.prisma.patronatSchool.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            academicYearId: academicYear.id,
            suspendedAt: null,
            suspendedBy: null,
            suspendedReason: null,
            metadata: {
              ...((existing.metadata as object) ?? {}),
              ...(attributedTo
                ? {
                    requestedByNational: true,
                    requestedByPatronatId: patronat.id,
                    requestedByPatronatName: patronat.name,
                  }
                : {}),
              reRequestedAt: new Date().toISOString(),
            },
          },
        })
      : await this.prisma.patronatSchool.create({
          data: {
            patronatId: targetPatronat.id,
            tenantId: targetPatronat.tenantId,
            schoolTenantId: school.id,
            academicYearId: academicYear.id,
            status: 'PENDING',
            accessLevel: 'READ_ONLY',
            createdBy: userId,
            ...(attributedTo
              ? {
                  metadata: {
                    requestedByNational: true,
                    requestedByPatronatId: patronat.id,
                    requestedByPatronatName: patronat.name,
                  },
                }
              : {}),
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
        newData: {
          school: school.name,
          status: 'PENDING',
          ...(attributedTo
            ? { attributedTo: attributedTo.name, department: schoolDepartment }
            : {}),
        },
      },
    });
    // Double traçabilité côté patronat dépositaire du lien
    if (attributedTo && targetPatronat.tenantId !== patronat.tenantId) {
      await this.prisma.auditLog
        .create({
          data: {
            tenantId: targetPatronat.tenantId,
            userId,
            action: 'FEDERIS_SCHOOL_LINK_REQUESTED',
            resource: 'PatronatSchool',
            resourceId: membership.id,
            tableName: 'patronat_schools',
            recordId: membership.id,
            newData: {
              school: school.name,
              status: 'PENDING',
              requestedBy: patronat.name,
              department: schoolDepartment,
            },
          },
        })
        .catch(() => undefined);
    }

    return {
      success: true,
      membership,
      // ⭐ Patronat départemental dépositaire de la demande (null = le
      //    patronat demandeur lui-même porte le lien).
      attributedTo,
      department: schoolDepartment,
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
      amountXOF: resolvePlanAmount(plan, patronat.orgLevel),
      orgLevel: patronat.orgLevel,
      patronatName: patronat.name,
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
   * ⭐ Barème dynamique (par niveau organisationnel) — alimente la page
   * checkout : montants réels selon que l'abonné est le patronat courant ou
   * un patronat territorial créé par le national (patronatId).
   */
  async getPricing(tenantId: string, userId?: string, patronatId?: string) {
    const caller = await this.resolvePatronat(tenantId, userId);

    let target = caller;
    let payingForChild = false;
    if (patronatId && patronatId !== caller.id) {
      target = await this.resolveChildPatronat(caller, patronatId);
      payingForChild = true;
    }

    return {
      orgLevel: target.orgLevel,
      patronatName: target.name,
      payingForChild,
      plans: (Object.keys(FEDERIS_PLANS) as FederisPlanCode[]).map((code) => {
        const plan = FEDERIS_PLANS[code];
        return {
          code: plan.code,
          name: plan.name,
          amountXOF: resolvePlanAmount(plan, target.orgLevel),
          period: plan.period,
          maxSchools: plan.maxSchools,
          maxCandidates: plan.maxCandidates,
          maxActiveCampaigns: plan.maxActiveCampaigns,
        };
      }),
    };
  }

  /**
   * Résout un patronat TERRITORIAL pour lequel le demandeur (national) règle
   * l'abonnement — le demandeur doit être son patronat parent.
   */
  private async resolveChildPatronat(
    caller: { id: string; orgLevel: string | null },
    patronatId: string,
  ) {
    const child = await this.prisma.patronat.findFirst({
      where: { id: patronatId },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        country: { select: { id: true, code: true, name: true } },
        territorialLevel: { select: { id: true, code: true, label: true, order: true } },
        parentPatronat: {
          select: { id: true, name: true, orgLevel: true, territoryName: true },
        },
      },
    });
    if (!child) {
      throw new NotFoundException('Patronat territorial introuvable.');
    }
    if (child.parentPatronatId !== caller.id) {
      throw new ForbiddenException(
        'Vous ne pouvez régler l\u2019abonnement que des patronats rattachés à votre réseau national.',
      );
    }
    return child;
  }

  /**
   * Niveaux territoriaux configurés sous le national (formulaire de création
   * d'un patronat territorial — sélecteur « Département / Commune… »).
   */
  async getTerritorialLevels(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    if (patronat.orgLevel !== 'NATIONAL') {
      throw new ForbiddenException('Réservé au patronat national.');
    }
    try {
      const levels = await this.prisma.countryTerritorialLevel.findMany({
        where: { countryId: patronat.countryId ?? undefined, isActive: true, order: { gt: 1 } },
        select: { id: true, code: true, label: true, order: true },
        orderBy: { order: 'asc' },
      });
      return { levels };
    } catch (err) {
      const code = (err as any)?.code;
      if (code === 'P2021' || code === 'P2022' || code === 'P2024') {
        return { levels: [] };
      }
      throw err;
    }
  }

  /**
   * ⭐ Identité publique du patronat (nom, logo, coordonnées) — configurée
   * depuis l'application par le coordonnateur. Alimente la page Paramètres
   * (onglet Informations) et la landing page du sous-domaine via
   * /federis/public/patronat-info.
   */
  async getIdentity(tenantId: string, userId?: string) {
    const patronat = await this.resolvePatronat(tenantId, userId);
    return {
      id: patronat.id,
      name: patronat.name,
      abbreviation: patronat.abbreviation,
      logo: patronat.logo,
      legalName: patronat.legalName,
      primaryEmail: patronat.primaryEmail,
      primaryPhone: patronat.primaryPhone,
      address: patronat.address,
      website: patronat.website,
      orgLevel: patronat.orgLevel,
      territoryName: patronat.territoryName,
      country: patronat.country,
      territorialLevel: patronat.territorialLevel,
    };
  }

  /**
   * Mise à jour de l'identité du patronat (nom, logo, coordonnées).
   * Réservée au COORDONNATEUR (même garde que la gestion des comptes).
   * Le nom du Tenant est synchronisé (affiché dans la session / topbar) et le
   * logo alimente la landing page du sous-domaine du patronat.
   */
  async updateIdentity(tenantId: string, userId: string, dto: UpdatePatronatIdentityDto) {
    const patronat = await this.resolvePatronat(tenantId, userId);

    // Garde fonction : coordonnateur uniquement (pattern FederisUsersService)
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    if (!MANAGE_USERS.includes(fn as PatronatFunction)) {
      throw new ForbiddenException(
        "La modification de l'identité du patronat est réservée au coordonnateur.",
      );
    }

    // Logo : data URL (optimisée via /media/optimize) ou URL https — ou null
    // pour retirer le logo personnalisé.
    if (dto.logo != null && dto.logo !== '') {
      const isHttp = /^https:\/\//i.test(dto.logo);
      const isDataUrl = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/i.test(dto.logo);
      if (!isHttp && !isDataUrl) {
        throw new BadRequestException(
          'Logo invalide : fournissez une image (PNG, JPEG, WebP, SVG) ou une URL https.',
        );
      }
    }
    if (dto.primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.primaryEmail.trim())) {
      throw new BadRequestException('Adresse électronique invalide.');
    }

    const data: Record<string, string | null> = {
      name: dto.name.trim(),
      abbreviation: dto.abbreviation?.trim() || null,
      logo: dto.logo ? dto.logo : null,
      primaryEmail: dto.primaryEmail?.trim().toLowerCase() || null,
      primaryPhone: dto.primaryPhone?.trim() || null,
      address: dto.address?.trim() || null,
      website: dto.website?.trim() || null,
    };

    const [updated] = await this.prisma.$transaction([
      this.prisma.patronat.update({
        where: { id: patronat.id },
        data,
        select: { id: true, name: true, logo: true, abbreviation: true },
      }),
      // Le nom du tenant suit (topbar / listes Helm)
      this.prisma.tenant.update({
        where: { id: patronat.tenantId },
        data: { name: dto.name.trim() },
        select: { id: true },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_PATRONAT_IDENTITY_UPDATED',
        resource: 'Patronat',
        resourceId: patronat.id,
        tableName: 'patronats',
        recordId: patronat.id,
        newData: {
          name: updated.name,
          logo: updated.logo ? '(mis à jour)' : '(retiré)',
        },
      },
    });

    this.logger.log(`Identité patronat mise à jour : « ${updated.name} » (tenant ${patronat.tenantId})`);
    return { success: true, patronat: updated };
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
    const caller = await this.resolvePatronat(tenantId, userId);
    const plan = FEDERIS_PLANS[dto.plan];
    if (!plan) throw new BadRequestException('Offre invalide. Offres : ESSENTIEL, INSTITUTION.');

    // ── 0. Cible du paiement ──
    // ⭐ Même flux payant que l'inscription publique : le niveau national
    //    règle ici l'abonnement d'un patronat TERRITORIAL qu'il a créé
    //    (dto.patronatId). Sans patronatId, l'abonné est le patronat courant.
    //    La facture cible l'enfant → l'activation (webhook / verify) attribue
    //    le sous-domaine et envoie l'email à L'ENFANT, exactement comme le
    //    flux public.
    let patronat = caller;
    let payingForChild = false;
    if (dto.patronatId && dto.patronatId !== caller.id) {
      patronat = await this.resolveChildPatronat(caller, dto.patronatId);
      payingForChild = true;
    }

    // ⭐ Tarification par niveau organisationnel : le barème du NATIONAL est
    //    supérieur à celui des territoriaux / départementaux.
    const amountXOF = resolvePlanAmount(plan, patronat.orgLevel);

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
          plan: { code: plan.code, name: plan.name, amountXOF },
          patronatId: patronat.id,
          payingForChild,
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
              amount: amountXOF,
              currency: 'XOF',
              dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
              status: 'UNPAID',
              type: 'SUBSCRIPTION',
              metadata: {
                plan: plan.code,
                period: 'SCHOOL_YEAR',
                initiatedBy: userId,
                ...(payingForChild ? { paidByParentTenantId: caller.tenantId } : {}),
              },
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
          newData: {
            plan: plan.code,
            amount: amountXOF,
            provider: 'MANUAL',
            ...(payingForChild ? { payingFor: patronat.name } : {}),
          },
        },
      });
      return {
        success: true,
        invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount },
        plan: { code: plan.code, name: plan.name, amountXOF },
        patronatId: patronat.id,
        payingForChild,
        provider: 'MANUAL',
        paymentUrl: null,
        message:
          "Facture créée. Fedapay n'est pas configuré sur cet environnement (mode développement) — l'équipe activera l'abonnement après règlement.",
      };
    }

    // ⭐ Erreurs PROPAGÉES (pattern Helm) : si Fedapay refuse, la VRAIE cause
    //    remonte au frontend au lieu du message trompeur « non configuré ».
    // ⭐ Customer = pattern Helm signup (promoteur du draft) : le responsable
    //    qui déclenche le paiement, avec le VRAI pays du patronat (pilote la
    //    normalisation du téléphone : nouveau plan béninois 01XXXXXXXX, etc.).
    const payingUser = await this.prisma.user
      .findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      })
      .catch(() => null);
    let responsible: { firstname: string | null; lastname: string | null } | null =
      payingUser?.firstName
        ? { firstname: payingUser.firstName, lastname: payingUser.lastName }
        : null;
    if (!responsible) {
      // Fallback : le président du bureau du patronat (créé à l'inscription).
      const president = await this.prisma.patronatBureauMember
        .findFirst({
          where: { patronatId: patronat.id, role: 'PRESIDENT', isActive: true },
          select: { firstName: true, lastName: true },
        })
        .catch(() => null);
      if (president?.firstName) {
        responsible = { firstname: president.firstName, lastname: president.lastName };
      }
    }

    const tx = await this.fedapayService.createSubscriptionTransaction({
      invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount },
      patronat: {
        id: patronat.id,
        tenantId: patronat.tenantId,
        name: patronat.name,
        primaryEmail: patronat.primaryEmail,
        primaryPhone: patronat.primaryPhone,
        countryName: patronat.country?.name ?? null,
        responsible,
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
          amount: amountXOF,
          provider: 'FEDAPAY',
          providerTransactionId: tx.transactionId,
          reusedInvoice: invoice.id === existing?.id,
          ...(payingForChild ? { payingFor: patronat.name } : {}),
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
      plan: { code: plan.code, name: plan.name, amountXOF },
      patronatId: patronat.id,
      payingForChild,
      provider: 'FEDAPAY',
      paymentUrl: tx.paymentUrl,
      message: 'Paiement Fedapay initialisé.',
    };
  }
}
