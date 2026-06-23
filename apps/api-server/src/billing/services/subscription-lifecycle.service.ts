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
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { StudentCountVerifierService } from './student-count-verifier.service';

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

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

  private async sendExpirationNotification(sub: any, daysLeft: number): Promise<void> {
    const schoolName = sub.tenant?.name || 'votre établissement';
    const subject = `⏰ Votre abonnement Academia Helm expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
    const message = `Bonjour,\n\nVotre abonnement Academia Helm pour ${schoolName} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nPour éviter toute interruption de service, veuillez renouveler votre abonnement dès maintenant.\n\nConnectez-vous à votre espace Academia Helm et rendez-vous dans les paramètres pour renouveler.\n\nCordialement,\nL'équipe Academia Helm`;

    // Email
    try {
      const promoterEmail = await this.getPromoterEmail(sub.tenantId);
      if (promoterEmail) {
        await this.emailService.sendEmail({
          to: promoterEmail,
          subject,
          html: `<p>Bonjour,</p><p>Votre abonnement Academia Helm pour <strong>${schoolName}</strong> expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p><p>Pour éviter toute interruption de service, veuillez renouveler votre abonnement dès maintenant.</p><p>Connectez-vous à votre espace Academia Helm et rendez-vous dans les paramètres pour renouveler.</p><p>Cordialement,<br>L'équipe Academia Helm</p>`,
          fromName: 'Academia Helm',
        });
        this.logger.log(`Email expiration J-${daysLeft} sent to ${promoterEmail}`);
      }
    } catch (err: any) {
      this.logger.error(`Email notification failed: ${err.message}`);
    }

    // WhatsApp
    try {
      const promoterPhone = await this.getPromoterPhone(sub.tenantId);
      if (promoterPhone) {
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message: `🎓 Academia Helm\n\nBonjour,\nVotre abonnement pour ${schoolName} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.\n\nRenouvelez dès maintenant pour éviter toute interruption.\n\nConnectez-vous: https://academiahelm.com/login`,
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
