/**
 * ============================================================================
 * SUBSCRIPTION SERVICE - GESTION DES SOUSCRIPTIONS
 * ============================================================================
 * 
 * Service pour gérer les souscriptions, trials, renewals, etc.
 * 
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from './pricing.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Crée une souscription en trial pour un nouveau tenant
   */
  async createTrialSubscription(
    tenantId: string,
    planId: string,
    initialPaymentAmount: number,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan not found: ${planId}`);
    }

    const now = new Date();
    // ⚠️ Récupérer trialDays depuis PricingService (paramétrable)
    const trialDays = await this.pricingService.getTrialDays();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    // Créer la souscription
    const subscription = await this.prisma.subscription.create({
      data: {
        tenant: { connect: { id: tenantId } },
        subscriptionPlan: { connect: { id: planId } },
        plan: plan.code,
        status: 'TRIAL_ACTIVE',
        startDate: now,
        trialStart: now,
        trialEnd,
        amount: initialPaymentAmount,
        currency: 'XOF',
        billingCycle: 'MONTHLY',
        autoRenew: true,
        schoolsCount: 1, // Par défaut, sera mis à jour selon le plan
        bilingualEnabled: false, // Sera mis à jour selon les options
        devOverride: false,
      },
      include: {
        subscriptionPlan: true,
        tenant: true,
      },
    });

    // Créer l'événement de facturation initial
    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        type: 'INITIAL_SUBSCRIPTION',
        amount: initialPaymentAmount,
        channel: 'fedapay',
        reference: `INIT-${tenantId}-${Date.now()}`,
        metadata: {
          planCode: plan.code,
          planName: plan.name,
          trialDays: await this.pricingService.getTrialDays(),
        },
      },
    });

    this.logger.log(
      `✅ Trial subscription created for tenant ${tenantId} - Trial ends: ${trialEnd.toISOString()}`
    );

    return subscription;
  }

  /**
   * Active une souscription après paiement initial
   */
  async activateSubscription(
    subscriptionId: string,
    periodType: 'MONTHLY' | 'YEARLY',
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { subscriptionPlan: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date();
    const periodEnd = new Date(now);

    if (periodType === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEnd: null, // Le trial est terminé
      },
      include: {
        subscriptionPlan: true,
        tenant: true,
      },
    });

    this.logger.log(
      `✅ Subscription activated for tenant ${subscription.tenantId} - Period: ${periodType}`
    );

    return updated;
  }

  /**
   * Vérifie et met à jour le statut des souscriptions expirées
   */
  async checkExpiredSubscriptions() {
    const now = new Date();

    // Trouver les trials expirés
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIAL_ACTIVE',
        trialEnd: {
          lt: now,
        },
      },
      include: {
        subscriptionPlan: true,
        tenant: true,
      },
    });

    for (const subscription of expiredTrials) {
      // ⚠️ Mettre en période de grâce (GRACE) - durée depuis PricingService (paramétrable)
      const graceDays = await this.pricingService.getGraceDays();
      const graceEnd = new Date(now);
      graceEnd.setDate(graceEnd.getDate() + graceDays);

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'GRACE',
          currentPeriodEnd: graceEnd,
        },
      });

      this.logger.warn(
        `⚠️  Trial expired for tenant ${subscription.tenantId} - Moved to GRACE period`
      );
    }

    // Trouver les périodes de grâce expirées
    const expiredGrace = await this.prisma.subscription.findMany({
      where: {
        status: 'GRACE',
        currentPeriodEnd: {
          lt: now,
        },
      },
      include: {
        subscriptionPlan: true,
        tenant: true,
      },
    });

    for (const subscription of expiredGrace) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'SUSPENDED',
        },
      });

      this.logger.warn(
        `🚫 Grace period expired for tenant ${subscription.tenantId} - Subscription SUSPENDED`
      );
    }

    return {
      expiredTrials: expiredTrials.length,
      expiredGrace: expiredGrace.length,
    };
  }

  /**
   * Récupère le statut de souscription d'un tenant
   */
  async getSubscriptionStatus(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        subscriptionPlan: true,
        tenant: true,
      },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        status: null,
        message: 'No subscription found',
      };
    }

    const now = new Date();
    let daysRemaining = 0;
    let isExpired = false;

    if (subscription.status === 'TRIAL_ACTIVE' && subscription.trialEnd) {
      daysRemaining = Math.ceil(
        (subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      isExpired = daysRemaining <= 0;
    } else if (subscription.currentPeriodEnd) {
      daysRemaining = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      isExpired = daysRemaining <= 0;
    }

    return {
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: {
          code: subscription.subscriptionPlan?.code ?? subscription.plan,
          name: subscription.subscriptionPlan?.name ?? subscription.plan,
          monthlyPrice: subscription.subscriptionPlan?.monthlyPrice ?? null,
          yearlyPrice: subscription.subscriptionPlan?.yearlyPrice ?? null,
        },
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        bilingualEnabled: subscription.bilingualEnabled,
        schoolsCount: subscription.schoolsCount,
        devOverride: subscription.devOverride,
      },
      daysRemaining,
      isExpired,
      requiresAction: isExpired || daysRemaining <= 7,
    };
  }

  /**
   * Active le mode DEV pour un tenant (override)
   */
  async enableDevOverride(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found for tenant: ${tenantId}`);
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        devOverride: true,
        status: 'DEV_ACTIVE',
      },
    });

    this.logger.log(`✅ DEV_OVERRIDE enabled for tenant ${tenantId}`);

    return updated;
  }

  /**
   * Désactive le mode DEV pour un tenant
   */
  async disableDevOverride(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found for tenant: ${tenantId}`);
    }

    // Restaurer le statut précédent ou ACTIVE
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        devOverride: false,
        status: subscription.status === 'DEV_ACTIVE'
          ? 'ACTIVE'
          : subscription.status,
      },
    });

    this.logger.log(`✅ DEV_OVERRIDE disabled for tenant ${tenantId}`);

    return updated;
  }
}
