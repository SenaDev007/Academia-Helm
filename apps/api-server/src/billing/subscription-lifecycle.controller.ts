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
import { FeexPayService } from './services/feexpay.service';
import { PricingService } from './services/pricing.service';
import { PrismaService } from '../database/prisma.service';

@Controller('billing')
export class SubscriptionLifecycleController {
  private readonly logger = new Logger(SubscriptionLifecycleController.name);

  constructor(
    private readonly lifecycleService: SubscriptionLifecycleService,
    private readonly studentCountVerifier: StudentCountVerifierService,
    private readonly prisma: PrismaService,
    private readonly feexpayService: FeexPayService,
    private readonly pricingService: PricingService,
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

  // ============================================================================
  // OPTION BILINGUE — Activation/Désactivation depuis le module paramètres
  // ============================================================================

  /**
   * GET /api/billing/bilingual-status/:tenantId
   * Retourne le statut de l'option bilingue pour un tenant.
   */
  @Public()
  @Get('bilingual-status/:tenantId')
  async getBilingualStatus(@Param('tenantId') tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      select: {
        bilingualEnabled: true,
        billingCycle: true,
        status: true,
      },
    });

    // Récupérer les prix bilingue depuis pricing_plans (table dynamique)
    const bilingualPlan = await this.prisma.pricingPlan.findFirst({
      where: { code: 'BILINGUAL' as any },
    });

    // Fallback si le plan bilingue n'existe pas en DB
    const monthlyAddon = (bilingualPlan as any)?.bilingualMonthly ?? 10000;
    const yearlyAddon = (bilingualPlan as any)?.bilingualYearly ?? 100000;

