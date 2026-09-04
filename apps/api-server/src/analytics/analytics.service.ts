/**
 * ============================================================================
 * ANALYTICS SERVICE — Vue stratégique consolidée multi-écoles (promoteur)
 * ============================================================================
 *
 * Calcule les KPIs de CHACUN des établissements du périmètre du promoteur,
 * puis les consolide au niveau du groupe.
 *
 * Périmètre de résolution (défense en profondeur — miroir de
 * auth.service.getAvailableTenants / selectTenant) :
 *   - Rôles plateforme (PLATFORM_OWNER / SUPER_ADMIN) → TOUS les tenants actifs
 *     de type SCHOOL (vue de support/dépannage).
 *   - Promoteur → relations UserTenant actives ∪ tenant direct du user.
 *   - Tout autre rôle → refusé en amont par le contrôleur (403).
 *
 * ⚠️ Isolation : les KPIs sont calculés PAR école (requêtes filtrées par
 * tenantId), jamais en mélangeant les données. La consolidation ne fait que
 * sommer / moyenner pondérer les valeurs déjà isolées.
 *
 * Résilience : si la table user_tenants n'existe pas encore en base
 * (migration non appliquée), on retombe silencieusement sur le tenant direct.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Rôles autorisés à consulter la vue stratégique consolidée. */
const STRATEGIC_ROLES = [
  'PROMOTER',
  'PROMOTEUR',
  'SCHOOL_OWNER',
  'SUPER_DIRECTOR',
  'PLATFORM_OWNER',
  'SUPER_ADMIN',
];

export function isStrategicRole(user: { role?: string; isSuperAdmin?: boolean }): boolean {
  if (user?.isSuperAdmin) return true;
  return STRATEGIC_ROLES.includes(user?.role || '');
}

