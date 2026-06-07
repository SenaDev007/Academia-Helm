/**
 * ============================================================================
 * BILLING REMINDER SERVICE - MOTEUR RAPPELS AUTOMATIQUES
 * ============================================================================
 * 
 * Service pour envoyer des rappels automatiques :
 * - J-7 : 7 jours avant expiration
 * - J-3 : 3 jours avant expiration
 * - J-1 : 1 jour avant expiration
 * 
 * Features :
 * - Prévention doublons (BillingReminderLog)
 * - Multi-canal (SMS, WhatsApp, Email)
 * - Utilisation paramètres communication tenant
 * - Intégration ORION (RISK_NON_RENEWAL si J-1 ignoré)
 * - Audit complet
 * 
 * ============================================================================
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmsService } from '../../auth/services/sms.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { OrionAlertsService } from '../../orion/services/orion-alerts.service';
import { PricingService } from './pricing.service';

@Injectable()
export class BillingReminderService {
  private readonly logger = new Logger(BillingReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly pricingService: PricingService,
    @Inject(forwardRef(() => OrionAlertsService))
    private readonly orionAlertsService?: OrionAlertsService,
  ) {}

  /**
   * Tâche cron qui vérifie les souscriptions à rappeler
   * Exécutée tous les jours à 9h00
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkAndSendReminders() {
    this.logger.log('🔔 Checking subscriptions for reminders...');

    const now = new Date();
    const reminders = {
      day7: 0,
      day3: 0,
      day1: 0,
      errors: 0,
    };

    try {
      // Récupérer toutes les souscriptions actives ou en trial
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          status: {
            in: ['TRIAL_ACTIVE', 'ACTIVE', 'GRACE'],
          },
        },
        include: {
          tenant: {
            include: {
              settingsCommunication: true,
            },
          },
          subscriptionPlan: true,
        },
      });

      for (const subscription of subscriptions) {
        try {
          const expirationDate = subscription.trialEnd || subscription.currentPeriodEnd;
          
          if (!expirationDate) {
            continue;
          }

          const daysUntilExpiration = Math.ceil(
            (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          // ⚠️ Récupérer les jours de rappel depuis PricingService (paramétrable)
          const reminderDays = await this.pricingService.getReminderDays();

          // J-7 (ou premier jour configuré)
          if (reminderDays.includes(7) && daysUntilExpiration === 7) {
            const sent = await this.sendReminder(subscription, 7, 'J-7');
            if (sent) reminders.day7++;
            else reminders.errors++;
          }

          // J-3 (ou deuxième jour configuré)
          if (reminderDays.includes(3) && daysUntilExpiration === 3) {
            const sent = await this.sendReminder(subscription, 3, 'J-3');
            if (sent) reminders.day3++;
            else reminders.errors++;
          }

          // J-1 (ou dernier jour configuré)
          if (reminderDays.includes(1) && daysUntilExpiration === 1) {
            const sent = await this.sendReminder(subscription, 1, 'J-1');
            if (sent) {
              reminders.day1++;
            } else {
              reminders.errors++;
              // ⚠️ Si J-1 échoue, émettre alerte ORION RISK_NON_RENEWAL
              await this.emitOrionRiskAlert(subscription);
            }
          }

          // Vérifier si J-1 a été ignoré (pas de réponse après envoi)
          if (daysUntilExpiration === 0) {
            await this.checkJ1Ignored(subscription);
          }
        } catch (error) {
          this.logger.error(
            `Error processing reminder for subscription ${subscription.id}:`,
            error
          );
          reminders.errors++;
        }
      }

      this.logger.log(
        `✅ Reminders sent - J-7: ${reminders.day7}, J-3: ${reminders.day3}, J-1: ${reminders.day1}, Errors: ${reminders.errors}`
      );

      return reminders;
    } catch (error) {
      this.logger.error('Error in checkAndSendReminders:', error);
      throw error;
    }
  }

  /**
   * Vérifie si J-1 a été ignoré (pas de renouvellement après envoi)
   */
  private async checkJ1Ignored(subscription: any) {
    // Vérifier si un rappel J-1 a été envoyé
    const j1Reminder = await this.prisma.billingReminderLog.findFirst({
      where: {
        subscriptionId: subscription.id,
        reminderType: 'J-1',
        daysRemaining: 1,
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    if (!j1Reminder) {
      return; // Pas de rappel J-1 envoyé
    }

    // Vérifier si le tenant a renouvelé depuis
    const hasRenewed = await this.prisma.billingEvent.findFirst({
      where: {
        tenantId: subscription.tenantId,
        type: 'RENEWAL',
        createdAt: {
          gte: j1Reminder.sentAt,
        },
      },
    });

    if (!hasRenewed) {
      // J-1 ignoré → émettre alerte ORION RISK_NON_RENEWAL
      this.logger.warn(
        `⚠️  J-1 reminder ignored for tenant ${subscription.tenantId} - Emitting ORION RISK_NON_RENEWAL alert`
      );
      await this.emitOrionRiskAlert(subscription, 'J-1_IGNORED');
    }
  }

  /**
   * Émet une alerte ORION RISK_NON_RENEWAL
   * 
   * ⚠️ CRITIQUE : Si tenant ignore J-1 → ORION_FLAG = RISK_NON_RENEWAL
   */
  private async emitOrionRiskAlert(
    subscription: any,
    reason: string = 'J-1_FAILED',
  ) {
    try {
      const tenant = subscription.tenant;
      const plan = subscription.subscriptionPlan;
      const expirationDate = subscription.trialEnd || subscription.currentPeriodEnd;
      
      // Créer l'alerte ORION via OrionAlertsService
      if (this.orionAlertsService) {
        await this.orionAlertsService.saveAlert(subscription.tenantId, {
          alertType: 'FINANCIAL',
          severity: 'WARNING',
          title: 'Risque de Non-Renouvellement',
          description: `Le tenant ${tenant?.name || subscription.tenantId} n'a pas répondu au rappel J-1. Risque de non-renouvellement de l'abonnement.`,
          recommendation: `Contacter le promoteur pour comprendre les raisons du non-renouvellement et proposer une solution adaptée.`,
          message: `Risque de non-renouvellement - ${tenant?.name || subscription.tenantId}`,
          metadata: {
            ORION_FLAG: 'RISK_NON_RENEWAL',
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            tenantName: tenant?.name,
            planName: plan?.name,
            reason,
            trialEnd: subscription.trialEnd?.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
            expirationDate: expirationDate?.toISOString(),
            status: subscription.status,
            reminderType: 'J-1',
            timestamp: new Date().toISOString(),
          },
        });

        this.logger.warn(
          `📡 ORION: RISK_NON_RENEWAL alert created - Tenant: ${subscription.tenantId} - Subscription: ${subscription.id} - Reason: ${reason}`
        );
      } else {
        // Fallback si OrionAlertsService n'est pas disponible
        this.logger.warn(
          `📡 ORION: RISK_NON_RENEWAL - Tenant: ${subscription.tenantId} - Subscription: ${subscription.id} - Reason: ${reason} (OrionAlertsService not available)`
        );
      }
    } catch (error) {
      // Ne pas bloquer si ORION échoue
      this.logger.error('Failed to emit ORION risk alert:', error);
      
      // Log de secours pour audit
      this.logger.warn(
        `⚠️  ORION RISK_NON_RENEWAL (fallback log) - Tenant: ${subscription.tenantId} - Subscription: ${subscription.id} - Reason: ${reason}`
      );
    }
  }

  /**
   * Envoie un rappel pour une souscription
   * 
   * @returns true si envoyé avec succès, false sinon
   */
  private async sendReminder(
    subscription: any,
    daysRemaining: number,
    reminderType: 'J-7' | 'J-3' | 'J-1',
  ): Promise<boolean> {
    // 1. Vérifier si le rappel a déjà été envoyé (prévention doublons)
    const existingReminder = await this.prisma.billingReminderLog.findUnique({
      where: {
        subscriptionId_reminderType_daysRemaining: {
          subscriptionId: subscription.id,
          reminderType,
          daysRemaining,
        },
      },
    });

    if (existingReminder) {
      this.logger.debug(
        `⏭️  Reminder ${reminderType} already sent for subscription ${subscription.id} - Skipping`
      );
      return true; // Déjà envoyé, considéré comme succès
    }

    const tenant = subscription.tenant;
    const planName =
      subscription.subscriptionPlan?.name ?? (subscription.plan as string) ?? 'Plan';

    // Téléphone de contact établissement (User n'a pas de champ phone dans le schéma)
    const schoolSettings = await this.prisma.schoolSettings.findUnique({
      where: { tenantId: subscription.tenantId },
      select: { phone: true },
    });
    const contactPhone = schoolSettings?.phone ?? null;

    // 2. Récupérer le promoteur (user avec role PROMOTER)
    const promoter = await this.prisma.user.findFirst({
      where: {
        tenantId: subscription.tenantId,
        role: 'PROMOTER',
        status: 'active',
      },
    });

    if (!promoter) {
      this.logger.warn(
        `⚠️  No promoter found for tenant ${subscription.tenantId} - Skipping reminder`
      );
      
      // Enregistrer l'échec dans le log
      await this.prisma.billingReminderLog.create({
        data: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          reminderType,
          daysRemaining,
          success: false,
          errorMessage: 'No promoter found',
          channels: {},
        },
      });
      
      return false;
    }

    // 3. Paramètres communication tenant (table settings_communication)
    const sc = tenant.settingsCommunication;
    const smsEnabled = sc?.smsEnabled !== false;
    const emailEnabled = sc?.emailEnabled !== false;
    const whatsappEnabled = sc?.whatsappEnabled !== false;

    const renewalUrl = `${this.configService.get<string>('FRONTEND_URL', 'https://app.academia-hub.com')}/billing/renew`;
    
    const message = this.buildReminderMessage(
      tenant.name,
      planName,
      daysRemaining,
      subscription.status,
      renewalUrl,
    );

    // 4. Envoyer via tous les canaux disponibles
    const results = {
      sms: false,
      email: false,
      whatsapp: false,
    };

    const errors: string[] = [];

    // 4.1. SMS
    if (smsEnabled && contactPhone) {
      try {
        await this.smsService.sendSms({
          to: contactPhone,
          message: message,
        });
        results.sms = true;
        this.logger.log(`✅ SMS reminder sent to ${contactPhone}`);
      } catch (error: any) {
        errors.push(`SMS: ${error.message}`);
        this.logger.error(`Failed to send SMS reminder to ${contactPhone}:`, error);
      }
    }

    // 4.2. Email
    if (emailEnabled && promoter.email) {
      try {
        const emailContent = this.emailService.formatBillingReminderEmail({
          schoolName: tenant.name,
          planName,
          daysRemaining,
          status: subscription.status,
          renewalUrl,
        });

        await this.emailService.sendEmail({
          to: promoter.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        results.email = true;
        this.logger.log(`✅ Email reminder sent to ${promoter.email}`);
      } catch (error: any) {
        errors.push(`Email: ${error.message}`);
        this.logger.error(`Failed to send email reminder to ${promoter.email}:`, error);
      }
    }

    // 4.3. WhatsApp
    if (whatsappEnabled && contactPhone) {
      try {
        const whatsappMessage = this.whatsappService.formatBillingReminderMessage({
          schoolName: tenant.name,
          planName,
          daysRemaining,
          status: subscription.status,
          renewalUrl,
        });

        await this.whatsappService.sendWhatsApp({
          to: contactPhone,
          message: whatsappMessage,
        });
        results.whatsapp = true;
        this.logger.log(`✅ WhatsApp reminder sent to ${contactPhone}`);
      } catch (error: any) {
        errors.push(`WhatsApp: ${error.message}`);
        this.logger.error(`Failed to send WhatsApp reminder to ${contactPhone}:`, error);
      }
    }

    // 5. Enregistrer dans BillingReminderLog
    const success = results.sms || results.email || results.whatsapp;
    
    await this.prisma.billingReminderLog.create({
      data: {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        reminderType,
        daysRemaining,
        channels: results,
        success,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
        metadata: {
          promoterId: promoter.id,
          promoterEmail: promoter.email,
          contactPhone,
          communicationSettings: {
            smsEnabled,
            emailEnabled,
            whatsappEnabled,
          },
        },
      },
    });

    if (success) {
      this.logger.log(
        `📧 Reminders sent to ${promoter.email} for tenant ${tenant.name} - ${daysRemaining} days remaining (SMS: ${results.sms}, Email: ${results.email}, WhatsApp: ${results.whatsapp})`
      );
    } else {
      this.logger.error(
        `❌ Failed to send any reminder for tenant ${tenant.name} - Errors: ${errors.join('; ')}`
      );
    }

    return success;
  }

  /**
   * Construit le message de rappel
   */
  private buildReminderMessage(
    schoolName: string,
    planName: string,
    daysRemaining: number,
    status: string,
    renewalUrl: string,
  ): string {
    const statusText = status === 'TRIAL_ACTIVE' ? 'période d\'essai' : 'abonnement';

    return `
Bonjour,

Votre ${statusText} pour ${schoolName} expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}.

Plan : ${planName}

Pour continuer à bénéficier de tous les services Academia Helm, veuillez renouveler votre abonnement.

Connectez-vous à votre espace pour effectuer le paiement :
${renewalUrl}

Cordialement,
L'équipe Academia Helm
    `.trim();
  }

  /**
   * Méthode manuelle pour forcer l'envoi d'un rappel (super admin)
   */
  async sendManualReminder(
    subscriptionId: string,
    reminderType: 'J-7' | 'J-3' | 'J-1',
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        tenant: {
          include: {
            settingsCommunication: true,
          },
        },
        subscriptionPlan: true,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const expirationDate = subscription.trialEnd || subscription.currentPeriodEnd;
    if (!expirationDate) {
      throw new Error('No expiration date found for subscription');
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return this.sendReminder(subscription, daysRemaining, reminderType);
  }
}