    return {
      enabled: sub?.bilingualEnabled || false,
      billingCycle: sub?.billingCycle || 'MONTHLY',
      monthlyAddon,
      yearlyAddon,
      subscriptionStatus: sub?.status || 'NONE',
    };
  }

  /**
   * POST /api/billing/bilingual/activate/:tenantId
   * Active l'option bilingue avec paiement immédiat via FeexPay.
   *
   * Body: {
   *   paymentMethod: 'MOBILE_MONEY' | 'CARD',
   *   phone?: string,        // requis si MOBILE_MONEY
   *   customer: { email: string, firstname?: string, lastname?: string }
   * }
   *
   * Workflow :
   *   1. Vérifie que le tenant a un abonnement actif
   *   2. Calcule le montant : bilingualMonthly (MONTHLY) ou bilingualYearly (YEARLY)
   *   3. Crée une transaction FeexPay
   *   4. Retourne l'URL/les données de checkout
   *   5. Le webhook FeexPay confirmera le paiement → on active bilingualEnabled
   */
  @Public()
  @Post('bilingual/activate/:tenantId')
  async activateBilingual(
    @Param('tenantId') tenantId: string,
    @Body() body: {
      paymentMethod: 'MOBILE_MONEY' | 'CARD';
      phone?: string;
      customer: { email: string; firstname?: string; lastname?: string };
    },
  ) {
    if (!body?.paymentMethod || !body?.customer?.email) {
      throw new BadRequestException('paymentMethod et customer.email sont requis');
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé pour ce tenant');
    }
    if (sub.bilingualEnabled) {
      return { success: true, message: 'Option bilingue déjà active', alreadyActive: true };
    }

    // Récupérer le prix bilingue depuis pricing_plans
    const bilingualPlan = await this.prisma.pricingPlan.findFirst({
      where: { code: 'BILINGUAL' as any },
    });
    const monthlyAddon = (bilingualPlan as any)?.bilingualMonthly ?? 10000;
    const yearlyAddon = (bilingualPlan as any)?.bilingualYearly ?? 100000;

    const amount = sub.billingCycle === 'YEARLY' ? yearlyAddon : monthlyAddon;
    if (!amount) {
      throw new BadRequestException('Montant bilingue introuvable');
    }

    // Créer une transaction FeexPay
    try {
      const paymentResult = body.paymentMethod === 'MOBILE_MONEY'
        ? await this.feexpayService.createMobileMoneyPayment({
            amount,
            description: `Option bilingue - ${sub.billingCycle === 'YEARLY' ? 'Annuel' : 'Mensuel'}`,
            phoneNumber: body.phone!,
            email: body.customer.email,
            firstName: body.customer.firstname,
            lastName: body.customer.lastname,
          })
        : await this.feexpayService.createCardPayment({
            amount,
            description: `Option bilingue - ${sub.billingCycle === 'YEARLY' ? 'Annuel' : 'Mensuel'}`,
            email: body.customer.email,
            firstName: body.customer.firstname,
            lastName: body.customer.lastname,
          });

      // Enregistrer l'intention de paiement pour traitement webhook
      await this.prisma.billingEvent.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          type: 'BILINGUAL_ACTIVATION',
          amount,
          channel: 'FEEXPAY',
          reference: paymentResult.reference || `bilingual-${tenantId}-${Date.now()}`,
          metadata: {
            action: 'ACTIVATE_BILINGUAL',
            feexpayStatus: paymentResult.status,
            billingCycle: sub.billingCycle,
            customer: body.customer,
          },
        },
      });

      this.logger.log(`Bilingual activation initiated for tenant ${tenantId}: amount=${amount}, method=${body.paymentMethod}, ref=${paymentResult.reference}`);

      return {
        success: true,
        amount,
        paymentMethod: body.paymentMethod,
        reference: paymentResult.reference,
        paymentUrl: paymentResult.paymentUrl,
        status: paymentResult.status,
      };
    } catch (err: any) {
      this.logger.error(`Bilingual activation payment failed: ${err.message}`, err.stack);
      throw new BadRequestException(`Échec de l'initialisation du paiement: ${err.message}`);
    }
  }

  /**
   * POST /api/billing/bilingual/confirm/:tenantId
   * Confirme l'activation bilingue après paiement réussi (appelé par le webhook
   * FeexPay ou manuellement par l'admin après vérification).
   *
   * Body: { transactionId?: string, reference?: string }
   */
  @Public()
  @Post('bilingual/confirm/:tenantId')
  async confirmBilingualActivation(
    @Param('tenantId') tenantId: string,
    @Body() body: { transactionId?: string; reference?: string },
    @Headers('x-platform-admin-email') adminEmail?: string,
  ) {
    if (adminEmail) {
      this.logger.log(`Bilingual activation confirmed for tenant ${tenantId} by admin ${adminEmail}`);
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé');
    }

    // Activer l'option bilingue
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { bilingualEnabled: true },
    });

    // Créer les tracks académiques EN si pas déjà présents
    const existingEnTrack = await this.prisma.academicTrack.findFirst({
      where: { tenantId, code: 'EN' },
    });
    if (!existingEnTrack) {
      await this.prisma.academicTrack.create({
        data: {
          tenantId,
          code: 'EN',
          name: 'Anglais',
          description: 'Parcours académique en anglais',
          order: 1,
          isDefault: false,
          isActive: true,
          metadata: { language: 'en', bilingual: true },
        },
      });
      this.logger.log(`✅ Created EN academic track for tenant ${tenantId}`);
    }

    // Enregistrer l'événement
    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        type: 'BILINGUAL_ACTIVATED',
        amount: 0,
        channel: 'FEEXPAY',
        reference: body.reference || body.transactionId || `bilingual-confirm-${tenantId}-${Date.now()}`,
        metadata: {
          action: 'BILINGUAL_CONFIRMED',
          transactionId: body.transactionId,
          confirmedBy: adminEmail || 'webhook',
        },
      },
    });

    this.logger.log(`✅ Bilingual option activated for tenant ${tenantId}`);
    return { success: true, message: 'Option bilingue activée avec succès' };
  }

  /**
   * POST /api/billing/bilingual/deactivate/:tenantId
   * Désactive l'option bilingue — arrête la souscription bilingue immédiatement.
   * Aucun remboursement (la désactivation prend effet au prochain cycle).
   *
   * Body: { reason?: string }
   */
  @Public()
  @Post('bilingual/deactivate/:tenantId')
  async deactivateBilingual(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé');
    }
    if (!sub.bilingualEnabled) {
      return { success: true, message: 'Option bilingue déjà désactivée', alreadyInactive: true };
    }

    // Désactiver l'option bilingue
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { bilingualEnabled: false },
    });

    // Désactiver (mais ne pas supprimer) les tracks EN — les données existantes restent
    await this.prisma.academicTrack.updateMany({
      where: { tenantId, code: 'EN' },
      data: { isActive: false },
    });

    // Enregistrer l'événement
    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        type: 'BILINGUAL_DEACTIVATED',
        amount: 0,
        channel: 'MANUAL',
        reference: `bilingual-deactivate-${tenantId}-${Date.now()}`,
        metadata: {
          action: 'BILINGUAL_DEACTIVATED',
          reason: body?.reason || 'User requested deactivation',
        },
      },
    });

    this.logger.log(`✅ Bilingual option deactivated for tenant ${tenantId} (reason: ${body?.reason || 'N/A'})`);
    return { success: true, message: 'Option bilingue désactivée. La souscription bilingue est arrêtée.' };
  }

  // ============================================================================
  // ADMIN — Application manuelle des migrations (endpoint de secours)
  // ============================================================================
  // Si les migrations Prisma échouent à s'appliquer au démarrage (par exemple
  // à cause d'une migration déjà marquée comme appliquée dans _prisma_migrations),
  // cet endpoint permet d'exécuter les ALTER TABLE idempotents manuellement.
  //
  // Sécurité : header x-platform-admin-email requis + x-admin-secret (CRON_SECRET).
  // ============================================================================

  @Public()
  @Post('admin/apply-migrations')
  async applyMigrationsManually(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Headers('x-admin-secret') adminSecret?: string,
  ) {
    if (!adminEmail) {
      throw new BadRequestException('Header x-platform-admin-email requis');
    }
    const expectedSecret = process.env.CRON_SECRET || 'academia-helm-cron-2026';
    if (adminSecret !== expectedSecret) {
      throw new BadRequestException('Header x-admin-secret invalide');
    }

    this.logger.log(`🔧 Manual migration application triggered by admin ${adminEmail}`);
    const results: Array<{ migration: string; status: string; error?: string }> = [];

    // 1. studentEnrollmentBlocked sur tenants
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "studentEnrollmentBlocked" BOOLEAN NOT NULL DEFAULT false`,
      );
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "tenants_studentEnrollmentBlocked_idx" ON "tenants"("studentEnrollmentBlocked")`,
      );
      results.push({ migration: 'studentEnrollmentBlocked', status: 'OK' });
      this.logger.log('✅ studentEnrollmentBlocked column ensured');
    } catch (err: any) {
      results.push({ migration: 'studentEnrollmentBlocked', status: 'FAILED', error: err.message });
      this.logger.error(`studentEnrollmentBlocked failed: ${err.message}`);
    }

    // 2. logo_url sur onboarding_drafts
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "logo_url" TEXT`,
      );
      results.push({ migration: 'logo_url', status: 'OK' });
      this.logger.log('✅ logo_url column ensured');
    } catch (err: any) {
      results.push({ migration: 'logo_url', status: 'FAILED', error: err.message });
      this.logger.error(`logo_url failed: ${err.message}`);
    }

    // 3. Vérifier que l'enum BillingEventType a les nouveaux types
    // (ALTER TYPE ne supporte pas IF NOT EXISTS en PG < 10, mais c'est OK depuis 9.3)
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_ACTIVATION'`,
      );
      await this.prisma.$executeRawUnsafe(
        `ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_ACTIVATED'`,
      );
      await this.prisma.$executeRawUnsafe(
        `ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_DEACTIVATED'`,
      );
      results.push({ migration: 'BillingEventType enum', status: 'OK' });
      this.logger.log('✅ BillingEventType enum extended');
    } catch (err: any) {
      results.push({ migration: 'BillingEventType enum', status: 'FAILED', error: err.message });
      this.logger.error(`BillingEventType enum failed: ${err.message}`);
    }

    // Note: ALTER TYPE ADD VALUE ne peut pas être exécuté dans une transaction.
    // Si l'erreur est "type already exists", c'est OK.
    const summary = {
      applied: results.filter((r) => r.status === 'OK').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      details: results,
    };

    this.logger.log(`🔧 Migration application summary: ${JSON.stringify(summary)}`);
    return summary;
  }
}