interface ScopedUser {
  sub: string;
  role?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * KPIs consolidés du groupe scolaire du promoteur.
   *
   * Pour chaque école : effectifs élèves/enseignants, recettes encaissées,
   * impayés et taux de recouvrement — sur l'année académique ACTIVE de
   * l'école (toutes périodes si aucune année active n'est configurée).
   */
  async getConsolidatedKpis(user: ScopedUser) {
    const tenants = await this.resolveScope(user);
    const tenantIds = tenants.map((t) => t.id);

    // Année académique active par école (la plus récente si plusieurs)
    const activeYears = await this.prisma.academicYear.findMany({
      where: { tenantId: { in: tenantIds }, isActive: true },
      select: { id: true, tenantId: true, name: true, startDate: true },
      orderBy: { startDate: 'desc' },
    });
    const activeYearByTenant = new Map<string, { id: string; name: string }>();
    for (const year of activeYears) {
      if (!activeYearByTenant.has(year.tenantId)) {
        activeYearByTenant.set(year.tenantId, { id: year.id, name: year.name });
      }
    }

    // ⭐ KPIs par école — calculs isolés par tenant (jamais de mélange),
    // parallélisés (le périmètre d'un groupe est de l'ordre de quelques écoles).
    const bySchool = await Promise.all(
      tenants.map(async (tenant) => {
        const activeYear = activeYearByTenant.get(tenant.id) || null;
        // Filtre année : paiements de l'année active de CETTE école (ou sans
        // année rattachée) ; toutes périodes si l'école n'a pas d'année active.
        const yearFilter = activeYear
          ? { OR: [{ academicYearId: activeYear.id }, { academicYearId: null }] }
          : {};

        const [totalStudents, totalTeachers, paymentGroups] = await Promise.all([
          this.prisma.student
            .count({ where: { tenantId: tenant.id, status: 'ACTIVE' } })
            .catch(() => 0),
          this.prisma.teacher
            .count({ where: { tenantId: tenant.id, status: 'active' } })
            .catch(() => 0),
          this.prisma.payment
            .groupBy({
              by: ['status'],
              where: { tenantId: tenant.id, ...yearFilter },
              _sum: { amount: true },
              _count: { id: true },
            })
            .catch(() => [] as any[]),
        ]);

        let totalRevenue = 0;
        let unpaidAmount = 0;
        let completedCount = 0;
        let totalCount = 0;
        for (const group of paymentGroups as any[]) {
          const amount = Number(group._sum?.amount ?? 0) || 0;
          totalCount += group._count?.id ?? 0;
          if (group.status === 'completed') {
            totalRevenue += amount;
            completedCount += group._count?.id ?? 0;
          } else {
            unpaidAmount += amount;
          }
        }
        const recoveryRate =
          totalCount === 0 ? 100 : Math.round((completedCount / totalCount) * 100);

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          schoolName: tenant.schools?.name || tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain,
          city: tenant.schools?.city ?? null,
          country: tenant.country?.name ?? null,
          logoUrl: tenant.schools?.logo ?? null,
          periodLabel: activeYear?.name || 'Toutes périodes',
          kpi: {
            totalStudents,
            totalTeachers,
            totalRevenue,
            unpaidAmount,
            recoveryRate,
            currency: 'XOF',
          },
        };
      }),
    );

    // ⭐ Consolidation du groupe — sommes, puis moyenne PONDÉRÉE du taux de
    // recouvrement (pondération par le nombre de paiements : une école avec
    // 500 paiements pèse plus qu'une école avec 3 paiements).
    const consolidated = bySchool.reduce(
      (acc, school) => {
        acc.totalStudents += school.kpi.totalStudents;
        acc.totalTeachers += school.kpi.totalTeachers;
        acc.totalRevenue += school.kpi.totalRevenue;
        acc.unpaidAmount += school.kpi.unpaidAmount;
        return acc;
      },
      {
        totalStudents: 0,
        totalTeachers: 0,
        totalRevenue: 0,
        unpaidAmount: 0,
        currency: 'XOF',
        averageRecoveryRate: 0,
      },
    );

    // Poids réels = nombre de paiements de chaque école (même filtre année).
    const paymentCounts = await Promise.all(
      tenants.map((tenant) => {
        const activeYear = activeYearByTenant.get(tenant.id);
        const yearFilter = activeYear
          ? { OR: [{ academicYearId: activeYear.id }, { academicYearId: null }] }
          : {};
        return this.prisma.payment
          .count({ where: { tenantId: tenant.id, ...yearFilter } })
          .catch(() => 0);
      }),
    );
    let totalPayments = 0;
    let weightedSum = 0;
    paymentCounts.forEach((count, index) => {
      totalPayments += count;
      weightedSum += (bySchool[index]?.kpi.recoveryRate ?? 0) * count;
    });
    consolidated.averageRecoveryRate =
      totalPayments === 0 ? 0 : Math.round(weightedSum / totalPayments);

    // Libellé de période global : nom unique si toutes les écoles partagent
    // la même année active, sinon libellé générique.
    const yearNames = new Set(bySchool.map((s) => s.periodLabel));
    const periodLabel =
      yearNames.size === 1
        ? (yearNames.values().next().value as string)
        : 'Années académiques actives';

    return {
      totalSchools: bySchool.length,
      consolidated,
      bySchool,
      periodLabel,
    };
  }

  /**
   * Résout le périmètre d'écoles visible par l'utilisateur.
   */
  private async resolveScope(user: ScopedUser) {
    const include = {
      schools: { select: { name: true, logo: true, city: true } },
      country: { select: { name: true, code: true } },
    } as const;

    // Rôles plateforme → vue de support sur TOUS les tenants école actifs
    if (user?.isSuperAdmin || ['PLATFORM_OWNER', 'SUPER_ADMIN'].includes(user?.role || '')) {
      return this.prisma.tenant.findMany({
        where: { status: 'active', type: 'SCHOOL' },
        include,
        orderBy: { name: 'asc' },
      });
    }

    // Promoteur → UserTenant actives ∪ tenant direct
    const tenantIds = new Set<string>();
    try {
      const userTenants = await this.prisma.userTenant.findMany({
        where: { userId: user.sub, isActive: true },
        select: { tenantId: true },
      });
      for (const ut of userTenants) {
        tenantIds.add(ut.tenantId);
      }
    } catch (err: any) {
      this.logger.warn(
        `⚠️ UserTenant indisponible (périmètre réduit au tenant direct) : ${err?.message || err}`,
      );
    }
    if (user.tenantId) {
      tenantIds.add(user.tenantId);
    }

    if (tenantIds.size === 0) {
      return [];
    }

    return this.prisma.tenant.findMany({
      where: { id: { in: Array.from(tenantIds) }, status: 'active', type: 'SCHOOL' },
      include,
      orderBy: { name: 'asc' },
    });
  }
}
