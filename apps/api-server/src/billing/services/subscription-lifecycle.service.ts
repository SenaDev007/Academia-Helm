/**
 * ============================================================================
 * SUBSCRIPTION LIFECYCLE SERVICE
 * ============================================================================
 *
 * Gère le cycle de vie complet des abonnements Academia Helm :
 *
 *   1. Notifications avant expiration (J-7, J-3, J-1) → Email + WhatsApp
 *   2. Expiration silencieuse (Jour 0) → début période de grâce 7 jours
 *   3. Suspension (J+7) → accès lecture seule + bandeau "Abonnement expiré"
 *   4. Notification blocage (J+23) → "Votre compte sera bloqué dans 7 jours"
 *   5. Blocage définitif (J+30 après suspension = J+37) → plus aucun accès
 *   6. Réactivation → paiement 5 000 FCFA → compte réactivé
 *
 * Ce service est appelé par un cron job quotidien (runDailyCheck).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { StudentCountVerifierService } from './student-count-verifier.service';
import { PricingService } from './pricing.service';
import {
  TeacherSubscriptionService,
  TEACHER_MONTHLY_FEE,
} from '../../teacher-portal/services/teacher-subscription.service';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  // Délais (en jours)
  private readonly GRACE_PERIOD_DAYS = 7;        // Après expiration → grâce
  private readonly SUSPENSION_TO_BLOCK_DAYS = 30; // Après suspension → blocage
  private readonly BLOCK_WARNING_DAYS = 7;        // Avant blocage → notification

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService,
    private readonly studentCountVerifier: StudentCountVerifierService,
    private readonly pricingService: PricingService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Vérification quotidienne — appelée par le cron job.
   * Parcourt tous les abonnements et applique les transitions d'état.
   */
  async runDailyCheck(): Promise<void> {
    this.logger.log('🔄 Running daily subscription lifecycle check...');

    const now = new Date();
    let stats = { notified7: 0, notified3: 0, notified1: 0, expired: 0, suspended: 0, blockWarned: 0, blocked: 0 };

    try {
      const subscriptions = await this.prisma.helmSubscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'TRIALING'] },
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              type: true,
            },
          },
        },
      });

      this.logger.log(`Found ${subscriptions.length} active subscriptions to check`);

      for (const sub of subscriptions) {
        try {
          const result = await this.processSubscription(sub, now);
          if (result.action) {
            (stats as any)[result.action] = ((stats as any)[result.action] || 0) + 1;
          }
        } catch (err: any) {
          this.logger.error(`Error processing subscription ${sub.id} (${sub.tenant?.name}): ${err.message}`);
        }
      }

      this.logger.log(`✅ Daily check complete: ${JSON.stringify(stats)}`);
    } catch (err: any) {
      this.logger.error(`Daily check failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Traite un abonnement individuel.
   */
  private async processSubscription(sub: any, now: Date): Promise<{ action: string | null }> {
    const periodEnd = sub.currentPeriodEnd;
    if (!periodEnd) return { action: null };

    // ⭐ BRANCHE ENSEIGNANT (Helm Enseignant — 2 000 FCFA/mois) :
    //    cycle dédié : rappels J-7 puis J-24h AVEC LIEN DE PAIEMENT, grâce de
    //    7 jours (compte actif), puis INACTIVATION — la réactivation se fait
    //    par paiement (page /prof/checkout à la connexion). Pas de blocage
    //    définitif : les données restent conservées, un paiement redémarre le
    //    compteur à tout moment.
    if (String(sub.tenant?.type ?? '') === 'TEACHER') {
      return this.processTeacherSubscription(sub, now);
    }

    // ─── 1. NOTIFICATIONS AVANT EXPIRATION (J-7, J-3, J-1) ───
    if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') {
      const daysUntilExpiry = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // J-7
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 3 && !sub.notified7DaysBefore) {
        await this.sendExpirationNotification(sub, 7);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notified7DaysBefore: now },
        });
        return { action: 'notified7' };
      }

      // J-3
      if (daysUntilExpiry <= 3 && daysUntilExpiry > 1 && !sub.notified3DaysBefore) {
        await this.sendExpirationNotification(sub, 3);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notified3DaysBefore: now },
        });
        return { action: 'notified3' };
      }

      // J-1 (24h)
      if (daysUntilExpiry <= 1 && daysUntilExpiry > 0 && !sub.notified1DayBefore) {
        await this.sendExpirationNotification(sub, 1);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notified1DayBefore: now },
        });
        return { action: 'notified1' };
      }
    }

    // ─── 2. EXPIRATION SILENCIEUSE (Jour 0) ───
    if ((sub.status === 'ACTIVE' || sub.status === 'TRIALING') && now > periodEnd) {
      const gracePeriodEnd = new Date(periodEnd.getTime() + this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'GRACE_PERIOD',
          expiredAt: now,
          gracePeriodEnd,
        },
      });
      // Mettre à jour le tenant
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: 'GRACE_PERIOD' },
      });
      this.logger.log(`Subscription ${sub.id} (${sub.tenant?.name}) expired silently → GRACE_PERIOD until ${gracePeriodEnd}`);
      return { action: 'expired' };
    }

    // ─── 3. SUSPENSION (J+7 — fin de grâce) ───
    if (sub.status === 'GRACE_PERIOD' && sub.gracePeriodEnd && now > sub.gracePeriodEnd) {
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: now,
        },
      });
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: 'SUSPENDED' },
      });
      // Notifier la suspension
      await this.sendSuspendedNotification(sub);
      this.logger.log(`Subscription ${sub.id} (${sub.tenant?.name}) → SUSPENDED`);
      return { action: 'suspended' };
    }

    // ─── 4. NOTIFICATION BLOCAGE (J+23 — 7 jours avant blocage) ───
    if (sub.status === 'SUSPENDED' && sub.suspendedAt && !sub.notifiedBlockWarning) {
      const daysSinceSuspension = Math.ceil((now.getTime() - sub.suspendedAt.getTime()) / (1000 * 60 * 60 * 24));
      const blockDate = new Date(sub.suspendedAt.getTime() + this.SUSPENSION_TO_BLOCK_DAYS * 24 * 60 * 60 * 1000);
      const daysUntilBlock = Math.ceil((blockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilBlock <= this.BLOCK_WARNING_DAYS && !sub.notifiedBlockWarning) {
        await this.sendBlockWarningNotification(sub, daysUntilBlock);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notifiedBlockWarning: now },
        });
        return { action: 'blockWarned' };
      }
    }

    // ─── 5. BLOCAGE DÉFINITIF (J+37 — 30 jours après suspension) ───
    if (sub.status === 'SUSPENDED' && sub.suspendedAt) {
      const blockDate = new Date(sub.suspendedAt.getTime() + this.SUSPENSION_TO_BLOCK_DAYS * 24 * 60 * 60 * 1000);
      if (now > blockDate) {
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: {
            status: 'BLOCKED',
            blockedAt: now,
          },
        });
        await this.prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { subscriptionStatus: 'BLOCKED', status: 'suspended' },
        });
        await this.sendBlockedNotification(sub);
        this.logger.log(`Subscription ${sub.id} (${sub.tenant?.name}) → BLOCKED`);
        return { action: 'blocked' };
      }
    }

    return { action: null };
  }

  /**
   * Réactive un abonnement bloqué après paiement des frais de réactivation.
   */
  async reactivateSubscription(tenantId: string): Promise<{ success: boolean; message: string }> {
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
      include: { tenant: { select: { name: true } } },
    });

    if (!sub) {
      return { success: false, message: 'Abonnement introuvable' };
    }

    if (sub.status !== 'BLOCKED') {
      return { success: false, message: 'L\'abonnement n\'est pas bloqué' };
    }

    const now = new Date();
    const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 jours

    await this.prisma.helmSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        expiredAt: null,
        gracePeriodEnd: null,
        suspendedAt: null,
        blockedAt: null,
        notified7DaysBefore: null,
        notified3DaysBefore: null,
        notified1DayBefore: null,
        notifiedBlockWarning: null,
        lastPaymentDate: now,
        lastPaymentAmount: sub.reactivationFee,
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'ACTIVE', status: 'active' },
    });

    this.logger.log(`Subscription ${sub.id} (${sub.tenant?.name}) reactivated`);

    return { success: true, message: 'Abonnement réactivé avec succès' };
  }

  /**
   * Renouvelle un abonnement (après paiement de l'abonnement mensuel/annuel).
   */
  async renewSubscription(tenantId: string, amount: number): Promise<{ success: boolean; message: string }> {
    const sub = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });

    if (!sub) {
      return { success: false, message: 'Abonnement introuvable' };
    }

    const now = new Date();
    const periodDuration = sub.billingCycle === 'ANNUAL' ? 365 : 30;
    const newPeriodEnd = new Date(now.getTime() + periodDuration * 24 * 60 * 60 * 1000);

    await this.prisma.helmSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        expiredAt: null,
        gracePeriodEnd: null,
        suspendedAt: null,
        blockedAt: null,
        notified7DaysBefore: null,
        notified3DaysBefore: null,
        notified1DayBefore: null,
        notifiedBlockWarning: null,
        lastPaymentDate: now,
        lastPaymentAmount: amount,
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'ACTIVE', status: 'active' },
    });

    this.logger.log(`Subscription ${sub.id} renewed for ${periodDuration} days`);

    return { success: true, message: 'Abonnement renouvelé avec succès' };
  }

  // ─── ENSEIGNANT (Helm Enseignant — 2 000 FCFA/mois) ───────────────────────

  /**
   * Cycle de vie dédié aux espaces enseignant autonomes (tenant type TEACHER) :
   *
   *   J-7   → email « préparez-vous à renouveler » (même système de
   *           notification que le reste d'Academia Helm) ;
   *   J-1   → second rappel AVEC LIEN/BOUTON de paiement (24 h) ;
   *   J0    → expiration silencieuse → GRÂCE DE 7 JOURS (compte actif) ;
   *   J+7   → SUSPENDED : compte inactif — à la connexion, l'enseignant est
   *           redirigé vers la page de paiement (/prof/checkout) ; un
   *           paiement réactive immédiatement (+30 jours) ;
   *   (∞)   → PAS de blocage définitif : les données sont conservées
   *           indéfiniment, la réactivation reste possible à tout moment.
   */
  private async processTeacherSubscription(sub: any, now: Date): Promise<{ action: string | null }> {
    const periodEnd = sub.currentPeriodEnd;

    // ─── 1. RAPPELS AVANT EXPIRATION (J-7 puis J-24h — spécification) ───
    if (sub.status === 'ACTIVE' || sub.status === 'TRIALING') {
      const daysUntilExpiry = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // J-7
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 1 && !sub.notified7DaysBefore) {
        await this.sendTeacherReminder(sub, 7);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notified7DaysBefore: now },
        });
        return { action: 'notified7' };
      }

      // J-1 (24 h) — avec lien/bouton de paiement
      if (daysUntilExpiry <= 1 && daysUntilExpiry > 0 && !sub.notified1DayBefore) {
        await this.sendTeacherReminder(sub, 1);
        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: { notified1DayBefore: now },
        });
        return { action: 'notified1' };
      }
    }

    // ─── 2. EXPIRATION SILENCIEUSE (J0) → grâce de 7 jours ───
    if ((sub.status === 'ACTIVE' || sub.status === 'TRIALING') && now > periodEnd) {
      const gracePeriodEnd = new Date(
        periodEnd.getTime() + this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      );
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'GRACE_PERIOD',
          expiredAt: now,
          gracePeriodEnd,
        },
      });
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: 'GRACE_PERIOD' },
      });
      this.logger.log(
        `Abonnement enseignant ${sub.id} expiré → grâce jusqu'au ${gracePeriodEnd.toISOString().slice(0, 10)}`,
      );
      return { action: 'expired' };
    }

    // ─── 3. INACTIVATION (J+7 — fin de grâce) ───
    if (sub.status === 'GRACE_PERIOD' && sub.gracePeriodEnd && now > sub.gracePeriodEnd) {
      await this.prisma.helmSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'SUSPENDED',
          suspendedAt: now,
        },
      });
      // ⚆ Le compte devient inactif : la connexion renverra l'enseignant vers
      //    la page de paiement pour réactiver (middleware + layout /prof).
      await this.prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: 'SUSPENDED' },
      });
      await this.sendTeacherSuspendedNotification(sub);
      this.logger.log(`Abonnement enseignant ${sub.id} → SUSPENDED (compte inactif)`);
      return { action: 'suspended' };
    }

    // ⚆ Pas de blocage définitif pour les enseignants : suspension indéfinie
    //    jusqu'au paiement de réactivation (données conservées).

    return { action: null };
  }

  /**
   * Rappel d'expiration enseignant (J-7 / J-24h) — délégué au
   * TeacherSubscriptionService via ModuleRef (résolution lazy : évite la
   * dépendance circulaire BillingModule ↔ TeacherPortalModule, même pattern
   * que EmailService → EmailLogService).
   */
  private async sendTeacherReminder(sub: any, daysLeft: number): Promise<void> {
    try {
      const teacherSvc = this.moduleRef.get(TeacherSubscriptionService, { strict: false });
      // ⭐ Realm enseignant (isolation des identifiants) : l'utilisateur peut
      //    être partagé avec les portails Academia Helm (users.tenantId ≠
      //    tenant enseignant) → résolution via UserTenant OU tenantId.
      const teacher = await this.prisma.user.findFirst({
        where: {
          OR: [{ userTenants: { some: { tenantId: sub.tenantId } } }, { tenantId: sub.tenantId }],
        },
        orderBy: { createdAt: 'asc' },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!teacher?.email) {
        this.logger.warn(`Aucun email enseignant pour le tenant ${sub.tenantId}`);
        return;
      }
      await teacherSvc.sendExpirationReminder({
        tenantId: sub.tenantId,
        teacherEmail: teacher.email,
        teacherName:
          [teacher.firstName, teacher.lastName].filter(Boolean).join(' ') || 'cher enseignant',
        daysLeft,
        currentPeriodEnd: sub.currentPeriodEnd,
        subscriptionId: sub.id,
      });
    } catch (err: any) {
      this.logger.error(`Rappel enseignant J-${daysLeft} échoué : ${err.message}`);
    }
  }

  /** Notification d'inactivation du compte enseignant (fin de grâce J+7). */
  private async sendTeacherSuspendedNotification(sub: any): Promise<void> {
    // ⭐ Realm enseignant : résolution via UserTenant OU tenantId (email
    //    partagé entre Academia Helm et le portail enseignant).
    const teacher = await this.prisma.user.findFirst({
      where: {
        OR: [{ userTenants: { some: { tenantId: sub.tenantId } } }, { tenantId: sub.tenantId }],
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!teacher?.email) return;

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com'
    )
      .trim()
      .replace(/\/$/, '');
    const checkoutUrl = `${frontendUrl}/prof/checkout`;

    const subject = '🔒 Votre compte Helm Enseignant est inactif — réactivez-le';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
<p>Bonjour ${teacher.firstName || 'cher enseignant'},</p>
<p>La période de grâce de 7 jours suivant l'expiration de votre abonnement <strong>Helm Enseignant</strong> est arrivée à son terme : votre compte est désormais <strong>inactif</strong>.</p>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:20px 0;">
<p style="margin:0;color:#991b1b;"><strong>Vos données sont intégralement conservées</strong> : cahier journal, fiches pédagogiques, évaluations, notes et bulletins. Rien n'est perdu.</p>
</div>
<p>Pour réactiver votre compte, il suffit de régler votre mensualité de <strong>${TEACHER_MONTHLY_FEE.toLocaleString('fr-FR')} FCFA</strong> — un nouveau compteur de 30 jours démarre immédiatement :</p>
<div style="text-align:center;margin:28px 0;">
<a href="${checkoutUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:12px;font-size:16px;">Réactiver mon compte — ${TEACHER_MONTHLY_FEE.toLocaleString('fr-FR')} FCFA / mois</a>
</div>
<p style="text-align:center;font-size:13px;color:#64748b;">Ou copiez ce lien : ${checkoutUrl}</p>
<p>Vous pouvez également réactiver directement à votre prochaine connexion : une page de paiement vous sera proposée automatiquement.</p>
<p>Cordialement,<br/>L'équipe Academia Helm</p>
</div>`;

    try {
      await this.emailService.sendCategorized({
        tenantId: sub.tenantId,
        category: 'FINANCE',
        subCategory: 'suspension_abonnement_enseignant',
        module: 'teacher-portal',
        to: teacher.email,
        subject,
        html,
        text: subject,
        recipientType: 'TEACHER',
        triggeredBy: 'AUTOMATION',
        relatedEntityType: 'HelmSubscription',
        relatedEntityId: sub.id,
      });
    } catch (err: any) {
      this.logger.error(`Email inactivation enseignant échoué : ${err.message}`);
    }
  }

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

  /**
   * Notification d'expiration (J-7 / J-3 / J-1)
   *
   * ⭐ ALIGNÉE SUR LES NOUVEAUX PLANS D'ABONNEMENT (page tarification + contrat
   * d'abonnement de l'onboarding sign-up) :
   *   - nom OFFICIEL du plan (« Helm Performance »…), jamais le code brut ;
   *   - grille tarifaire des 4 plans (contrat Article 3) ;
   *   - règles de renouvellement du contrat (Articles 4 et 5) : seuls les
   *     frais annuels sont dus au renouvellement (activation déjà réglée à la
   *     signature), option bilingue en supplément ;
   *   - lien direct vers la page Facturation (Paramètres → Facturation).
   */
  private async sendExpirationNotification(sub: any, daysLeft: number): Promise<void> {
    const schoolName = sub.tenant?.name || 'votre établissement';

    // ── Résolution du plan courant + grille (source pricing_plans) ──
    const planDisplay = await this.pricingService
      .resolvePlanDisplay(String(sub.plan || ''))
      .catch(() => null);
    const plansGrid = await this.pricingService
      .getActivePlansGrid()
      .catch(() => [] as Awaited<ReturnType<PricingService['getActivePlansGrid']>>);
    const bilingualYearlyFee = sub.bilingualEnabled
      ? await this.pricingService.getBilingualYearlyFee().catch(() => null)
      : null;

    const planName = planDisplay?.name || String(sub.plan || 'votre plan');
    const planCode = planDisplay?.code || String(sub.plan || '');
    const planRange = planDisplay
      ? planDisplay.studentMax == null
        ? `${planDisplay.studentMin} élèves et plus`
        : `${planDisplay.studentMin} à ${planDisplay.studentMax} élèves`
      : null;
    // Frais annuels du plan : prix COURANT de la grille (source de vérité,
    // comme la page tarification) ; repli sur le montant souscrit.
    const planAnnualFee = planDisplay?.yearlyAmount ?? sub.annualAmount ?? null;
    const planActivationFee = planDisplay?.initialFee ?? sub.setupFee ?? null;
    const renewalFee =
      planAnnualFee != null
        ? planAnnualFee + (bilingualYearlyFee ?? 0)
        : null;

    // Lien de renouvellement : page Facturation réelle de l'application
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'https://app.academiahelm.com').trim().replace(/\/$/, '');
    const renewalUrl = `${frontendUrl}/app/settings/billing`;

    // ── Email riche (template partagé, conforme contrat) ──
    const emailContent = this.emailService.formatBillingReminderEmail({
      schoolName,
      planName,
      planCode,
      planRange,
      planAnnualFee,
      planActivationFee,
      bilingualEnabled: !!sub.bilingualEnabled,
      bilingualYearlyFee,
      renewalFee,
      daysRemaining: daysLeft,
      status: sub.status === 'TRIALING' ? 'TRIAL_ACTIVE' : sub.status,
      renewalUrl,
      plansGrid,
    });

    try {
      const promoterEmail = await this.getPromoterEmail(sub.tenantId);
      if (promoterEmail) {
        await this.emailService.sendCategorized({
          tenantId: sub.tenantId,
          category: 'FINANCE',
          subCategory: 'rappel_expiration_abonnement',
          module: 'billing',
          to: promoterEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          recipientType: 'STAFF',
          triggeredBy: 'AUTOMATION',
          relatedEntityType: 'HelmSubscription',
          relatedEntityId: sub.id,
        });
        this.logger.log(`Email expiration J-${daysLeft} sent to ${promoterEmail} (plan: ${planName})`);
      }
    } catch (err: any) {
      this.logger.error(`Email notification failed: ${err.message}`);
    }

    // ── WhatsApp (aligné : plan + montant des frais annuels) ──
    try {
      const promoterPhone = await this.getPromoterPhone(sub.tenantId);
      if (promoterPhone) {
        const feeText = renewalFee != null
          ? `Frais annuels à régler : ${renewalFee.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`
          : '';
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message: `🎓 Academia Helm\n\nBonjour,\nVotre ${sub.status === 'TRIALING' ? 'période d\'essai' : 'abonnement'} pour ${schoolName} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nPlan actuel : ${planName}${planRange ? ` (${planRange})` : ''}\n${feeText}\n\nAu renouvellement, seuls les frais annuels sont dus (activation déjà réglée à la signature).\n\nRenouvelez ici : ${renewalUrl}`,
        });
        this.logger.log(`WhatsApp expiration J-${daysLeft} sent to ${promoterPhone}`);
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp notification failed: ${err.message}`);
    }
  }

  private async sendSuspendedNotification(sub: any): Promise<void> {
    const schoolName = sub.tenant?.name || 'votre établissement';
    const subject = `⚠️ Abonnement suspendu — ${schoolName}`;
    const message = `Bonjour,\n\nVotre abonnement Academia Helm pour ${schoolName} a été suspendu. Vous avez désormais accès en lecture seule à vos données.\n\nPour réactiver votre abonnement, veuillez effectuer le paiement de votre abonnement mensuel ou annuel.\n\nVotre compte sera bloqué définitivement dans 30 jours si vous ne renouvelez pas.\n\nCordialement,\nL'équipe Academia Helm`;

    try {
      const promoterEmail = await this.getPromoterEmail(sub.tenantId);
      if (promoterEmail) {
        await this.emailService.sendEmail({
          to: promoterEmail,
          subject,
          html: `<p>Bonjour,</p><p>Votre abonnement Academia Helm pour <strong>${schoolName}</strong> a été <strong>suspendu</strong>. Vous avez désormais accès en lecture seule à vos données.</p><p>Pour réactiver votre abonnement, veuillez effectuer le paiement de votre abonnement mensuel ou annuel.</p><div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:16px 0;"><p style="margin:0;color:#92400e;"><strong>⚠️ Important :</strong> Votre compte sera bloqué définitivement dans 30 jours si vous ne renouvelez pas.</p></div><p>Cordialement,<br>L'équipe Academia Helm</p>`,
          fromName: 'Academia Helm',
        });
      }
    } catch (err: any) {
      this.logger.error(`Email suspended notification failed: ${err.message}`);
    }

    try {
      const promoterPhone = await this.getPromoterPhone(sub.tenantId);
      if (promoterPhone) {
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message: `⚠️ Academia Helm\n\nBonjour,\nVotre abonnement pour ${schoolName} a été SUSPENDU.\n\nVous êtes en mode lecture seule.\n\nRenouvelez maintenant pour réactiver l'accès complet.\nVotre compte sera bloqué dans 30 jours sans renouvellement.\n\nConnectez-vous: https://academiahelm.com/login`,
        });
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp suspended notification failed: ${err.message}`);
    }
  }

  private async sendBlockWarningNotification(sub: any, daysLeft: number): Promise<void> {
    const schoolName = sub.tenant?.name || 'votre établissement';
    const subject = `🔒 Blocage imminent — ${schoolName}`;

    try {
      const promoterEmail = await this.getPromoterEmail(sub.tenantId);
      if (promoterEmail) {
        await this.emailService.sendEmail({
          to: promoterEmail,
          subject,
          html: `<p>Bonjour,</p><p>Votre compte Academia Helm pour <strong>${schoolName}</strong> sera <strong>bloqué définitivement dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p><div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px;margin:16px 0;"><p style="margin:0;color:#991b1b;"><strong>🔒 Après blocage :</strong> Vous ne pourrez plus accéder à votre compte. Pour le réactiver, des frais de 5 000 FCFA seront appliqués. Vos données seront préservées.</p></div><p>Renouvelez maintenant pour éviter le blocage.</p><p>Cordialement,<br>L'équipe Academia Helm</p>`,
          fromName: 'Academia Helm',
        });
      }
    } catch (err: any) {
      this.logger.error(`Email block warning failed: ${err.message}`);
    }

    try {
      const promoterPhone = await this.getPromoterPhone(sub.tenantId);
      if (promoterPhone) {
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message: `🔒 Academia Helm\n\nATTENTION\n\nVotre compte pour ${schoolName} sera BLOQUÉ dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nAprès blocage: frais de réactivation de 5000 FCFA.\nVos données seront préservées.\n\nRenouvelez URGENT: https://academiahelm.com/login`,
        });
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp block warning failed: ${err.message}`);
    }
  }

  private async sendBlockedNotification(sub: any): Promise<void> {
    const schoolName = sub.tenant?.name || 'votre établissement';
    const subject = `🔒 Compte bloqué — ${schoolName}`;

    try {
      const promoterEmail = await this.getPromoterEmail(sub.tenantId);
      if (promoterEmail) {
        await this.emailService.sendEmail({
          to: promoterEmail,
          subject,
          html: `<p>Bonjour,</p><p>Votre compte Academia Helm pour <strong>${schoolName}</strong> a été <strong>bloqué</strong>.</p><p>Pour réactiver votre compte, des frais de <strong>5 000 FCFA</strong> sont applicables. Vos données sont préservées et seront à nouveau accessibles après réactivation.</p><p>Pour réactiver, connectez-vous à votre compte et suivez les instructions.</p><p>Cordialement,<br>L'équipe Academia Helm</p>`,
          fromName: 'Academia Helm',
        });
      }
    } catch (err: any) {
      this.logger.error(`Email blocked notification failed: ${err.message}`);
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private async getPromoterEmail(tenantId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId,
          role: { in: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] },
        },
        select: { email: true },
      });
      return user?.email || null;
    } catch {
      return null;
    }
  }

  private async getPromoterPhone(tenantId: string): Promise<string | null> {
    try {
      // D'abord chercher dans Staff (qui a le numéro de téléphone)
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId, role: { in: ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR'] } },
        select: { phone: true },
      });
      if (staff?.phone) {
        // Normaliser le numéro (enlever espaces, ajouter + si manquant)
        let phone = staff.phone.replace(/[\s\-()]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;
        return phone;
      }

      // Fallback: chercher dans User
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId,
          role: { in: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] },
        },
        select: { phone: true },
      });
      if (user?.phone) {
        let phone = user.phone.replace(/[\s\-()]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;
        return phone;
      }
      return null;
    } catch {
      return null;
    }
  }
}
