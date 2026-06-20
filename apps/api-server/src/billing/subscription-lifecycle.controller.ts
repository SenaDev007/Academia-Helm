/**
 * ============================================================================
 * SUBSCRIPTION LIFECYCLE CONTROLLER
 * ============================================================================
 *
 * Endpoints pour le cycle de vie des abonnements :
 *
 *   1. POST /api/billing/cron/daily-check
 *      Cron job quotidien — vérifie tous les abonnements et applique
 *      les transitions (notifications, expiration, suspension, blocage).
 *      Appelé par Vercel Cron ou fly.io cron.
 *
 *   2. POST /api/billing/renew/:tenantId
 *      Renouvelle un abonnement (après paiement).
 *
 *   3. POST /api/billing/reactivate/:tenantId
 *      Réactive un abonnement bloqué (après paiement 5 000 FCFA).
 *
 *   4. GET /api/billing/subscription-status/:tenantId
 *      Retourne le statut d'abonnement d'un tenant (pour le middleware frontend).
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { StudentCountVerifierService } from './services/student-count-verifier.service';
import { PrismaService } from '../database/prisma.service';

@Controller('billing')
export class SubscriptionLifecycleController {
  private readonly logger = new Logger(SubscriptionLifecycleController.name);

  constructor(
    private readonly lifecycleService: SubscriptionLifecycleService,
    private readonly studentCountVerifier: StudentCountVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/billing/cron/daily-check
   *
   * Cron job quotidien — vérifie tous les abonnements.
   * Sécurisé par un header secret (CRON_SECRET) ou par l'auth admin.
   *
   * Configurer Vercel Cron:
   *   vercel.json → "crons": [{ "path": "/api/billing/cron/daily-check", "schedule": "0 6 * * *" }]
   */
  @Public()
  @Post('cron/daily-check')
  async dailyCheck(
    @Headers('x-cron-secret') cronSecret?: string,
    @Query('secret') querySecret?: string,
  ) {
    // Sécurité : vérifier le secret (soit header, soit query param)
    const expectedSecret = process.env.CRON_SECRET || 'academia-helm-cron-2026';
    const providedSecret = cronSecret || querySecret;
    if (providedSecret !== expectedSecret) {
      throw new BadRequestException('Secret cron invalide');
    }

    await this.lifecycleService.runDailyCheck();

    // Vérifier le nombre d'élèves réel vs plan d'abonnement
    await this.studentCountVerifier.runDailyVerification();

    return { success: true, message: 'Daily check completed', timestamp: new Date().toISOString() };
  }

  /**
   * GET /api/billing/subscription-status/:tenantId
   * Retourne le statut d'abonnement (pour le frontend — bandeau, lecture seule, etc.)
   */
  @Public()
  @Get('subscription-status/:tenantId')
  async getSubscriptionStatus(@Param('tenantId') tenantId: string) {
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
      select: {
        status: true,
        currentPeriodEnd: true,
        plan: true,
        billingCycle: true,
        expiredAt: true,
        gracePeriodEnd: true,
        suspendedAt: true,
        blockedAt: true,
        reactivationFee: true,
      },
    });

    if (!sub) {
      return { status: 'NONE', message: 'Aucun abonnement trouvé' };
    }

    return sub;
  }

  /**
   * POST /api/billing/renew/:tenantId
   * Renouvelle un abonnement après paiement.
   * Body: { amount: number, paymentReference?: string }
   */
  @Public()
  @Post('renew/:tenantId')
  async renewSubscription(
    @Param('tenantId') tenantId: string,
    @Body() body: { amount: number; paymentReference?: string },
    @Headers('x-platform-admin-email') adminEmail?: string,
  ) {
    if (!body?.amount) {
      throw new BadRequestException('Le montant est requis');
    }

    // Si admin email fourni, logger pour audit
    if (adminEmail) {
      this.logger.log(`Renew subscription for tenant ${tenantId} by admin ${adminEmail}, amount=${body.amount}`);
    }

    const result = await this.lifecycleService.renewSubscription(tenantId, body.amount);

    // Enregistrer le billing event
    if (result.success) {
      await this.prisma.billingEvent.create({
        data: {
          tenantId,
          type: 'RENEWAL',
          amount: body.amount,
          channel: 'FEDAPAY',
          reference: body.paymentReference || null,
        },
      });
    }

    return result;
  }

  /**
   * POST /api/billing/reactivate/:tenantId
   * Réactive un abonnement bloqué après paiement des frais (5 000 FCFA).
   * Body: { paymentReference?: string }
   */
  @Public()
  @Post('reactivate/:tenantId')
  async reactivateSubscription(
    @Param('tenantId') tenantId: string,
    @Body() body: { paymentReference?: string },
    @Headers('x-platform-admin-email') adminEmail?: string,
  ) {
    if (adminEmail) {
      this.logger.log(`Reactivate subscription for tenant ${tenantId} by admin ${adminEmail}`);
    }

    // Récupérer le montant des frais de réactivation
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
      select: { reactivationFee: true },
    });
    const fee = sub?.reactivationFee || 5000;

    const result = await this.lifecycleService.reactivateSubscription(tenantId);

    // Enregistrer le billing event
    if (result.success) {
      await this.prisma.billingEvent.create({
        data: {
          tenantId,
          type: 'MANUAL_PAYMENT',
          amount: fee,
          channel: 'FEDAPAY',
          reference: body.paymentReference || null,
        },
      });
    }

    return result;
  }

  /**
   * GET /api/billing/student-count/:tenantId
   * Retourne le nombre réel d'élèves et la conformité au plan d'abonnement.
   * Accessible par l'admin plateforme (header x-platform-admin-email) ou par le tenant lui-même.
   */
  @Public()
  @Get('student-count/:tenantId')
  async getStudentCountCompliance(@Param('tenantId') tenantId: string) {
    const realCount = await this.studentCountVerifier.countActiveStudents(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        studentEnrollmentBlocked: true,
        studentCountCache: true,
        lastCountUpdate: true,
        helmSubscriptions: {
          select: {
            plan: true,
            status: true,
            pendingUpgradePlan: true,
            upgradeGraceEnd: true,
          },
        },
      },
    });

    const sub = tenant?.helmSubscriptions;
    const currentPlan = sub?.plan || 'SEED';
    const alignment = this.studentCountVerifier.checkPlanAlignment(currentPlan, realCount);

    return {
      tenantId,
      tenantName: tenant?.name || 'Établissement',
      realStudentCount: realCount,
      cachedStudentCount: tenant?.studentCountCache || 0,
      lastCountUpdate: tenant?.lastCountUpdate,
      enrollmentBlocked: tenant?.studentEnrollmentBlocked || false,
      currentPlan,
      currentPlanLimit: alignment.currentPlanLimit.studentMax,
      recommendedPlan: alignment.recommendedPlan,
      needsUpgrade: alignment.needsUpgrade,
      overBy: alignment.overBy,
      pendingUpgradePlan: sub?.pendingUpgradePlan || null,
      upgradeGraceEnd: sub?.upgradeGraceEnd || null,
    };
  }

  /**
   * POST /api/billing/verify-student-count/:tenantId
   * Déclenche une vérification immédiate du nombre d'élèves pour un tenant.
   * Met à jour le cache et notifie l'école si nécessaire.
   */
  @Public()
  @Post('verify-student-count/:tenantId')
  async triggerStudentCountVerification(
    @Param('tenantId') tenantId: string,
    @Headers('x-platform-admin-email') adminEmail?: string,
  ) {
    if (adminEmail) {
      this.logger.log(`Manual student count verification for tenant ${tenantId} by admin ${adminEmail}`);
    }

    await this.studentCountVerifier.verifyAfterEnrollment(tenantId);

    // Retourner l'état après vérification
    return this.getStudentCountCompliance(tenantId);
  }

  /**
   * POST /api/billing/unblock-enrollment/:tenantId
   * Débloque manuellement l'ajout d'élèves pour un tenant (admin only).
   * Utile après qu'un admin a aidé une école à upgrader son plan manuellement.
   */
  @Public()
  @Post('unblock-enrollment/:tenantId')
  async unblockEnrollment(
    @Param('tenantId') tenantId: string,
    @Headers('x-platform-admin-email') adminEmail?: string,
  ) {
    if (!adminEmail) {
      throw new BadRequestException('Header x-platform-admin-email requis');
    }
    this.logger.log(`Manual unblock enrollment for tenant ${tenantId} by admin ${adminEmail}`);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { studentEnrollmentBlocked: false },
    });

    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });
    if (sub?.pendingUpgradePlan) {
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: {
          pendingUpgradePlan: null,
          upgradeGraceEnd: null,
        },
      });
    }

    return { success: true, message: 'Enrollment unblocked successfully' };
  }
}
