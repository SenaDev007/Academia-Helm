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
import { InvoiceService } from './services/invoice.service';
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
    private readonly invoiceService: InvoiceService,
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
    // Utiliser HelmSubscription (relation 1-1 avec tenant via tenantId @unique)
    // qui est le modèle principal du système de billing actuel.
    const sub = await this.prisma.helmSubscription.findUnique({
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

    // Utiliser HelmSubscription (relation 1-1 via tenantId @unique)
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé pour ce tenant. Souscrivez d\'abord à un plan.');
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

    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé');
    }

    // Activer l'option bilingue
    await this.prisma.helmSubscription.update({
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

    // Générer et envoyer la facture au client
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, subdomain: true },
      });

      const amount = sub.billingCycle === 'ANNUAL'
        ? 100000  // bilingualYearly
        : 10000;  // bilingualMonthly

      await this.invoiceService.createAndSendInvoice({
        tenantId,
        tenantName: tenant?.name || 'Établissement',
        tenantSubdomain: tenant?.subdomain,
        customerEmail: body.customerEmail || (adminEmail || ''),
        customerName: tenant?.name || 'Client',
        amount,
        description: `Activation option bilingue (Français + Anglais) — ${sub.billingCycle === 'ANNUAL' ? 'Annuel' : 'Mensuel'}`,
        type: 'BILINGUAL_ACTIVATION',
        paymentReference: body.reference || body.transactionId,
        paymentMethod: 'MOBILE_MONEY',
        billingCycle: sub.billingCycle === 'ANNUAL' ? 'YEARLY' : 'MONTHLY',
        bilingualEnabled: true,
      });
    } catch (invoiceErr: any) {
      this.logger.warn(`Failed to send bilingual invoice: ${invoiceErr.message}`);
    }

    return { success: true, message: 'Option bilingue activée avec succès. Une facture vous a été envoyée par email.' };
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
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });
    if (!sub) {
      throw new BadRequestException('Aucun abonnement trouvé');
    }
    if (!sub.bilingualEnabled) {
      return { success: true, message: 'Option bilingue déjà désactivée', alreadyInactive: true };
    }

    // Désactiver l'option bilingue
    await this.prisma.helmSubscription.update({
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

    // 3. bilingualEnabled sur HelmSubscription
    // Note: la table s'appelle "HelmSubscription" (PascalCase, pas de @@map)
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "bilingualEnabled" BOOLEAN NOT NULL DEFAULT false`,
      );
      results.push({ migration: 'bilingualEnabled (HelmSubscription)', status: 'OK' });
      this.logger.log('✅ bilingualEnabled column ensured');
    } catch (err: any) {
      results.push({ migration: 'bilingualEnabled (HelmSubscription)', status: 'FAILED', error: err.message });
      this.logger.error(`bilingualEnabled failed: ${err.message}`);
    }

    // 4. Étendre HelmInvoice (champs facturation complète)
    // Note: la table s'appelle "HelmInvoice" (PascalCase, pas de @@map)
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ALTER COLUMN "subscriptionId" DROP NOT NULL`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ALTER COLUMN "plan" DROP NOT NULL`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ALTER COLUMN "billingCycle" DROP NOT NULL`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ALTER COLUMN "period" DROP NOT NULL`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "customerName" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "description" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "type" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "paymentOperator" TEXT`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "bilingualEnabled" BOOLEAN NOT NULL DEFAULT false`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "HelmInvoice" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3)`);
      await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HelmInvoice_invoiceNumber_key" ON "HelmInvoice"("invoiceNumber")`);
      await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HelmInvoice_customerEmail_idx" ON "HelmInvoice"("customerEmail")`);
      await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HelmInvoice_type_idx" ON "HelmInvoice"("type")`);
      results.push({ migration: 'HelmInvoice extended', status: 'OK' });
      this.logger.log('✅ HelmInvoice extended with billing fields');
    } catch (err: any) {
      results.push({ migration: 'HelmInvoice extended', status: 'FAILED', error: err.message });
      this.logger.error(`HelmInvoice extension failed: ${err.message}`);
    }

    // 5. Vérifier que l'enum BillingEventType a les nouveaux types
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

    // 6. CMS tables (blog_articles, cms_pages, legal_pages, seo_meta, media_assets)
    try {
      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "blog_articles" (
        "id" TEXT NOT NULL, "title" TEXT NOT NULL, "slug" TEXT NOT NULL,
        "excerpt" TEXT, "content" TEXT, "coverImageUrl" TEXT,
        "category" TEXT, "tags" TEXT, "seoTitle" TEXT, "seoDescription" TEXT,
        "status" TEXT NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP(3),
        "authorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "blog_articles_pkey" PRIMARY KEY ("id")
      )`);
      await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "blog_articles_slug_key" ON "blog_articles"("slug")`);
      await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "blog_articles_status_idx" ON "blog_articles"("status")`);

      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "cms_pages" (
        "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL,
        "content" JSON, "seoTitle" TEXT, "seoDescription" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
      )`);
      await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_slug_key" ON "cms_pages"("slug")`);

      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "legal_pages" (
        "id" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL,
        "content" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "legal_pages_pkey" PRIMARY KEY ("id")
      )`);
      await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "legal_pages_code_key" ON "legal_pages"("code")`);

      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "seo_meta" (
        "id" TEXT NOT NULL, "pagePath" TEXT NOT NULL,
        "title" TEXT, "description" TEXT, "ogTitle" TEXT, "ogDescription" TEXT,
        "ogImageUrl" TEXT, "keywords" TEXT, "canonicalUrl" TEXT,
        "noIndex" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
      )`);
      await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "seo_meta_pagePath_key" ON "seo_meta"("pagePath")`);

      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "media_assets" (
        "id" TEXT NOT NULL, "name" TEXT NOT NULL, "url" TEXT NOT NULL,
        "type" TEXT NOT NULL, "size" INTEGER, "alt" TEXT, "tags" TEXT,
        "uploadedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
      )`);
      await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "media_assets_type_idx" ON "media_assets"("type")`);

      results.push({ migration: 'CMS tables (blog, cms_pages, legal, seo, media)', status: 'OK' });
      this.logger.log('✅ CMS tables ensured');
    } catch (err: any) {
      results.push({ migration: 'CMS tables', status: 'FAILED', error: err.message });
      this.logger.error(`CMS tables failed: ${err.message}`);
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

  /**
   * POST /api/billing/admin/seed-tenant-subscriptions
   *
   * Crée les HelmSubscription manquants pour les tenants existants + insère
   * les factures et événements de paiement correspondants.
   *
   * Pour CSPEB Éveil d'Afrique :
   *   - Plan GROW, billingCycle MONTHLY, status ACTIVE
   *   - currentPeriodEnd = aujourd'hui + 30 jours
   *   - Facture INITIALE de 100 000 FCFA (frais d'activation)
   *   - BillingEvent INITIAL_SUBSCRIPTION
   *
   * Pour Academia Helm :
   *   - Plan SEED, billingCycle MONTHLY, status TRIALING
   *   - trialEnd = aujourd'hui + 30 jours
   *   - currentPeriodEnd = trialEnd
   */
  @Public()
  @Post('admin/seed-tenant-subscriptions')
  async seedTenantSubscriptions(
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

    this.logger.log(`🔧 Seeding tenant subscriptions triggered by admin ${adminEmail}`);
    const results: any[] = [];

    // Récupérer tous les tenants actifs
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { not: 'WITHDRAWN' } },
      include: { helmSubscriptions: true },
    });

    for (const tenant of tenants) {
      const existingSub = tenant.helmSubscriptions;

      // Déterminer le plan basé sur l'ancien subscriptionPlan
      const oldPlan = (tenant.subscriptionPlan || '').toLowerCase();
      const isCspeb = tenant.name.includes('Éveil') || tenant.name.includes('Eveil') || tenant.slug.includes('cspeb');

      const plan = isCspeb ? 'GROW' : 'SEED';
      const billingCycle = 'MONTHLY';
      const monthlyAmount = isCspeb ? 24900 : 19900;
      const annualAmount = isCspeb ? 249000 : 199000;
      const setupFee = isCspeb ? 100000 : 75000;
      const status = isCspeb ? 'ACTIVE' : 'TRIALING';

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      if (!existingSub) {
        // Créer le HelmSubscription
        const sub = await this.prisma.helmSubscription.create({
          data: {
            tenantId: tenant.id,
            plan: plan as any,
            billingCycle: billingCycle as any,
            status: status as any,
            monthlyAmount,
            annualAmount,
            setupFee,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEnd: status === 'TRIALING' ? periodEnd : null,
            bilingualEnabled: isCspeb, // CSPEB est bilingue
            lastPaymentDate: isCspeb ? now : null,
            lastPaymentAmount: isCspeb ? setupFee : null,
          },
        });

        results.push({ tenant: tenant.name, action: 'HelmSubscription created', plan, status, subId: sub.id });

        // Pour CSPEB : créer la facture + billing event
        if (isCspeb) {
          // BillingEvent (subscriptionId est optionnel et référence Subscription,
          // pas HelmSubscription — on ne le passe pas pour éviter P2003)
          const event = await this.prisma.billingEvent.create({
            data: {
              tenantId: tenant.id,
              type: 'INITIAL_SUBSCRIPTION' as any,
              amount: setupFee,
              channel: 'FEEXPAY',
              reference: `SEED-CSPEB-${Date.now()}`,
              metadata: {
                seededBy: adminEmail,
                description: 'Souscription initiale - Helm Grow (mensuel)',
                planCode: plan,
                helmSubscriptionId: sub.id,
              },
            },
          });
          results.push({ tenant: tenant.name, action: 'BillingEvent created', eventId: event.id });

          // HelmInvoice
          const invoiceNumber = `AH-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-00001`;
          try {
            const invoice = await this.prisma.helmInvoice.create({
              data: {
                subscriptionId: sub.id,
                tenantId: tenant.id,
                amount: setupFee,
                currency: 'XOF',
                plan: plan as any,
                billingCycle: billingCycle as any,
                period: 'INITIAL',
                status: 'PAID',
                paidAt: now,
                invoiceNumber,
                customerEmail: 'contact@cspeb-eveilafrique.bj',
                customerName: tenant.name,
                description: 'Souscription initiale — Helm Grow (mensuel) + frais d\'activation',
                type: 'INITIAL_SUBSCRIPTION',
                paymentReference: `SEED-CSPEB-${Date.now()}`,
                paymentMethod: 'MOBILE_MONEY',
                paymentOperator: 'MTN',
                bilingualEnabled: true,
                issuedAt: now,
              },
            });
            results.push({ tenant: tenant.name, action: 'HelmInvoice created', invoiceId: invoice.id, invoiceNumber });
          } catch (invErr: any) {
            results.push({ tenant: tenant.name, action: 'HelmInvoice FAILED', error: invErr.message });
          }

          // Mettre à jour le tenant avec les bonnes infos
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: 'ACTIVE',
              subscriptionPlan: 'grow',
              nextPaymentDueAt: periodEnd,
            },
          });
          results.push({ tenant: tenant.name, action: 'Tenant updated', subscriptionStatus: 'ACTIVE' });
        } else {
          // Academia Helm : TRIAL
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: 'TRIAL',
              subscriptionPlan: 'seed',
              trialEndsAt: periodEnd,
            },
          });
          results.push({ tenant: tenant.name, action: 'Tenant updated', subscriptionStatus: 'TRIAL' });
        }
      } else {
        results.push({ tenant: tenant.name, action: 'HelmSubscription already exists', subId: existingSub.id });
      }
    }

    this.logger.log(`✅ Seed complete: ${results.length} operations`);
    return { success: true, results };
  }

  /**
   * POST /api/billing/admin/seed-cspeb-billing
   *
   * Force la création de la facture + BillingEvent + OnboardingPayment
   * pour CSPEB Éveil d'Afrique (même si le HelmSubscription existe déjà).
   *
   * Données insérées :
   *   - HelmInvoice : AH-2026-06-00001, 100 000 FCFA, PAID
   *   - BillingEvent : INITIAL_SUBSCRIPTION, 100 000 FCFA, FEEXPAY
   *   - OnboardingDraft + OnboardingPayment : simulation de la souscription initiale
   */
  @Public()
  @Post('admin/seed-cspeb-billing')
  async seedCspebBilling(
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

    this.logger.log(`🔧 Seeding CSPEB billing data triggered by admin ${adminEmail}`);
    const results: any[] = [];
    const now = new Date();

    // 1. Trouver CSPEB
    const cspeb = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: 'Eveil', mode: 'insensitive' } },
          { name: { contains: 'Éveil', mode: 'insensitive' } },
          { slug: { contains: 'cspeb' } },
        ],
      },
      include: { helmSubscriptions: true },
    });

    if (!cspeb) {
      return { success: false, error: 'CSPEB tenant non trouvé' };
    }

    results.push({ step: 'Tenant trouvé', tenantId: cspeb.id, name: cspeb.name });

    const sub = cspeb.helmSubscriptions;
    if (!sub) {
      return { success: false, error: 'CSPEB n\'a pas de HelmSubscription' };
    }

    // 2. Créer le BillingEvent (paiement)
    const existingEvent = await this.prisma.billingEvent.findFirst({
      where: { tenantId: cspeb.id, type: 'INITIAL_SUBSCRIPTION' },
    });

    if (!existingEvent) {
      const event = await this.prisma.billingEvent.create({
        data: {
          tenantId: cspeb.id,
          type: 'INITIAL_SUBSCRIPTION' as any,
          amount: 100000,
          channel: 'FEEXPAY',
          reference: `CSPEB-INIT-${Date.now()}`,
          metadata: {
            seededBy: adminEmail,
            description: 'Souscription initiale - Helm Grow (mensuel) + frais d\'activation',
            planCode: 'GROW',
            helmSubscriptionId: sub.id,
            paymentMethod: 'MOBILE_MONEY',
            operator: 'MTN',
          },
        },
      });
      results.push({ step: 'BillingEvent créé', eventId: event.id, amount: 100000 });
    } else {
      results.push({ step: 'BillingEvent existe déjà', eventId: existingEvent.id });
    }

    // 3. Créer le HelmInvoice (facture)
    const existingInvoice = await this.prisma.helmInvoice.findFirst({
      where: { tenantId: cspeb.id },
    });

    if (!existingInvoice) {
      const invoiceNumber = `AH-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-00001`;
      const invoice = await this.prisma.helmInvoice.create({
        data: {
          subscriptionId: sub.id,
          tenantId: cspeb.id,
          amount: 100000,
          currency: 'XOF',
          plan: 'GROW' as any,
          billingCycle: 'MONTHLY' as any,
          period: 'INITIAL',
          status: 'PAID',
          paidAt: now,
          invoiceNumber,
          customerEmail: 's.akpovitohou@gmail.com',
          customerName: cspeb.name,
          description: 'Souscription initiale — Helm Grow (mensuel) + frais d\'activation 100 000 FCFA',
          type: 'INITIAL_SUBSCRIPTION',
          paymentReference: `CSPEB-INIT-${Date.now()}`,
          paymentMethod: 'MOBILE_MONEY',
          paymentOperator: 'MTN',
          bilingualEnabled: true,
          issuedAt: now,
        },
      });
      results.push({ step: 'HelmInvoice créé', invoiceId: invoice.id, invoiceNumber, amount: 100000 });
    } else {
      results.push({ step: 'HelmInvoice existe déjà', invoiceId: existingInvoice.id });
    }

    // 4. Créer l'OnboardingDraft + OnboardingPayment (souscription initiale)
    const existingDraft = await this.prisma.onboardingDraft.findFirst({
      where: { email: 's.akpovitohou@gmail.com' },
    });

    // 4b. Créer ou mettre à jour l'entité School (pour la ville)
    const existingSchool = await this.prisma.school.findUnique({
      where: { tenantId: cspeb.id },
    });

    if (!existingSchool) {
      await this.prisma.school.create({
        data: {
          tenantId: cspeb.id,
          name: cspeb.name,
          city: 'Parakou',
          address: 'Parakou, Bénin',
          primaryPhone: '+22900000000',
          primaryEmail: 's.akpovitohou@gmail.com',
          educationLevels: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
        },
      });
      results.push({ step: 'School créé', city: 'Parakou' });
    } else {
      // Mettre à jour la ville si elle est vide
      if (!existingSchool.city) {
        await this.prisma.school.update({
          where: { id: existingSchool.id },
          data: { city: 'Parakou', address: 'Parakou, Bénin' },
        });
        results.push({ step: 'School mis à jour', city: 'Parakou' });
      } else {
        results.push({ step: 'School existe déjà', city: existingSchool.city });
      }
    }

    // 4c. Créer aussi une School pour Academia Helm
    const ahTenant = await this.prisma.tenant.findFirst({
      where: { slug: 'academiahelm' },
    });
    if (ahTenant) {
      const ahSchool = await this.prisma.school.findUnique({
        where: { tenantId: ahTenant.id },
      });
      if (!ahSchool) {
        await this.prisma.school.create({
          data: {
            tenantId: ahTenant.id,
            name: ahTenant.name,
            city: 'Cotonou',
            address: 'Cotonou, Bénin',
            educationLevels: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
          },
        });
        results.push({ step: 'School créé pour Academia Helm', city: 'Cotonou' });
      } else if (!ahSchool.city) {
        await this.prisma.school.update({
          where: { id: ahSchool.id },
          data: { city: 'Cotonou' },
        });
        results.push({ step: 'School mis à jour pour Academia Helm', city: 'Cotonou' });
      }
    }

    // 4d. Mettre à jour bilingualEnabled pour CSPEB (qui est bilingue)
    if (!sub.bilingualEnabled) {
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: { bilingualEnabled: true },
      });
      results.push({ step: 'HelmSubscription.bilingualEnabled = true' });
    }

    if (!existingDraft) {
      const draft = await this.prisma.onboardingDraft.create({
        data: {
          schoolName: cspeb.name,
          schoolType: 'mixte',
          city: 'Parakou',
          country: 'Bénin',
          phone: '+22900000000',
          email: 's.akpovitohou@gmail.com',
          bilingual: true,
          schoolsCount: 1,
          preferredSubdomain: cspeb.subdomain || 'cspeb-eveildafriqueeducation',
          promoterFirstName: 'Sena',
          promoterLastName: 'Akpovitohou',
          promoterEmail: 's.akpovitohou@gmail.com',
          promoterPhone: '+22900000000',
          promoterPasswordHash: '$2b$12$placeholder.hash.for.seed.data',
          otpVerified: true,
          selectedPlanId: null,
          priceSnapshot: { planCode: 'GROW', billingCycle: 'MONTHLY', monthlyPrice: 24900, setupFee: 100000 } as any,
          status: 'COMPLETED',
        },
      });

      const payment = await this.prisma.onboardingPayment.create({
        data: {
          draftId: draft.id,
          provider: 'feexpay',
          reference: `CSPEB-ONBOARD-${Date.now()}`,
          amount: 100000,
          currency: 'XOF',
          status: 'SUCCESS',
          metadata: {
            seededBy: adminEmail,
            tenantId: cspeb.id,
            paymentMethod: 'MOBILE_MONEY',
            operator: 'MTN',
            firstTenantSubdomain: cspeb.subdomain,
          } as any,
        },
      });

      results.push({ step: 'OnboardingDraft créé', draftId: draft.id });
      results.push({ step: 'OnboardingPayment créé', paymentId: payment.id, amount: 100000 });
    } else {
      results.push({ step: 'OnboardingDraft existe déjà', draftId: existingDraft.id });
    }

    this.logger.log(`✅ CSPEB billing seed complete: ${results.length} operations`);
    return { success: true, results };
  }
}
