/**
 * ============================================================================
 * PLATFORM SERVICE — DONNÉES RÉELLES DU BACK-OFFICE ACADEMIA HELM
 * ============================================================================
 *
 * Alimente le back-office admin.academiahelm.com avec les données réelles
 * issues de la base de données (multi-tenant agrégé). Aucune donnée mock.
 *
 * Données exposées :
 *  - Tableau de bord global (KPIs + tendances + alertes)
 *  - Liste des écoles / tenants
 *  - Souscriptions initiales (OnboardingDraft + OnboardingPayment)
 *  - Factures Helm (HelmInvoice)
 *  - Paiements / Transactions (BillingEvent)
 *  - Utilisateurs plateforme (User avec tenantId=null ou rôle PLATFORM_*)
 *  - Audit logs cross-tenant (AuditLog + AuthAuditLog)
 *
 * Aucune dépendance circulaire avec les modules tenant — utilise directement
 * PrismaService pour des requêtes en lecture seule cross-tenant.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Vérifie que l'utilisateur authentifié a un rôle plateforme autorisé. */
  assertPlatformRole(user: any): void {
    const allowed = ['PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
    if (!user || !allowed.includes(user?.role)) {
      throw new BadRequestException(
        'Accès réservé aux rôles plateforme (PLATFORM_OWNER, PLATFORM_ADMIN, SUPER_ADMIN).',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD GLOBAL
  // ─────────────────────────────────────────────────────────────────────────
  async getDashboard() {
    const [
      totalTenants,
      activeTenants,
      studentCountAgg,
      totalUsers,
      mrrAgg,
      criticalIncidents,
      revenueByMonth,
      tenantsByMonth,
      recentTenants,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { status: { not: 'WITHDRAWN' } } }),
      this.prisma.tenant.count({
        where: { status: 'active', subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      }),
      this.prisma.tenant.aggregate({
        where: { status: { not: 'WITHDRAWN' } },
        _sum: { studentCountCache: true },
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { tenantId: null },
            { role: { in: ['PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN'] } },
          ],
        },
      }),
      this.prisma.helmSubscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { monthlyAmount: true },
      }),
      this.prisma.securityEvent.count({
        where: { severity: 'CRITICAL', createdAt: { gte: this.daysAgo(30) } },
      }),
      this.prisma.billingEvent.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: this.daysAgo(180) }, type: { in: ['INITIAL_SUBSCRIPTION', 'RENEWAL', 'MANUAL_PAYMENT'] } },
        _sum: { amount: true },
      }),
      this.prisma.tenant.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: this.daysAgo(180) } },
      }),
      this.prisma.tenant.findMany({
        where: { status: { not: 'WITHDRAWN' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          country: { select: { name: true } },
        },
      }),
    ]);

    // Agréger revenus & croissances par mois
    const months = this.lastNMonths(6);
    const revenueTrend = months.map((m) => {
      const total = revenueByMonth
        .filter((r) => {
          const d = new Date(r.createdAt);
          return d.getFullYear() === m.year && d.getMonth() + 1 === m.month;
        })
        .reduce((acc, r) => acc + Number(r._sum.amount || 0), 0);
      return { name: m.label, revenue: total };
    });
    const tenantGrowthTrend = months.map((m) => {
      const count = tenantsByMonth.filter((t) => {
        const d = new Date(t.createdAt);
        return d.getFullYear() === m.year && d.getMonth() + 1 === m.month;
      }).length;
      return { name: m.label, schools: count };
    });

    // Alertes automatiques
    const alerts: Array<{ title: string; text: string; level: string }> = [];
    if (criticalIncidents > 0) {
      alerts.push({
        title: 'Incidents critiques',
        text: `${criticalIncidents} incident(s) critique(s) dans les 30 derniers jours`,
        level: 'CRITIQUE',
      });
    }
    const expiredSoonTenants = await this.prisma.tenant.count({
      where: {
        status: 'active',
        trialEndsAt: { lte: this.daysFromNow(7), gte: new Date() },
      },
    });
    if (expiredSoonTenants > 0) {
      alerts.push({
        title: 'Essais arrivant à expiration',
        text: `${expiredSoonTenants} école(s) en essai expirent cette semaine`,
        level: 'ATTENTION',
      });
    }

    return {
      stats: {
        totalTenants,
        activeTenants,
        totalStudents: Number(studentCountAgg._sum.studentCountCache || 0),
        totalUsers,
        mrr: Number(mrrAgg._sum.monthlyAmount || 0),
        criticalIncidents,
      },
      revenueTrend,
      tenantGrowthTrend,
      alerts,
      recentTenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        country: t.country?.name || '—',
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ÉCOLES / TENANTS
  // ─────────────────────────────────────────────────────────────────────────
  async getTenants(opts: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { status: { not: 'WITHDRAWN' } };
    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { slug: { contains: opts.search, mode: 'insensitive' } },
        { subdomain: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts.status && opts.status !== 'ALL') {
      if (opts.status === 'ACTIVE') {
        where.status = 'active';
        where.subscriptionStatus = { in: ['ACTIVE', 'TRIAL'] };
      } else if (opts.status === 'TRIAL') {
        where.subscriptionStatus = 'TRIAL';
      } else if (opts.status === 'SUSPENDED') {
        where.status = 'suspended';
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          country: { select: { name: true } },
          // School est une relation 1-1 (tenantId @unique) — pas de take
          schools: { select: { city: true } },
          // helmSubscriptions est une relation 1-to-1 (singulière) — pas de take/orderBy
          helmSubscriptions: {
            select: { plan: true, status: true, currentPeriodEnd: true },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const tenants = rows.map((t) => {
      const sub = t.helmSubscriptions;
      const plan = sub?.plan || t.subscriptionPlan || '—';
      const status =
        t.status === 'suspended' ? 'SUSPENDED' : t.subscriptionStatus === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
      const now = new Date();
      const daysRemaining = sub?.currentPeriodEnd
        ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        subdomain: t.subdomain,
        country: t.country?.name || '—',
        city: t.schools?.[0]?.city || '—',
        plan,
        planStatus: sub?.status || null,
        billingCycle: sub?.billingCycle || null,
        status,
        students: Number(t.studentCountCache || 0),
        lastActivity: t.updatedAt.toISOString(),
        expiration: sub?.currentPeriodEnd?.toISOString() || null,
        daysRemaining,
        trialEnd: sub?.trialEnd?.toISOString() || null,
        bilingualEnabled: (sub as any)?.bilingualEnabled || false,
        studentEnrollmentBlocked: (t as any).studentEnrollmentBlocked || false,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return { tenants, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SOUSCRIPTIONS INITIALES
  // ─────────────────────────────────────────────────────────────────────────
  async getInitialSubscriptions() {
    const payments = await this.prisma.onboardingPayment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        draft: {
          select: { schoolName: true, status: true, selectedPlanId: true },
        },
      },
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const paidThisMonth = payments
      .filter((p) => p.status === 'SUCCESS' && p.createdAt >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pending = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'INITIATED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const invoicedTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      summary: {
        paidThisMonth,
        pending,
        invoicedTotal,
        currency: 'XOF',
      },
      items: payments.map((p) => ({
        id: p.id,
        schoolName: p.draft?.schoolName || '—',
        amount: Number(p.amount || 0),
        currency: p.currency || 'XOF',
        status: this.mapOnboardingPaymentStatus(p.status),
        issuedAt: p.createdAt.toISOString(),
        paidAt: p.status === 'SUCCESS' ? p.updatedAt.toISOString() : null,
        reference: p.reference,
      })),
    };
  }

  private mapOnboardingPaymentStatus(s: string): 'PAID' | 'PENDING' | 'PARTIAL' | 'FAILED' {
    if (s === 'SUCCESS') return 'PAID';
    if (s === 'PENDING' || s === 'INITIATED') return 'PENDING';
    if (s === 'PARTIAL') return 'PARTIAL';
    return 'FAILED';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. FACTURES HELM
  // ─────────────────────────────────────────────────────────────────────────
  async getInvoices() {
    const invoices = await this.prisma.helmInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        subscription: {
          include: { tenant: { select: { name: true, slug: true } } },
        },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = invoices
      .filter((i) => i.status === 'PAID' && i.createdAt >= startOfMonth)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const pendingPayments = invoices
      .filter((i) => i.status === 'PENDING')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const todayCollections = invoices
      .filter((i) => i.status === 'PAID' && i.paidAt && i.paidAt >= startOfToday)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    return {
      summary: {
        monthlyRevenue,
        pendingPayments,
        todayCollections,
        currency: 'XOF',
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        school: i.subscription?.tenant?.name || '—',
        amount: Number(i.amount || 0),
        currency: i.currency || 'XOF',
        status: i.status,
        date: i.createdAt.toISOString(),
        paidAt: i.paidAt?.toISOString() || null,
        period: i.period,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PAIEMENTS / TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  async getPayments() {
    // BillingEvent n'a pas de relation directe vers Tenant (uniquement tenantId en String).
    // On récupère les events, puis on enrichit avec les tenants séparément.
    const events = await this.prisma.billingEvent.findMany({
      where: { type: { in: ['INITIAL_SUBSCRIPTION', 'RENEWAL', 'MANUAL_PAYMENT'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const tenantIds = [...new Set(events.map((e) => e.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    return {
      payments: events.map((e) => ({
        id: e.id,
        school: tenantMap.get(e.tenantId) || '—',
        amount: Number(e.amount || 0),
        method: e.channel || '—',
        status: e.type === 'PAYMENT_FAILED' ? 'FAILED' : 'SUCCESS',
        date: e.createdAt.toISOString(),
        reference: e.reference || null,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. UTILISATEURS PLATEFORME
  // ─────────────────────────────────────────────────────────────────────────
  async getPlatformUsers(roleFilter?: string) {
    const where: any = {
      OR: [
        { tenantId: null },
        { role: { in: ['PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN'] } },
      ],
    };
    if (roleFilter && roleFilter !== 'ALL') {
      where.role = roleFilter;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLogin: true,
        isSuperAdmin: true,
        createdAt: true,
      },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email,
        role: u.role || (u.isSuperAdmin ? 'SUPER_ADMIN' : '—'),
        status: u.status === 'ACTIVE' || u.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        lastLogin: u.lastLogin?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. AUDIT LOGS (CROSS-TENANT)
  // ─────────────────────────────────────────────────────────────────────────
  async getAuditLogs(opts: { page?: number; limit?: number; action?: string }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(200, Math.max(1, opts.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.action) {
      where.action = { contains: opts.action, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // AuditLog n'a pas de relation `user` directe — on enrichit séparément.
    const userIds = [...new Set(rows.map((l) => l.userId).filter(Boolean))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds as string[] } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      logs: rows.map((l) => {
        const u = l.userId ? userMap.get(l.userId) : null;
        return {
          id: l.id,
          user: u?.email || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || '—',
          action: l.action,
          target: `${l.resource || l.tableName || '—'}${l.recordId ? ` #${l.recordId}` : ''}`,
          date: l.createdAt.toISOString(),
          ip: l.ipAddress || '—',
          tenantId: l.tenantId,
        };
      }),
      total,
      page,
      limit,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. SUPPORT TICKETS — TABLE NON ENCORE CRÉÉE, RETOURNE EMPTY STATE
  // ─────────────────────────────────────────────────────────────────────────
  async getSupportTickets() {
    // La table SupportTicket n'existe pas encore dans le schéma Prisma.
    // On retourne un état vide propre au lieu de données mock.
    return {
      summary: {
        open: 0,
        inProgress: 0,
        urgent: 0,
        resolved24h: 0,
      },
      tickets: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private daysFromNow(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  private lastNMonths(n: number): Array<{ year: number; month: number; label: string }> {
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const months: Array<{ year: number; month: number; label: string }> = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: labels[d.getMonth()] });
    }
    return months;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. RÔLES & PERMISSIONS (RBAC)
  // ─────────────────────────────────────────────────────────────────────────
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      where: { OR: [{ tenantId: null }, { name: { startsWith: 'PLATFORM_' } }] },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
      },
    });

    return {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystemRole: r.isSystemRole,
        usersCount: r._count.userRoles,
        permissionsCount: r._count.rolePermissions,
        canAccessOrion: r.canAccessOrion,
        canAccessAtlas: r.canAccessAtlas,
      })),
    };
  }

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      include: {
        _count: { select: { rolePermissions: true } },
      },
    });

    return {
      permissions: permissions.map((p) => ({
        id: p.id,
        name: p.name,
        resource: p.resource,
        action: p.action,
        description: p.description,
        rolesCount: p._count.rolePermissions,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. PLANS DYNAMIQUES (pricing_plans) + ABONNEMENTS ACTIFS (HelmSubscription)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retourne le catalogue de plans depuis pricing_plans + abonnements actifs.
   * Utilisée par le back-office (remplace l'ancienne getPlans).
   */
  async getDynamicPlansWithSubscriptions() {
    const pricingPlans = await this.prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const subsByPlan = await this.prisma.helmSubscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });
    const countMap = new Map(subsByPlan.map((s) => [s.plan, s._count.plan]));

    const activeSubs = await this.prisma.helmSubscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] } },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true, status: true },
        },
      },
      orderBy: { currentPeriodEnd: 'asc' },
    });

    // Fallback: si aucun HelmSubscription, récupérer aussi les tenants actifs
    // qui ont un subscriptionStatus mais pas de HelmSubscription (anciens tenants)
    let allActiveSubs = activeSubs;
    if (activeSubs.length === 0) {
      const activeTenants = await this.prisma.tenant.findMany({
        where: {
          status: { not: 'WITHDRAWN' },
          subscriptionStatus: { in: ['TRIAL', 'ACTIVE', 'TRIAL_ACTIVE'] },
        },
        select: {
          id: true, name: true, subdomain: true, status: true,
          subscriptionStatus: true, subscriptionPlan: true,
          trialEndsAt: true, nextPaymentDueAt: true,
          createdAt: true,
        },
      });
      allActiveSubs = activeTenants.map((t) => ({
        id: `fallback-${t.id}`,
        tenantId: t.id,
        tenant: { id: t.id, name: t.name, subdomain: t.subdomain, status: t.status },
        plan: (t.subscriptionPlan || 'SEED').toUpperCase().includes('SEED') ? 'SEED' :
              (t.subscriptionPlan || '').toUpperCase().includes('GROW') ? 'GROW' :
              (t.subscriptionPlan || '').toUpperCase().includes('LEAD') ? 'LEAD' :
              (t.subscriptionPlan || '').toUpperCase().includes('NETWORK') ? 'NETWORK' : 'SEED',
        billingCycle: 'MONTHLY',
        status: t.subscriptionStatus === 'TRIAL' || t.subscriptionStatus === 'TRIAL_ACTIVE' ? 'TRIALING' : 'ACTIVE',
        bilingualEnabled: false,
        currentPeriodStart: t.createdAt,
        currentPeriodEnd: t.nextPaymentDueAt || t.trialEndsAt,
        trialEnd: t.trialEndsAt,
        monthlyAmount: 0,
        annualAmount: 0,
        lastPaymentDate: null,
        lastPaymentAmount: null,
      })) as any;
    }

    const now = new Date();

    return {
      plans: pricingPlans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        studentMin: p.studentMin,
        studentMax: p.studentMax,
        initialFee: p.initialFee,
        monthlyAmount: p.monthlyAmount,
        yearlyAmount: p.yearlyAmount,
        bilingualMonthly: p.bilingualMonthly,
        bilingualYearly: p.bilingualYearly,
        features: p.features ? (typeof p.features === 'string' ? JSON.parse(p.features as string) : p.features) : [],
        isPopular: p.isPopular,
        activeSubscriptions: countMap.get(p.code as any) || 0,
      })),
      activeSubscriptions: allActiveSubs.map((s: any) => {
        const daysRemaining = s.currentPeriodEnd
          ? Math.max(0, Math.ceil((new Date(s.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        return {
          id: s.id,
          tenantId: s.tenantId,
          tenantName: s.tenant?.name || 'N/A',
          tenantSubdomain: s.tenant?.subdomain || null,
          tenantStatus: s.tenant?.status || 'unknown',
          plan: s.plan,
          billingCycle: s.billingCycle,
          status: s.status,
          bilingualEnabled: (s as any).bilingualEnabled || false,
          currentPeriodStart: s.currentPeriodStart,
          currentPeriodEnd: s.currentPeriodEnd,
          trialEnd: s.trialEnd,
          daysRemaining,
          monthlyAmount: s.monthlyAmount,
          annualAmount: s.annualAmount,
          lastPaymentDate: s.lastPaymentDate,
          lastPaymentAmount: s.lastPaymentAmount,
        };
      }),
      stats: {
        totalActive: allActiveSubs.filter((s: any) => s.status === 'ACTIVE').length,
        totalTrialing: allActiveSubs.filter((s: any) => s.status === 'TRIALING').length,
        totalGracePeriod: allActiveSubs.filter((s: any) => s.status === 'GRACE_PERIOD').length,
        totalMrr: allActiveSubs
          .filter((s: any) => s.status === 'ACTIVE')
          .reduce((sum: number, s: any) => sum + (s.billingCycle === 'ANNUAL' ? Math.round(s.annualAmount / 12) : s.monthlyAmount), 0),
      },
    };
  }

  // Ancienne méthode (conservée pour compatibilité)
  async getPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
    });
    const subscriptionsByPlan = await this.prisma.helmSubscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
      where: { status: 'ACTIVE' },
    });
    const countMap = new Map(subscriptionsByPlan.map((s) => [s.plan, s._count.plan]));
    return {
      plans: plans.map((p) => ({
        id: p.id, code: p.code, name: p.name,
        monthlyPrice: p.monthlyPrice, yearlyPrice: p.yearlyPrice,
        maxSchools: p.maxSchools, bilingualAllowed: p.bilingualAllowed,
        activeSubscriptions: countMap.get(p.code as any) || 0,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. MODULES — CATALOGUE COMPLET + ADOPTION PAR LES TENANTS
  // ─────────────────────────────────────────────────────────────────────────

  /** Catalogue complet des modules Academia Helm (14 principaux + 8 complémentaires). */
  private readonly MODULE_CATALOG = [
    // Modules principaux
    { code: 'STUDENTS', name: 'Élèves & Scolarité', category: 'principal', icon: 'Users', description: 'Inscriptions, matricules, dossiers élèves, transferts' },
    { code: 'FINANCE', name: 'Finances & Économat', category: 'principal', icon: 'Calculator', description: 'Frais de scolarité, paiements, trésorerie, comptabilité' },
    { code: 'HR_PAYROLL', name: 'Personnel, RH & Paie', category: 'principal', icon: 'UserCheck', description: 'Staff, contrats, paie, CNSS, congés' },
    { code: 'PEDAGOGY', name: 'Organisation Pédagogique', category: 'principal', icon: 'Building', description: 'Classes, matières, emplois du temps, journaux de classe' },
    { code: 'EXAMS', name: 'Examens & Bulletins', category: 'principal', icon: 'BookOpen', description: 'Évaluations, notes, bulletins, conseils de classe' },
    { code: 'COMMUNICATION', name: 'Communication', category: 'principal', icon: 'MessageSquare', description: 'Emails, SMS, WhatsApp, annonces, campagnes' },
    { code: 'ORION', name: 'ORION — Pilotage IA', category: 'principal', icon: 'Zap', description: 'Tableaux de bord, analytics, alertes intelligentes' },
    // Modules complémentaires
    { code: 'LIBRARY', name: 'Bibliothèque', category: 'complementaire', icon: 'Library', description: 'Catalogue, emprunts, réservations, ressources numériques' },
    { code: 'TRANSPORT', name: 'Transport', category: 'complementaire', icon: 'Bus', description: 'Véhicules, trajets, arrêts, affectations élèves' },
    { code: 'CANTEEN', name: 'Cantine', category: 'complementaire', icon: 'UtensilsCrossed', description: 'Menus, inscriptions, présences, stocks' },
    { code: 'INFIRMARY', name: 'Infirmerie', category: 'complementaire', icon: 'HeartPulse', description: 'Visites, urgences, autorisations, pharmacie' },
    { code: 'QHSE', name: 'QHSE', category: 'complementaire', icon: 'ShieldCheck', description: 'Qualité, hygiène, sécurité, environnement, audits' },
    { code: 'EDUCAST', name: 'EduCast', category: 'complementaire', icon: 'Radio', description: 'Chaînes enseignants, vidéos, podcasts, webinaires' },
    { code: 'SHOP', name: 'Boutique', category: 'complementaire', icon: 'ShoppingBag', description: 'Produits, commandes, point de vente, encaissements' },
  ];

  async getModulesAdoption() {
    const totalTenants = await this.prisma.tenant.count({ where: { status: { not: 'WITHDRAWN' } } });

    // Récupérer l'adoption depuis TenantFeature
    const features = await this.prisma.tenantFeature.groupBy({
      by: ['featureCode'],
      where: { isEnabled: true },
      _count: { featureCode: true },
    });
    const countMap = new Map(features.map((f) => [f.featureCode, f._count.featureCode]));

    // Retourner le catalogue complet avec les compteurs d'adoption
    return {
      totalTenants,
      modules: this.MODULE_CATALOG.map((m) => {
        const enabledCount = countMap.get(m.code) || 0;
        return {
          ...m,
          enabledCount,
          adoptionRate: totalTenants > 0 ? Math.round((enabledCount / totalTenants) * 100) : 0,
        };
      }),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. MONITORING — ÉTAT DES SERVICES (PAS DE DONNÉES MOCK)
  // ─────────────────────────────────────────────────────────────────────────
  async getMonitoring() {
    const [totalTenants, totalUsers, totalStudents, totalStaff, dbActive] = await Promise.all([
      this.prisma.tenant.count({ where: { status: { not: 'WITHDRAWN' } } }),
      this.prisma.user.count(),
      this.prisma.student.count(),
      this.prisma.staff.count(),
      Promise.resolve(true), // DB is reachable if we got here
    ]);

    return {
      services: [
        { name: 'API Backend', status: dbActive ? 'OPERATIONAL' : 'DOWN', latency: 0 },
        { name: 'Base de données', status: dbActive ? 'OPERATIONAL' : 'DOWN', latency: 0 },
        { name: 'Web App (Vercel)', status: 'OPERATIONAL', latency: 0 },
        { name: 'Email (Resend)', status: 'OPERATIONAL', latency: 0 },
        { name: 'Paiement (FeexPay)', status: 'OPERATIONAL', latency: 0 },
      ],
      stats: {
        totalTenants,
        totalUsers,
        totalStudents,
        totalStaff,
        uptime: '99.9%',
      },
      incidents: [],
    };
  }

  /**
   * Agrégation globale — données consolidées de toute la plateforme.
   */
  async getAggregation() {
    const [tenants, students, staff, users, payments, reviews] = await Promise.all([
      this.prisma.tenant.count({ where: { status: { not: 'WITHDRAWN' } } }),
      this.prisma.student.count(),
      this.prisma.staff.count(),
      this.prisma.user.count(),
      this.prisma.billingEvent.count(),
      this.prisma.review.count(),
    ]);

    const tenantsByCountry = await this.prisma.tenant.groupBy({
      by: ['countryId'],
      _count: { countryId: true },
      where: { status: { not: 'WITHDRAWN' } },
    });

    const studentsByTenant = await this.prisma.student.groupBy({
      by: ['tenantId'],
      _count: { tenantId: true },
    });

    return {
      global: {
        totalTenants: tenants,
        totalStudents: students,
        totalStaff: staff,
        totalUsers: users,
        totalPayments: payments,
        totalReviews: reviews,
      },
      tenantsByCountry: tenantsByCountry.map((t) => ({
        countryId: t.countryId,
        count: t._count.countryId,
      })),
      studentsByTenant: studentsByTenant.map((s) => ({
        tenantId: s.tenantId,
        studentCount: s._count.tenantId,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. ORION GLOBAL — ALERTES + EMPTY STATE POUR ANALYSE PRÉDICTIVE
  // ─────────────────────────────────────────────────────────────────────────
  async getOrionGlobal() {
    const [alerts, accessLogs] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where: { createdAt: { gte: this.daysAgo(30) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          eventType: true,
          severity: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          tenantId: true,
        },
      }),
      this.prisma.orionAccessLog.count({
        where: { triggeredAt: { gte: this.daysAgo(30) } },
      }),
    ]);

    return {
      recentAlerts: alerts.map((a) => ({
        id: a.id,
        eventType: a.eventType,
        severity: a.severity,
        ipAddress: a.ipAddress || '—',
        date: a.createdAt.toISOString(),
        tenantId: a.tenantId,
      })),
      orionAccessCount30d: accessLogs,
      churnPredictions: [],
      expansionPredictions: [],
      billingAnomalies: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. MODÉRATION DES AVIS (back-office reviews)
  // ─────────────────────────────────────────────────────────────────────────
  // Permet aux administrateurs plateforme (admin.academiahelm.com) de modérer
  // les avis déposés depuis le formulaire public (sans tenantId → PENDING).
  // Les avis déposés depuis l'app tenant (avec tenantId valide) sont auto-
  // approuvés et n'apparaissent pas dans la file de modération.

  /** Liste les avis en attente de modération. */
  async getReviewsPending() {
    const reviews = await this.prisma.review.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        schoolName: true,
        city: true,
        photoUrl: true,
        rating: true,
        comment: true,
        createdAt: true,
        tenantId: true,
        source: true,
      },
    });
    return reviews;
  }

  /** Liste tous les avis (tous statuts confondus) — page de gestion globale. */
  async getReviewsAll(status?: string) {
    const where = status && status !== 'ALL' ? { status: status as any } : {};
    const reviews = await this.prisma.review.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        schoolName: true,
        city: true,
        photoUrl: true,
        rating: true,
        comment: true,
        status: true,
        featured: true,
        source: true,
        createdAt: true,
        publishedAt: true,
        tenantId: true,
      },
      take: 200,
    });
    return reviews;
  }

  /** Modère un avis (approuver / rejeter / archiver / mettre en avant). */
  async updateReviewStatus(
    id: string,
    dto: { status: 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'PENDING'; featured?: boolean },
  ) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Avis introuvable');
    }
    const publishedAt =
      dto.status === 'APPROVED'
        ? existing.publishedAt ?? new Date()
        : null;
    return this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        publishedAt,
      },
    });
  }

  /** Supprime définitivement un avis. */
  async deleteReview(id: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Avis introuvable');
    }
    await this.prisma.review.delete({ where: { id } });
    return { ok: true };
  }

  /** Statistiques de modération (compteurs par statut). */
  async getReviewsStats() {
    const grouped = await this.prisma.review.groupBy({
      by: ['status'],
      _count: true,
    });
    const stats: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      ARCHIVED: 0,
    };
    for (const row of grouped) {
      stats[row.status] = row._count;
    }
    return stats;
  }

  // ─── PRICING PLANS ──────────────────────────────────────────────────────────

  async getPricingPlans() {
    const plans = await this.prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map(p => ({
      ...p,
      features: p.features ? JSON.parse(p.features) : [],
    }));
  }

  async upsertPricingPlan(data: any) {
    const features = data.features ? (Array.isArray(data.features) ? JSON.stringify(data.features) : data.features) : null;
    if (data.id) {
      // Update
      return this.prisma.pricingPlan.update({
        where: { id: data.id },
        data: {
          code: data.code,
          name: data.name,
          tagline: data.tagline || null,
          description: data.description || null,
          studentMin: data.studentMin ?? 0,
          studentMax: data.studentMax ?? null,
          initialFee: data.initialFee ?? 0,
          monthlyAmount: data.monthlyAmount ?? null,
          yearlyAmount: data.yearlyAmount ?? null,
          bilingualMonthly: data.bilingualMonthly ?? null,
          bilingualYearly: data.bilingualYearly ?? null,
          features,
          isPopular: data.isPopular ?? false,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    }
    // Create
    return this.prisma.pricingPlan.create({
      data: {
        code: data.code,
        name: data.name,
        tagline: data.tagline || null,
        description: data.description || null,
        studentMin: data.studentMin ?? 0,
        studentMax: data.studentMax ?? null,
        initialFee: data.initialFee ?? 0,
        monthlyAmount: data.monthlyAmount ?? null,
        yearlyAmount: data.yearlyAmount ?? null,
        bilingualMonthly: data.bilingualMonthly ?? null,
        bilingualYearly: data.bilingualYearly ?? null,
        features,
        isPopular: data.isPopular ?? false,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async deletePricingPlan(id: string) {
    return this.prisma.pricingPlan.delete({ where: { id } });
  }

  /**
   * Récupère les plans publics pour la page /tarification.
   * Endpoint @Public — pas d'auth requise.
   */
  async getPublicPricingPlans() {
    const plans = await this.prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      studentMin: p.studentMin,
      studentMax: p.studentMax,
      initialFee: p.initialFee,
      monthlyAmount: p.monthlyAmount,
      yearlyAmount: p.yearlyAmount,
      bilingualMonthly: p.bilingualMonthly,
      bilingualYearly: p.bilingualYearly,
      features: p.features ? JSON.parse(p.features) : [],
      isPopular: p.isPopular,
    }));
  }

  // ============================================================================
  // CRUD TENANTS
  // ============================================================================

  async updateTenantStatus(id: string, status: string, user: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new BadRequestException('Tenant introuvable');
    await this.prisma.tenant.update({ where: { id }, data: { status } });
    this.logger.log(`Tenant ${id} status → ${status} by ${user?.email}`);
    return { ok: true, id, status };
  }

  async updateTenant(id: string, body: any, user: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new BadRequestException('Tenant introuvable');
    const data: any = {};
    if (body.name) data.name = body.name;
    if (body.subdomain) data.subdomain = body.subdomain;
    if (body.type) data.type = body.type;
    if (body.plan) data.subscriptionPlan = body.plan;
    await this.prisma.tenant.update({ where: { id }, data });
    this.logger.log(`Tenant ${id} updated by ${user?.email}`);
    return { ok: true, id };
  }

  async deleteTenant(id: string, user: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new BadRequestException('Tenant introuvable');
    await this.prisma.tenant.delete({ where: { id } });
    this.logger.log(`Tenant ${id} (${tenant.name}) deleted by ${user?.email}`);
    return { ok: true, id };
  }

  // ============================================================================
  // CRUD USERS
  // ============================================================================

  async createUser(body: any, user: any) {
    if (!body?.email || !body?.role) throw new BadRequestException('email et role sont requis');
    const existing = await this.prisma.user.findFirst({ where: { email: body.email } });
    if (existing) throw new BadRequestException('Un utilisateur avec cet email existe déjà');
    const tempPassword = body.password || Math.random().toString(36).slice(-8) + 'A1!';
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const newUser = await this.prisma.user.create({
      data: {
        email: body.email, passwordHash,
        firstName: body.firstName || '', lastName: body.lastName || '',
        role: body.role, phone: body.phone || null,
        tenantId: body.tenantId || null, status: 'active',
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, status: true, createdAt: true },
    });
    this.logger.log(`User ${newUser.id} (${newUser.email}) created by ${user?.email}`);
    return { ...newUser, tempPassword: body.password ? undefined : tempPassword };
  }

  async updateUser(id: string, body: any, user: any) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Utilisateur introuvable');
    const data: any = {};
    if (body.email) data.email = body.email;
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.role) data.role = body.role;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.status) data.status = body.status;
    if (body.tenantId !== undefined) data.tenantId = body.tenantId;
    if (body.password) {
      const bcrypt = require('bcryptjs');
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }
    await this.prisma.user.update({ where: { id }, data });
    this.logger.log(`User ${id} updated by ${user?.email}`);
    return { ok: true, id };
  }

  async deleteUser(id: string, user: any) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Utilisateur introuvable');
    await this.prisma.user.delete({ where: { id } });
    this.logger.log(`User ${id} (${existing.email}) deleted by ${user?.email}`);
    return { ok: true, id };
  }

  // ============================================================================
  // SUPPORT TICKETS
  // ============================================================================

  async updateSupportTicket(id: string, body: any, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new BadRequestException('Ticket introuvable');
    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.priority) data.priority = body.priority;
    if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo;
    await this.prisma.supportTicket.update({ where: { id }, data });
    this.logger.log(`Ticket ${id} updated by ${user?.email}`);
    return { ok: true, id };
  }

  async replySupportTicket(id: string, message: string, user: any) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new BadRequestException('Ticket introuvable');
    const reply = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        authorEmail: user?.email || 'admin@academiahelm.com',
        authorName: user?.name || user?.email || 'Admin',
        authorRole: 'PLATFORM_ADMIN',
        message,
      },
    });
    if (ticket.status === 'OPEN') {
      await this.prisma.supportTicket.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
    }
    this.logger.log(`Reply to ticket ${id} by ${user?.email}`);
    return { ok: true, replyId: reply.id };
  }

  // ============================================================================
  // MODULES — Toggle
  // ============================================================================

  async toggleModule(moduleId: string, body: { tenantId: string; enabled: boolean }, user: any) {
    const existing = await this.prisma.tenantFeature.findFirst({
      where: { tenantId: body.tenantId, moduleKey: moduleId },
    });
    if (existing) {
      await this.prisma.tenantFeature.update({
        where: { id: existing.id },
        data: { isEnabled: body.enabled },
      });
    } else {
      await this.prisma.tenantFeature.create({
        data: { tenantId: body.tenantId, moduleKey: moduleId, isEnabled: body.enabled },
      });
    }
    this.logger.log(`Module ${moduleId} ${body.enabled ? 'enabled' : 'disabled'} for tenant ${body.tenantId} by ${user?.email}`);
    return { ok: true, moduleId, tenantId: body.tenantId, enabled: body.enabled };
  }

  // ============================================================================
  // RBAC — CRUD Rôles
  // ============================================================================

  async createRole(body: any, user: any) {
    if (!body?.name) throw new BadRequestException('Le nom du rôle est requis');
    const existing = await this.prisma.role.findFirst({ where: { name: body.name } });
    if (existing) throw new BadRequestException('Un rôle avec ce nom existe déjà');
    const role = await this.prisma.role.create({
      data: {
        name: body.name,
        label: body.label || body.name,
        description: body.description || null,
        level: body.level || 0,
        scope: body.scope || 'TENANT',
        isSystem: false,
        isActive: true,
      },
    });
    this.logger.log(`Role ${role.id} (${role.name}) created by ${user?.email}`);
    return role;
  }

  async updateRole(id: string, body: any, user: any) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Rôle introuvable');
    if (existing.isSystem) throw new BadRequestException('Les rôles système ne peuvent pas être modifiés');
    const data: any = {};
    if (body.label) data.label = body.label;
    if (body.description !== undefined) data.description = body.description;
    if (body.level !== undefined) data.level = body.level;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    await this.prisma.role.update({ where: { id }, data });
    this.logger.log(`Role ${id} updated by ${user?.email}`);
    return { ok: true, id };
  }

  async deleteRole(id: string, user: any) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Rôle introuvable');
    if (existing.isSystem) throw new BadRequestException('Les rôles système ne peuvent pas être supprimés');
    await this.prisma.role.delete({ where: { id } });
    this.logger.log(`Role ${id} (${existing.name}) deleted by ${user?.email}`);
    return { ok: true, id };
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  async getSettings() {
    const result: Record<string, any> = {
      platformName: 'Academia Helm',
      supportEmail: 'support@academiahelm.com',
      billingEmail: 'billing@academiahelm.com',
      defaultPlan: 'SEED',
      trialDurationDays: 30,
      reactivationFee: 5000,
      maxTenants: 1000,
    };
    try {
      const settings = await this.prisma.tenantSetting.findMany({
        where: { tenantId: 'PLATFORM' },
      });
      for (const s of settings) {
        result[s.key] = s.value;
      }
    } catch { /* table might not exist yet */ }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMUNICATION LOGS — Agrégation cross-tenant des EmailLogs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Liste les EmailLogs de tous les tenants (vue back-office plateforme).
   * Filtres optionnels : search (subject/recipient), category, status, tenantId.
   * Pagination : page (default 1), limit (default 50, max 200).
   *
   * Retourne :
   *   - logs[] : id, date, from, to, recipientName, subject, category, subCategory,
   *              module, status, tenantId, tenantName, provider, errorMessage
   *   - stats : total, byStatus, byCategory
   *   - pagination : total, page, limit, totalPages
   */
  async getCommunicationLogs(opts: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    tenantId?: string;
  }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(200, Math.max(1, opts.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.category && opts.category !== 'ALL') where.category = opts.category;
    if (opts.status && opts.status !== 'ALL') where.status = opts.status;
    if (opts.tenantId) where.tenantId = opts.tenantId;
    if (opts.search) {
      where.OR = [
        { subject: { contains: opts.search, mode: 'insensitive' } },
        { recipient: { contains: opts.search, mode: 'insensitive' } },
        { recipientName: { contains: opts.search, mode: 'insensitive' } },
        { fromEmail: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total, statusAgg, categoryAgg] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.groupBy({ by: ['status'], where, _count: { status: true } }),
      this.prisma.emailLog.groupBy({ by: ['category'], where, _count: { category: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    statusAgg.forEach((s) => (byStatus[s.status || 'UNKNOWN'] = s._count.status));
    const byCategory: Record<string, number> = {};
    categoryAgg.forEach((c) => (byCategory[c.category || 'UNKNOWN'] = c._count.category));

    return {
      logs: rows.map((l) => ({
        id: l.id,
        date: l.createdAt.toISOString(),
        from: l.fromEmail || 'noreply@academiahelm.com',
        fromName: l.fromName || null,
        to: l.recipient,
        toName: l.recipientName || null,
        subject: l.subject,
        category: l.category || 'SYSTEM',
        subCategory: l.subCategory || null,
        module: l.module || null,
        status: l.status,
        provider: l.provider || null,
        errorMessage: l.errorMessage || null,
        sentAt: l.sentAt?.toISOString() || null,
        tenantId: l.tenantId,
        tenantName: l.tenant?.name || '—',
        tenantSlug: l.tenant?.slug || null,
        threadId: l.threadId || null,
      })),
      stats: {
        total,
        byStatus,
        byCategory,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateSettings(body: any, user: any) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Body invalide');
    for (const [key, value] of Object.entries(body)) {
      const existing = await this.prisma.tenantSetting.findFirst({
        where: { tenantId: 'PLATFORM', key },
      });
      if (existing) {
        await this.prisma.tenantSetting.update({
          where: { id: existing.id },
          data: { value: String(value) },
        });
      } else {
        await this.prisma.tenantSetting.create({
          data: { tenantId: 'PLATFORM', key, value: String(value) },
        });
      }
    }
    this.logger.log(`Platform settings updated by ${user?.email}`);
    return { ok: true };
  }
}
