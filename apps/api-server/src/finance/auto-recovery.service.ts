/**
 * ============================================================================
 * AUTO RECOVERY SERVICE — Relance automatique paramétrable
 * ============================================================================
 *
 * Service qui parcourt tous les FeeArrear ouverts (balanceDue > 0) et envoie
 * des relances multi-canal (email + WhatsApp + SMS) selon les paramètres
 * configurés dans FinancialSettings :
 *   - autoRecoveryEnabled : activé/désactivé
 *   - autoRecoveryChannels : canaux (JSON {email, whatsapp, sms})
 *   - autoRecoveryFrequency : DAILY ou WEEKLY
 *   - autoRecoveryTime : heure d'exécution (HH:MM)
 *   - autoRecoveryMaxLevel : niveau max (PREMIERE_RELANCE, DEUXIEME_RELANCE, MISE_EN_DEMEURE)
 *   - reminderWarningDays : J+3 (première relance)
 *   - reminderUrgentDays : J+7 (deuxième relance)
 *   - reminderFinalDays : J+15 (mise en demeure)
 *
 * Le niveau de relance est déterminé par l'ancienneté de l'arriéré :
 *   - 3 à 6 jours → PREMIERE_RELANCE
 *   - 7 à 14 jours → DEUXIEME_RELANCE
 *   - 15+ jours → MISE_EN_DEMEURE
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { FinancialSettingsService } from './financial-settings.service';
import { RecoveryNotificationFinanceService } from './recovery-notification-finance.service';

@Injectable()
export class AutoRecoveryService {
  private readonly logger = new Logger(AutoRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: FinancialSettingsService,
    private readonly recoveryNotificationService: RecoveryNotificationFinanceService,
  ) {}

  /**
   * Cron job : vérifie toutes les heures si des relances auto doivent être envoyées.
   * Pour chaque tenant avec autoRecoveryEnabled = true, vérifie si l'heure
   * d'exécution correspond et lance la relance.
   */
  @Cron('0 * * * *') // Toutes les heures à minute 0
  async handleScheduledRecovery() {
    this.logger.log('Vérification des relances automatiques...');

    // Récupérer tous les tenants avec autoRecoveryEnabled = true
    const tenantsWithAutoRecovery = await this.prisma.financialSettings.findMany({
      where: { autoRecoveryEnabled: true },
      select: {
        tenantId: true,
        autoRecoveryFrequency: true,
        autoRecoveryTime: true,
        autoRecoveryChannels: true,
        autoRecoveryMaxLevel: true,
        reminderWarningDays: true,
        reminderUrgentDays: true,
        reminderFinalDays: true,
      },
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = dimanche, 1 = lundi, ...

    for (const settings of tenantsWithAutoRecovery) {
      try {
        // Vérifier l'heure d'exécution
        const [targetHour, targetMinute] = (settings.autoRecoveryTime || '08:00').split(':').map(Number);

        // Vérifier si c'est le bon moment (heure correspond)
        if (currentHour !== targetHour || currentMinute !== targetMinute) {
          continue;
        }

        // Vérifier la fréquence
        if (settings.autoRecoveryFrequency === 'WEEKLY' && currentDay !== 1) {
          // Hebdomadaire → seulement le lundi
          continue;
        }
        if (settings.autoRecoveryFrequency === 'MONTHLY' && now.getDate() !== 1) {
          // Mensuelle → seulement le 1er du mois
          continue;
        }

        // Lancer la relance pour ce tenant
        await this.runAutoRecoveryForTenant(settings);
      } catch (err: any) {
        this.logger.error(`Erreur relance auto pour tenant ${settings.tenantId}: ${err.message}`);
      }
    }
  }

  /**
   * Lance la relance automatique pour un tenant spécifique.
   * Parcourt tous les FeeArrear ouverts et envoie la relance appropriée.
   */
  async runAutoRecoveryForTenant(settings: any): Promise<{
    processed: number;
    sent: number;
    skipped: number;
    failed: number;
    details: any[];
  }> {
    this.logger.log(`Relance auto pour tenant ${settings.tenantId}`);

    // Parser les canaux
    // ⭐ Issue #?: replace WhatsApp + SMS with Yeshua Connect for recovery reminders.
    //    The parent receives the reminder directly in their Yeshua Connect chat account.
    //    Email is kept for archival; helm_connect replaces the WhatsApp + SMS channels.
    let channels: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[] = ['email', 'helm_connect'];
    try {
      const parsed = JSON.parse(settings.autoRecoveryChannels || '{}');
      channels = (['email', 'whatsapp', 'sms', 'helm_connect'] as const).filter((c) => parsed[c] !== false);
    } catch {
      // Garder les canaux par défaut
    }

    // Récupérer tous les FeeArrear ouverts
    const openArrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId: settings.tenantId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: {
        academicYear: { select: { name: true } },
      },
    });

    const warningDays = settings.reminderWarningDays || 3;
    const urgentDays = settings.reminderUrgentDays || 7;
    const finalDays = settings.reminderFinalDays || 15;
    const maxLevel = settings.autoRecoveryMaxLevel || 'MISE_EN_DEMEURE';

    const levelOrder = ['PREMIERE_RELANCE', 'DEUXIEME_RELANCE', 'MISE_EN_DEMEURE'];
    const maxLevelIndex = levelOrder.indexOf(maxLevel);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const details: any[] = [];

    for (const arrear of openArrears) {
      // Calculer l'ancienneté de l'arriéré en jours
      const createdDate = new Date(arrear.createdAt);
      const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      // Déterminer le niveau de relance
      let level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE' | null = null;
      if (daysSinceCreation >= finalDays) {
        level = 'MISE_EN_DEMEURE';
      } else if (daysSinceCreation >= urgentDays) {
        level = 'DEUXIEME_RELANCE';
      } else if (daysSinceCreation >= warningDays) {
        level = 'PREMIERE_RELANCE';
      }

      if (!level) {
        // Pas assez ancien pour une relance
        skipped++;
        continue;
      }

      // Vérifier si le niveau dépasse le max autorisé
      const levelIndex = levelOrder.indexOf(level);
      if (levelIndex > maxLevelIndex) {
        skipped++;
        continue;
      }

      // Vérifier si une relance a déjà été envoyée récemment (anti-harcèlement)
      // On vérifie les CollectionReminder des dernières 24h
      const recentReminder = await this.prisma.collectionReminder.findFirst({
        where: {
          feeArrearId: arrear.id,
          sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recentReminder) {
        skipped++;
        continue;
      }

      // Envoyer la relance multi-canal
      try {
        const results = await this.recoveryNotificationService.sendRecoveryNotifications(
          arrear.id,
          settings.tenantId,
          channels,
          level,
        );

        // Enregistrer la relance dans CollectionReminder
        for (const channel of channels) {
          const result = (results as any)[channel];
          if (result?.status === 'sent' || result?.status === 'skipped') {
            await this.prisma.collectionReminder.create({
              data: {
                feeArrearId: arrear.id,
                channel: channel.toUpperCase(),
                reminderStage: level,
                status: result.status === 'sent' ? 'SENT' : 'SKIPPED',
                message: `Relance automatique — ${level}`,
              },
            });
          }
        }

        sent++;
        details.push({
          arrearId: arrear.id,
          level,
          daysSinceCreation,
          results,
        });
      } catch (err: any) {
        failed++;
        this.logger.error(`Erreur envoi relance auto pour arriéré ${arrear.id}: ${err.message}`);
      }
    }

    this.logger.log(
      `Relance auto terminée pour tenant ${settings.tenantId}: ${sent} envoyées, ${skipped} ignorées, ${failed} échecs`,
    );

    return {
      processed: openArrears.length,
      sent,
      skipped,
      failed,
      details,
    };
  }

  /**
   * Lance manuellement la relance automatique pour un tenant.
   * Utilisé par le bouton "Lancer maintenant" dans l'UI.
   */
  async runManualRecovery(tenantId: string): Promise<any> {
    const settings = await this.settingsService.getForTenant(tenantId);
    if (!settings) {
      return { error: 'Paramètres introuvables' };
    }
    return this.runAutoRecoveryForTenant(settings);
  }
}
