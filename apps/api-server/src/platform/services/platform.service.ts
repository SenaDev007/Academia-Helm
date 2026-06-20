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
          schools: { select: { city: true }, take: 1 },
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
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        subdomain: t.subdomain,
        country: t.country?.name || '—',
        city: t.schools?.[0]?.city || '—',
        plan,
        status,
        students: Number(t.studentCountCache || 0),
        lastActivity: t.updatedAt.toISOString(),
        expiration: sub?.currentPeriodEnd?.toISOString() || null,
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
      note: 'Le module de tickets de support sera disponible prochainément. Aucune donnée mock n\'est affichée.',
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
  // 10. PLANS D'ABONNEMENT
  // ─────────────────────────────────────────────────────────────────────────
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
        id: p.id,
        code: p.code,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        yearlyPrice: p.yearlyPrice,
        maxSchools: p.maxSchools,
        bilingualAllowed: p.bilingualAllowed,
        activeSubscriptions: countMap.get(p.code as any) || 0,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. MODULES — AGRÉGATION DE L'ADOPTION PAR LES TENANTS
  // ─────────────────────────────────────────────────────────────────────────
  async getModulesAdoption() {
    const features = await this.prisma.tenantFeature.groupBy({
      by: ['featureCode'],
      where: { isEnabled: true },
      _count: { featureCode: true },
    });

    const totalTenants = await this.prisma.tenant.count({ where: { status: { not: 'WITHDRAWN' } } });

    return {
      totalTenants,
      modules: features.map((f) => ({
        code: f.featureCode,
        enabledCount: f._count.featureCode,
        adoptionRate: totalTenants > 0 ? Math.round((f._count.featureCode / totalTenants) * 100) : 0,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. MONITORING — ÉTAT DES SERVICES (PAS DE DONNÉES MOCK)
  // ─────────────────────────────────────────────────────────────────────────
  async getMonitoring() {
    return {
      services: [],
      performanceData: [],
      incidents: [],
      note: "L'intégration d'outils de monitoring (Prometheus, Sentry, UptimeRobot) est planifiée. En attendant, aucune métrique technique n'est collectée — aucune donnée mock n'est affichée.",
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
      note: "L'analyse prédictive ORION (churn, expansion, anomalies) sera disponible prochainement. En attendant, seules les alertes sécurité réelles sont affichées.",
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
}
