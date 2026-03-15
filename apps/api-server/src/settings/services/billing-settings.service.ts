import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingEventType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * ============================================================================
 * SERVICE FACTURATION SaaS
 * ============================================================================
 * Gestion des paramètres d'abonnement et de facturation pour le tenant
 */
@Injectable()
export class BillingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère l'abonnement actuel du tenant
   */
  async getSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        subscriptionPlan: true,
        invoices: {
          orderBy: { issueDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      plan: subscription.plan,
      planDetails: subscription.subscriptionPlan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      amount: subscription.amount,
      currency: subscription.currency,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      trialEndsAt: subscription.trialEndsAt,
      nextPaymentDueAt: subscription.nextPaymentDueAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      autoRenew: subscription.autoRenew,
      bilingualEnabled: subscription.bilingualEnabled,
      schoolsCount: subscription.schoolsCount,
      recentInvoices: subscription.invoices,
    };
  }

  /**
   * Récupère tous les plans d'abonnement disponibles
   */
  async getAvailablePlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  /**
   * Met à jour les paramètres d'abonnement
   */
  async updateSubscription(
    tenantId: string,
    data: {
      billingCycle?: string;
      autoRenew?: boolean;
      bilingualEnabled?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Aucun abonnement trouvé pour ce tenant');
    }

    const oldData = {
      billingCycle: existing.billingCycle,
      autoRenew: existing.autoRenew,
      bilingualEnabled: existing.bilingualEnabled,
    };

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        billingCycle: data.billingCycle ?? existing.billingCycle,
        autoRenew: data.autoRenew ?? existing.autoRenew,
        bilingualEnabled: data.bilingualEnabled ?? existing.bilingualEnabled,
      },
      include: {
        subscriptionPlan: true,
      },
    });

    const changedFields: string[] = [];
    if (data.billingCycle !== undefined && data.billingCycle !== oldData.billingCycle) {
      changedFields.push('billingCycle');
      await this.historyService.logSettingChange(
        tenantId,
        updated.id,
        'subscription.billingCycle',
        'billing',
        { billingCycle: { old: oldData.billingCycle, new: data.billingCycle } },
        userId,
        ipAddress,
        userAgent,
      );
    }
    if (data.autoRenew !== undefined && data.autoRenew !== oldData.autoRenew) {
      changedFields.push('autoRenew');
      await this.historyService.logSettingChange(
        tenantId,
        updated.id,
        'subscription.autoRenew',
        'billing',
        { autoRenew: { old: oldData.autoRenew, new: data.autoRenew } },
        userId,
        ipAddress,
        userAgent,
      );
    }
    if (data.bilingualEnabled !== undefined && data.bilingualEnabled !== oldData.bilingualEnabled) {
      changedFields.push('bilingualEnabled');
      await this.historyService.logSettingChange(
        tenantId,
        updated.id,
        'subscription.bilingualEnabled',
        'billing',
        { bilingualEnabled: { old: oldData.bilingualEnabled, new: data.bilingualEnabled } },
        userId,
        ipAddress,
        userAgent,
      );
    }

    return updated;
  }

  /**
   * Change de plan d'abonnement
   */
  async changePlan(
    tenantId: string,
    newPlanCode: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: newPlanCode },
    });

    if (!newPlan) {
      throw new NotFoundException(`Plan "${newPlanCode}" non trouvé`);
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Aucun abonnement trouvé');
    }

    const oldPlan = existing.plan;

    const isMonthly = existing.billingCycle === 'MONTHLY';
    const newAmount = isMonthly ? newPlan.monthlyPrice : newPlan.yearlyPrice;

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: newPlan.name,
        planId: newPlan.id,
        amount: newAmount,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      updated.id,
      'subscription.plan',
      'billing',
      { plan: { old: oldPlan, new: newPlan.name } },
      userId,
      ipAddress,
      userAgent,
    );

    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        subscriptionId: updated.id,
        type: BillingEventType.ADJUSTMENT,
        amount: newAmount,
        channel: 'SYSTEM',
        metadata: {
          oldPlan,
          newPlan: newPlan.name,
          changedBy: userId,
        },
      },
    });

    return updated;
  }

  /**
   * Récupère l'historique de facturation
   */
  async getBillingHistory(tenantId: string, options?: { limit?: number; offset?: number }) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [events, total] = await Promise.all([
      this.prisma.billingEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.billingEvent.count({
        where: { tenantId },
      }),
    ]);

    return { events, total, limit, offset };
  }

  /**
   * Récupère les factures
   */
  async getInvoices(tenantId: string, options?: { status?: string; limit?: number }) {
    const where: any = { tenantId };
    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.subscriptionInvoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      take: options?.limit || 20,
    });
  }

  /**
   * Calcule l'impact financier des features activées
   */
  async calculateFeaturesBillingImpact(tenantId: string) {
    const features = await this.prisma.tenantFeature.findMany({
      where: { tenantId, isEnabled: true },
    });

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    let baseAmount = subscription?.amount || 0;
    let additionalCost = 0;
    const featuresCosts: { feature: string; cost: number }[] = [];

    for (const feature of features) {
      if (feature.billingImpact) {
        const impact = parseFloat(feature.billingImpact) || 0;
        additionalCost += impact;
        featuresCosts.push({ feature: feature.featureCode, cost: impact });
      }
    }

    if (subscription?.bilingualEnabled) {
      const bilingualCost = baseAmount * 0.2;
      additionalCost += bilingualCost;
      featuresCosts.push({ feature: 'BILINGUAL', cost: bilingualCost });
    }

    return {
      baseAmount,
      additionalCost,
      totalAmount: baseAmount + additionalCost,
      breakdown: featuresCosts,
    };
  }

  /**
   * Annule l'abonnement
   */
  async cancelSubscription(
    tenantId: string,
    reason: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Aucun abonnement trouvé');
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Abonnement déjà annulé');
    }

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        autoRenew: false,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      updated.id,
      'subscription.status',
      'billing',
      { status: { old: existing.status, new: 'CANCELLED' } },
      userId,
      ipAddress,
      userAgent,
    );

    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        subscriptionId: updated.id,
        type: BillingEventType.ADJUSTMENT,
        amount: 0,
        channel: 'SYSTEM',
        metadata: {
          reason,
          cancelledBy: userId,
        },
      },
    });

    return updated;
  }

  /**
   * Réactive l'abonnement
   */
  async reactivateSubscription(
    tenantId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Aucun abonnement trouvé');
    }

    if (existing.status !== 'CANCELLED') {
      throw new BadRequestException('L\'abonnement n\'est pas annulé');
    }

    const updated = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'ACTIVE',
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        autoRenew: true,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      updated.id,
      'subscription.status',
      'billing',
      { status: { old: 'CANCELLED', new: 'ACTIVE' } },
      userId,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  /**
   * Récupère le résumé de facturation pour le dashboard
   */
  async getBillingSummary(tenantId: string) {
    const subscription = await this.getSubscription(tenantId);
    const impact = await this.calculateFeaturesBillingImpact(tenantId);
    const pendingInvoices = await this.prisma.subscriptionInvoice.count({
      where: { tenantId, status: 'PENDING' },
    });

    return {
      subscription,
      billingImpact: impact,
      pendingInvoicesCount: pendingInvoices,
      isTrialActive: subscription?.status === 'TRIAL' && 
        subscription.trialEndsAt && 
        new Date(subscription.trialEndsAt) > new Date(),
      daysUntilNextPayment: subscription?.nextPaymentDueAt
        ? Math.ceil((new Date(subscription.nextPaymentDueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }
}
